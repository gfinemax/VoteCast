'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { applyMailElectionVotePreview, applyWrittenVoteDeltaToAgendaList, getAgendaIdsForMeeting } from './storeAgendaUtils';
import { normalizeAttendanceRecord } from './storeNormalizers';
import { queryWithRetry } from './storeSupabase';
import { fetchMembers } from './votecastRepository';

export const useStoreRealtimeSubscriptions = ({
    windowSyncIdRef,
    systemSettingsChannelRef,
    attendanceSyncChannelRef,
    isReorderingAgendasRef,
    suppressAgendaRealtimeUntilRef,
    stateRef,
    setState,
    applySystemSettingsToState,
    refreshAgendasFromDb,
    refreshMailElectionVotesFromDb,
    refreshSystemSettingsFromDb,
    syncAgendaForWrittenVote,
    reconcileAgendaVoteCountsFromWrittenVotes
}) => {
    useEffect(() => {
        const channel = supabase.channel('room_common')
            .on('broadcast', { event: 'system_settings_sync' }, (msg) => {
                const message = msg.payload;
                if (!message?.settings) return;
                if (message.senderId === windowSyncIdRef.current) return;

                applySystemSettingsToState(message.settings, {
                    preserveCurrentMeetingId: true,
                    projectorData: message.settings.projector_data ?? null
                });
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'system_settings' }, (payload) => {
                if (payload.new && payload.new.id === 1) {
                    applySystemSettingsToState(payload.new, {
                        preserveCurrentMeetingId: true,
                        projectorData: payload.new.projector_data ?? null
                    });
                }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'agendas' }, async () => {
                if (isReorderingAgendasRef.current) return;
                if (Date.now() < suppressAgendaRealtimeUntilRef.current) return;
                await refreshAgendasFromDb();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, async () => {
                const data = await queryWithRetry(fetchMembers, 'Failed to refresh members after realtime change');
                if (data) setState((prev) => ({ ...prev, members: data }));
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance' }, (payload) => {
                console.log('[Realtime] Attendance INSERT:', payload.new);
                setState((prev) => {
                    const cleanList = prev.attendance.filter((attendance) =>
                        !(attendance.member_id === payload.new.member_id && attendance.meeting_id === payload.new.meeting_id)
                    );
                    return {
                        ...prev,
                        attendance: [...cleanList, normalizeAttendanceRecord(payload.new)]
                    };
                });
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'attendance' }, (payload) => {
                console.log('[Realtime] Attendance DELETE:', payload.old);
                setState((prev) => ({
                    ...prev,
                    attendance: prev.attendance.filter((attendance) => attendance.id !== payload.old.id)
                }));
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'attendance' }, (payload) => {
                console.log('[Realtime] Attendance UPDATE:', payload.new);
                setState((prev) => ({
                    ...prev,
                    attendance: prev.attendance.map((attendance) => (
                        attendance.id === payload.new.id ? normalizeAttendanceRecord(payload.new) : attendance
                    ))
                }));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'written_votes' }, async (payload) => {
                const agendaId = payload.new?.agenda_id || payload.old?.agenda_id;
                if (!agendaId) return;
                await syncAgendaForWrittenVote(agendaId);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'mail_election_votes' }, async () => {
                await refreshMailElectionVotesFromDb();
            })
            .subscribe(async (status) => {
                console.log('[Realtime] Subscription Status:', status);

                if (status === 'SUBSCRIBED') {
                    await refreshSystemSettingsFromDb({ preserveCurrentMeetingId: true });
                }
            });
        systemSettingsChannelRef.current = channel;

        const presenceChannel = supabase.channel('room_presence', {
            config: {
                presence: {
                    key: 'admin'
                }
            }
        });

        presenceChannel
            .on('presence', { event: 'sync' }, () => {
                const newState = presenceChannel.presenceState();
                const projectorUsers = Object.values(newState)
                    .flat()
                    .filter((user) => user?.type === 'projector');
                const projectorConnectedCount = projectorUsers.length;
                const isConnected = projectorConnectedCount > 0;

                setState((prev) => {
                    if (
                        prev.projectorConnected === isConnected
                        && prev.projectorConnectedCount === projectorConnectedCount
                    ) {
                        return prev;
                    }

                    return {
                        ...prev,
                        projectorConnected: isConnected,
                        projectorConnectedCount
                    };
                });
            })
            .subscribe();

        const attendanceSyncChannel = supabase.channel('attendance_sync')
            .on('broadcast', { event: 'attendance_insert' }, (msg) => {
                const rawRecord = msg.payload?.record;
                if (!rawRecord) return;
                const record = normalizeAttendanceRecord(rawRecord);
                console.log('[Broadcast] Attendance INSERT received:', record.member_id);
                setState((prev) => {
                    const cleanList = prev.attendance.filter((attendance) =>
                        !(attendance.member_id === record.member_id && attendance.meeting_id === record.meeting_id)
                    );
                    return { ...prev, attendance: [...cleanList, record] };
                });
            })
            .on('broadcast', { event: 'attendance_delete' }, (msg) => {
                const { memberId, meetingId } = msg.payload || {};
                if (!memberId || !meetingId) return;
                console.log('[Broadcast] Attendance DELETE received:', memberId);
                setState((prev) => ({
                    ...prev,
                    attendance: prev.attendance.filter((attendance) =>
                        !(attendance.member_id === memberId && attendance.meeting_id === meetingId)
                    )
                }));
            })
            .on('broadcast', { event: 'written_votes_preview' }, (msg) => {
                const votes = Array.isArray(msg.payload?.votes) ? msg.payload.votes : [];
                const delta = Number(msg.payload?.delta) || 0;
                if (!votes.length || !delta) return;
                console.log('[Broadcast] Written vote preview received:', delta, votes.length);
                setState((prev) => ({
                    ...prev,
                    agendas: applyWrittenVoteDeltaToAgendaList(prev.agendas, votes, delta)
                }));
            })
            .on('broadcast', { event: 'written_votes_changed' }, async (msg) => {
                const meetingId = msg.payload?.meetingId || null;
                console.log('[Broadcast] Written votes changed - reconciling agendas', meetingId);

                const currentAgendas = stateRef.current.agendas;
                const targetAgendas = meetingId
                    ? currentAgendas.filter((agenda) => getAgendaIdsForMeeting(currentAgendas, meetingId).includes(agenda.id))
                    : currentAgendas;

                await reconcileAgendaVoteCountsFromWrittenVotes(targetAgendas);
                await refreshAgendasFromDb();
            })
            .on('broadcast', { event: 'mail_election_votes_preview' }, (msg) => {
                const { memberId, meetingId, action } = msg.payload || {};
                const votes = Array.isArray(msg.payload?.votes) ? msg.payload.votes : [];
                if (!memberId || !meetingId || !votes.length) return;
                console.log('[Broadcast] Mail election vote preview received:', action, votes.length);
                setState((prev) => ({
                    ...prev,
                    mailElectionVotes: applyMailElectionVotePreview(prev.mailElectionVotes, {
                        memberId,
                        meetingId,
                        votes,
                        action
                    })
                }));
            })
            .on('broadcast', { event: 'mail_election_votes_changed' }, async () => {
                await refreshMailElectionVotesFromDb();
            })
            .subscribe();
        attendanceSyncChannelRef.current = attendanceSyncChannel;

        return () => {
            supabase.removeChannel(channel);
            if (systemSettingsChannelRef.current === channel) {
                systemSettingsChannelRef.current = null;
            }
            supabase.removeChannel(presenceChannel);
            supabase.removeChannel(attendanceSyncChannel);
            attendanceSyncChannelRef.current = null;
        };
    }, [
        applySystemSettingsToState,
        attendanceSyncChannelRef,
        isReorderingAgendasRef,
        reconcileAgendaVoteCountsFromWrittenVotes,
        refreshAgendasFromDb,
        refreshMailElectionVotesFromDb,
        refreshSystemSettingsFromDb,
        setState,
        stateRef,
        suppressAgendaRealtimeUntilRef,
        syncAgendaForWrittenVote,
        systemSettingsChannelRef,
        windowSyncIdRef
    ]);
};
