import {
    applyMailElectionVotePreview,
    applyWrittenVoteDeltaToAgendaList,
    buildWrittenVotePreviewPayload,
    getAgendaIdsForMeeting
} from './storeAgendaUtils';
import {
    normalizeAttendanceRecord,
    normalizeCheckInPayload
} from './storeNormalizers';
import {
    getElectionModeValidationMessage,
    getUniqueAttendanceRecords,
    isElectionModeAllowedForMeetingType,
    normalizeAgendaType
} from './storeSelectors';
import { isAbortError } from './storeSupabase';
import {
    cancelCheckInMember as cancelCheckInMemberRpc,
    checkInMember as checkInMemberRpc,
    deleteAttendanceByMemberMeeting,
    fetchMailElectionVotesForMemberMeeting,
    fetchWrittenVotesForMemberMeeting,
    insertAttendance,
    replaceCheckInMember as replaceCheckInMemberRpc
} from './votecastRepository';

const buildAttendanceVotePayloads = ({
    agendas = [],
    meetingId,
    meetingType,
    electionMode,
    writtenVotes,
    electionVotes
}) => {
    const agendaTypeById = new Map(agendas.map((agenda) => [agenda.id, normalizeAgendaType(agenda?.type)]));
    const providedWrittenVotePayload = (meetingType === 'written' ? writtenVotes : []).filter((vote) => (
        agendaTypeById.get(vote?.agenda_id) && agendaTypeById.get(vote.agenda_id) !== 'election'
    ));
    const writtenVotePayload = meetingType === 'written'
        ? buildWrittenVotePreviewPayload(agendas, meetingId, providedWrittenVotePayload)
        : [];
    const electionVotePayload = (electionMode === 'mail' ? electionVotes : []).filter((vote) => (
        agendaTypeById.get(vote?.agenda_id) === 'election'
    ));

    return { writtenVotePayload, electionVotePayload };
};

const sendAttendanceBroadcast = (attendanceSyncChannelRef, event, payload) => {
    try {
        const result = attendanceSyncChannelRef.current?.send({
            type: 'broadcast',
            event,
            payload
        });

        if (result && typeof result.catch === 'function') {
            result.catch((error) => {
                if (isAbortError(error)) return;
                console.warn(`[Attendance] Broadcast ${event} failed:`, error);
            });
        }
    } catch (error) {
        if (isAbortError(error)) return;
        console.warn(`[Attendance] Broadcast ${event} failed:`, error);
    }
};

const applyWrittenPreview = ({ setState, attendanceSyncChannelRef, meetingId, votes, delta }) => {
    if (!votes.length) return false;

    setState((prev) => ({
        ...prev,
        agendas: applyWrittenVoteDeltaToAgendaList(prev.agendas, votes, delta)
    }));
    sendAttendanceBroadcast(attendanceSyncChannelRef, 'written_votes_preview', { meetingId, votes, delta });
    return true;
};

const applyMailPreview = ({ setState, attendanceSyncChannelRef, memberId, meetingId, votes, action }) => {
    if (!votes.length) return false;

    setState((prev) => ({
        ...prev,
        mailElectionVotes: applyMailElectionVotePreview(prev.mailElectionVotes, {
            memberId,
            meetingId,
            votes,
            action
        })
    }));
    sendAttendanceBroadcast(attendanceSyncChannelRef, 'mail_election_votes_preview', {
        memberId,
        meetingId,
        votes,
        action
    });
    return true;
};

const reconcileMeetingWrittenVotes = async ({
    stateRef,
    meetingId,
    reconcileAgendaVoteCountsFromWrittenVotes,
    attendanceSyncChannelRef
}) => {
    const meetingAgendaIds = getAgendaIdsForMeeting(stateRef.current.agendas, meetingId);
    const meetingAgendas = stateRef.current.agendas.filter((agenda) => meetingAgendaIds.includes(agenda.id));
    await reconcileAgendaVoteCountsFromWrittenVotes(meetingAgendas);
    sendAttendanceBroadcast(attendanceSyncChannelRef, 'written_votes_changed', { meetingId });
};

const buildChoiceMap = (rows = []) => {
    const choices = {};
    rows.forEach((vote) => {
        if (vote?.agenda_id && ['yes', 'no', 'abstain'].includes(vote?.choice)) {
            choices[vote.agenda_id] = vote.choice;
        }
    });
    return choices;
};

const resolveMeetingId = (stateRef, meetingId = null) => meetingId || stateRef.current.activeMeetingId;

export const createAttendanceActions = ({
    stateRef,
    setState,
    pendingAttendanceOpsRef,
    attendanceSyncChannelRef,
    refreshAgendasFromDb,
    refreshAttendanceFromDb,
    refreshMailElectionVotesFromDb,
    reconcileAgendaVoteCountsFromWrittenVotes
}) => ({
    checkInMember: async (memberId, typeOrPayload = 'direct', proxyName = null, votes = null) => {
        const {
            meetingId: payloadMeetingId,
            meetingType,
            hasElection,
            electionMode,
            ballotIssued,
            proxyName: normalizedProxyName,
            writtenVotes,
            electionVotes
        } = normalizeCheckInPayload(typeOrPayload, proxyName, votes);
        const meetingId = resolveMeetingId(stateRef, payloadMeetingId);
        if (!meetingId) {
            console.error('No meeting selected for admission.');
            return { ok: false, error: new Error('선택된 총회가 없습니다.') };
        }

        const attendanceKey = `${meetingId}:${memberId}`;
        if (pendingAttendanceOpsRef.current.has(attendanceKey)) {
            return { ok: false, error: new Error('이미 처리 중입니다.') };
        }

        const hasExistingAttendance = stateRef.current.attendance.some((record) =>
            record.member_id === memberId && record.meeting_id === meetingId
        );
        if (hasExistingAttendance) {
            return { ok: false, error: new Error('이미 접수된 조합원입니다. 수정 버튼을 사용하세요.') };
        }

        if (!meetingType && !hasElection) {
            console.error('Check-in payload must include a meeting type or election participation.');
            return { ok: false, error: new Error('총회 상태 또는 선거 참여를 하나 이상 선택해야 합니다.') };
        }
        if (!isElectionModeAllowedForMeetingType(meetingType, electionMode)) {
            return { ok: false, error: new Error(getElectionModeValidationMessage(meetingType, electionMode)) };
        }

        pendingAttendanceOpsRef.current.add(attendanceKey);
        const { writtenVotePayload, electionVotePayload } = buildAttendanceVotePayloads({
            agendas: stateRef.current.agendas,
            meetingId,
            meetingType,
            electionMode,
            writtenVotes,
            electionVotes
        });
        let didApplyWrittenPreview = false;
        let didApplyMailPreview = false;

        try {
            const tempId = Date.now();
            const newRecord = normalizeAttendanceRecord({
                id: tempId,
                member_id: memberId,
                meeting_id: meetingId,
                type: meetingType,
                has_election: hasElection,
                ballot_issued: ballotIssued,
                proxy_name: normalizedProxyName,
                created_at: new Date().toISOString()
            });

            setState((prev) => ({
                ...prev,
                attendance: [...prev.attendance, newRecord]
            }));

            didApplyWrittenPreview = applyWrittenPreview({
                setState,
                attendanceSyncChannelRef,
                meetingId,
                votes: writtenVotePayload,
                delta: 1
            });
            didApplyMailPreview = applyMailPreview({
                setState,
                attendanceSyncChannelRef,
                memberId,
                meetingId,
                votes: electionVotePayload,
                action: 'upsert'
            });

            sendAttendanceBroadcast(attendanceSyncChannelRef, 'attendance_insert', { record: newRecord });

            const { error } = await checkInMemberRpc({
                memberId,
                meetingId,
                type: meetingType,
                hasElection,
                ballotIssued,
                proxyName: normalizedProxyName,
                votes: writtenVotePayload.length ? writtenVotePayload : null,
                electionVotes: electionVotePayload.length ? electionVotePayload : null
            });

            if (error) {
                if (error.code === '42883' && !writtenVotePayload.length && !electionVotePayload.length) {
                    console.warn("RPC 'check_in_member' not found. Falling back to simple insert.");
                    const { error: fallbackError } = await insertAttendance({
                        member_id: memberId,
                        meeting_id: meetingId,
                        type: meetingType,
                        has_election: hasElection,
                        proxy_name: normalizedProxyName
                    });
                    if (fallbackError) {
                        if (isAbortError(fallbackError)) {
                            return { ok: false, error: fallbackError };
                        }
                        console.error('Fallback Check-in Failed:', fallbackError);
                        setState((prev) => ({
                            ...prev,
                            attendance: prev.attendance.filter((attendance) => attendance.id !== tempId)
                        }));
                        if (didApplyWrittenPreview) {
                            applyWrittenPreview({
                                setState,
                                attendanceSyncChannelRef,
                                meetingId,
                                votes: writtenVotePayload,
                                delta: -1
                            });
                        }
                        if (didApplyMailPreview) {
                            applyMailPreview({
                                setState,
                                attendanceSyncChannelRef,
                                memberId,
                                meetingId,
                                votes: electionVotePayload,
                                action: 'remove'
                            });
                        }
                        return { ok: false, error: fallbackError };
                    }
                } else {
                    if (isAbortError(error)) {
                        return { ok: false, error };
                    }
                    console.error('Check-in Transaction Failed:', error);
                    setState((prev) => ({
                        ...prev,
                        attendance: prev.attendance.filter((attendance) => attendance.id !== tempId)
                    }));
                    if (didApplyWrittenPreview) {
                        applyWrittenPreview({
                            setState,
                            attendanceSyncChannelRef,
                            meetingId,
                            votes: writtenVotePayload,
                            delta: -1
                        });
                    }
                    if (didApplyMailPreview) {
                        applyMailPreview({
                            setState,
                            attendanceSyncChannelRef,
                            memberId,
                            meetingId,
                            votes: electionVotePayload,
                            action: 'remove'
                        });
                    }
                    return { ok: false, error };
                }
            }

            if (meetingType === 'written') {
                await reconcileMeetingWrittenVotes({
                    stateRef,
                    meetingId,
                    reconcileAgendaVoteCountsFromWrittenVotes,
                    attendanceSyncChannelRef
                });
            }

            if (electionVotePayload.length) {
                await refreshMailElectionVotesFromDb();
                sendAttendanceBroadcast(attendanceSyncChannelRef, 'mail_election_votes_changed', { meetingId });
            }

            await refreshAgendasFromDb();
            return { ok: true };
        } finally {
            pendingAttendanceOpsRef.current.delete(attendanceKey);
        }
    },

    getCheckInDetails: async (memberId, meetingIdOverride = null) => {
        const meetingId = resolveMeetingId(stateRef, meetingIdOverride);
        if (!meetingId || !memberId) {
            return null;
        }

        const attendanceRecord = getUniqueAttendanceRecords(stateRef.current.attendance, meetingId, null)
            .find((record) => record.member_id === memberId) || null;

        const [{ data: writtenVoteRows, error: writtenVoteError }, { data: electionVoteRows, error: electionVoteError }] = await Promise.all([
            fetchWrittenVotesForMemberMeeting(memberId, meetingId),
            fetchMailElectionVotesForMemberMeeting(memberId, meetingId)
        ]);

        if (writtenVoteError) {
            throw writtenVoteError;
        }
        if (electionVoteError && electionVoteError.code !== '42P01') {
            throw electionVoteError;
        }

        return {
            attendanceRecord,
            meetingType: attendanceRecord?.type || 'none',
            electionMode: attendanceRecord?.has_election
                ? ((electionVoteRows || []).length ? 'mail' : 'onsite')
                : 'none',
            proxyName: attendanceRecord?.proxy_name || '',
            ballotIssued: !!attendanceRecord?.ballot_issued,
            writtenVotes: buildChoiceMap(writtenVoteRows || []),
            electionVotes: buildChoiceMap(electionVoteRows || [])
        };
    },

    replaceCheckInMember: async (memberId, typeOrPayload = 'direct', proxyName = null, votes = null) => {
        const {
            meetingId: payloadMeetingId,
            meetingType,
            hasElection,
            electionMode,
            ballotIssued,
            proxyName: normalizedProxyName,
            writtenVotes,
            electionVotes
        } = normalizeCheckInPayload(typeOrPayload, proxyName, votes);
        const meetingId = resolveMeetingId(stateRef, payloadMeetingId);
        if (!meetingId) {
            console.error('No meeting selected for admission.');
            return { ok: false, error: new Error('선택된 총회가 없습니다.') };
        }

        const attendanceKey = `${meetingId}:${memberId}`;
        if (pendingAttendanceOpsRef.current.has(attendanceKey)) {
            return { ok: false, error: new Error('이미 처리 중입니다.') };
        }

        const existingRecords = stateRef.current.attendance.filter((record) =>
            record.member_id === memberId && record.meeting_id === meetingId
        );
        if (!existingRecords.length) {
            return { ok: false, error: new Error('수정할 기존 접수 내역이 없습니다.') };
        }

        if (!meetingType && !hasElection) {
            return { ok: false, error: new Error('총회 상태 또는 선거 참여를 하나 이상 선택해야 합니다.') };
        }
        if (!isElectionModeAllowedForMeetingType(meetingType, electionMode)) {
            return { ok: false, error: new Error(getElectionModeValidationMessage(meetingType, electionMode)) };
        }

        const { writtenVotePayload, electionVotePayload } = buildAttendanceVotePayloads({
            agendas: stateRef.current.agendas,
            meetingId,
            meetingType,
            electionMode,
            writtenVotes,
            electionVotes
        });

        pendingAttendanceOpsRef.current.add(attendanceKey);

        try {
            let error = null;
            const { error: replaceError } = await replaceCheckInMemberRpc({
                memberId,
                meetingId,
                type: meetingType,
                hasElection,
                ballotIssued,
                proxyName: normalizedProxyName,
                votes: writtenVotePayload.length ? writtenVotePayload : null,
                electionVotes: electionVotePayload.length ? electionVotePayload : null
            });
            error = replaceError;

            if (error && error.code === '42883') {
                const { error: cancelError } = await cancelCheckInMemberRpc(memberId, meetingId);
                if (!cancelError) {
                    const { error: checkInError } = await checkInMemberRpc({
                        memberId,
                        meetingId,
                        type: meetingType,
                        hasElection,
                        ballotIssued,
                        proxyName: normalizedProxyName,
                        votes: writtenVotePayload.length ? writtenVotePayload : null,
                        electionVotes: electionVotePayload.length ? electionVotePayload : null
                    });
                    error = checkInError;
                } else {
                    error = cancelError;
                }
            }

            if (error) {
                if (isAbortError(error)) {
                    return { ok: false, error };
                }
                console.error('Replace Check-in Failed:', error);
                return { ok: false, error };
            }

            await Promise.all([
                refreshAttendanceFromDb(),
                refreshAgendasFromDb(),
                refreshMailElectionVotesFromDb()
            ]);

            sendAttendanceBroadcast(attendanceSyncChannelRef, 'attendance_replace', { memberId, meetingId });
            sendAttendanceBroadcast(attendanceSyncChannelRef, 'written_votes_changed', { meetingId });
            sendAttendanceBroadcast(attendanceSyncChannelRef, 'mail_election_votes_changed', { meetingId });

            return { ok: true };
        } finally {
            pendingAttendanceOpsRef.current.delete(attendanceKey);
        }
    },

    cancelCheckInMember: async (memberId, meetingIdOverride = null) => {
        const meetingId = resolveMeetingId(stateRef, meetingIdOverride);
        if (!meetingId) return;

        const attendanceKey = `${meetingId}:${memberId}`;
        if (pendingAttendanceOpsRef.current.has(attendanceKey)) {
            return;
        }

        const existingRecords = stateRef.current.attendance.filter((record) =>
            record.member_id === memberId && record.meeting_id === meetingId
        );
        if (!existingRecords.length) {
            return;
        }

        const hadWrittenAttendance = existingRecords.some((record) => record.type === 'written');
        const hadElectionAttendance = existingRecords.some((record) => record.has_election);
        pendingAttendanceOpsRef.current.add(attendanceKey);
        let writtenVotePayload = [];
        let mailElectionVotePayload = [];
        let didApplyWrittenPreview = false;
        let didApplyMailPreview = false;

        try {
            if (hadWrittenAttendance) {
                const { data: existingWrittenVotes } = await fetchWrittenVotesForMemberMeeting(memberId, meetingId);
                writtenVotePayload = Array.isArray(existingWrittenVotes) ? existingWrittenVotes : [];
            }

            if (hadElectionAttendance) {
                const { data: existingMailVotes } = await fetchMailElectionVotesForMemberMeeting(memberId, meetingId);
                mailElectionVotePayload = Array.isArray(existingMailVotes) ? existingMailVotes : [];
            }

            setState((prev) => ({
                ...prev,
                attendance: prev.attendance.filter((attendance) => !(attendance.member_id === memberId && attendance.meeting_id === meetingId))
            }));

            didApplyWrittenPreview = applyWrittenPreview({
                setState,
                attendanceSyncChannelRef,
                meetingId,
                votes: writtenVotePayload,
                delta: -1
            });
            didApplyMailPreview = applyMailPreview({
                setState,
                attendanceSyncChannelRef,
                memberId,
                meetingId,
                votes: mailElectionVotePayload,
                action: 'remove'
            });

            sendAttendanceBroadcast(attendanceSyncChannelRef, 'attendance_delete', { memberId, meetingId });

            const { error } = await cancelCheckInMemberRpc(memberId, meetingId);

            if (error) {
                if (error.code === '42883') {
                    console.warn("RPC 'cancel_check_in_member' not found. Falling back to simple delete.");
                    const { error: fallbackError } = await deleteAttendanceByMemberMeeting(memberId, meetingId);
                    if (fallbackError) {
                        if (isAbortError(fallbackError)) return;
                        console.error('Fallback Cancel Check-in Failed:', fallbackError);
                        if (didApplyWrittenPreview) {
                            applyWrittenPreview({
                                setState,
                                attendanceSyncChannelRef,
                                meetingId,
                                votes: writtenVotePayload,
                                delta: 1
                            });
                        }
                        if (didApplyMailPreview) {
                            applyMailPreview({
                                setState,
                                attendanceSyncChannelRef,
                                memberId,
                                meetingId,
                                votes: mailElectionVotePayload,
                                action: 'upsert'
                            });
                        }
                        return;
                    }
                } else {
                    if (isAbortError(error)) return;
                    console.error('Cancel Check-in Failed:', error);
                    if (didApplyWrittenPreview) {
                        applyWrittenPreview({
                            setState,
                            attendanceSyncChannelRef,
                            meetingId,
                            votes: writtenVotePayload,
                            delta: 1
                        });
                    }
                    if (didApplyMailPreview) {
                        applyMailPreview({
                            setState,
                            attendanceSyncChannelRef,
                            memberId,
                            meetingId,
                            votes: mailElectionVotePayload,
                            action: 'upsert'
                        });
                    }
                    return;
                }
            }

            if (hadWrittenAttendance) {
                await reconcileMeetingWrittenVotes({
                    stateRef,
                    meetingId,
                    reconcileAgendaVoteCountsFromWrittenVotes,
                    attendanceSyncChannelRef
                });
            }

            if (hadElectionAttendance) {
                await refreshMailElectionVotesFromDb();
                sendAttendanceBroadcast(attendanceSyncChannelRef, 'mail_election_votes_changed', { meetingId });
            }

            await refreshAgendasFromDb();
        } finally {
            pendingAttendanceOpsRef.current.delete(attendanceKey);
        }
    }
});
