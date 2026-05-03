import { getInactiveMemberIds } from './storeHelpers';
import { normalizeAttendanceRecord } from './storeNormalizers';
import {
    getUniqueAttendanceRecords,
    normalizeAgendaType,
    toVoteNumber
} from './storeSelectors';
import { getMeetingIdForAgenda } from './storeAgendaUtils';
import { queryWithRetry } from './storeSupabase';
import {
    fetchAttendanceForMeetings,
    fetchWrittenVotesForAgendas,
    updateAgendaFields,
    upsertWrittenVotes
} from './votecastRepository';

export const reconcileWrittenVoteAgendaCounts = async ({
    agendaRows = null,
    context = {},
    stateSnapshot = {},
    suppressAgendaRealtimeUntilRef = null
} = {}) => {
    const currentAgendas = stateSnapshot.agendas || [];
    const agendasToCheck = Array.isArray(agendaRows) ? agendaRows : currentAgendas;
    const agendaContextRows = Array.isArray(agendaRows) && agendaRows.length > 1
        ? agendaRows
        : currentAgendas;
    const targetAgendas = agendasToCheck.filter((agenda) =>
        agenda.type !== 'folder'
        && normalizeAgendaType(agenda.type) !== 'election'
        && [
            'written_yes',
            'written_no',
            'written_abstain',
            'onsite_yes',
            'onsite_no',
            'onsite_abstain'
        ].every((field) => Object.prototype.hasOwnProperty.call(agenda, field))
    );

    if (!targetAgendas.length) {
        return false;
    }

    const targetAgendaIds = targetAgendas.map((agenda) => agenda.id);
    const meetingIdByAgendaId = new Map(
        targetAgendas.map((agenda) => [agenda.id, getMeetingIdForAgenda(agendaContextRows, agenda.id)])
    );
    const targetMeetingIds = Array.from(
        new Set(
            targetAgendas
                .map((agenda) => meetingIdByAgendaId.get(agenda.id))
                .filter(Boolean)
        )
    );

    const membersForReconcile = Array.isArray(context.membersRows)
        ? context.membersRows
        : stateSnapshot.members || [];
    const voteDataForReconcile = context.voteData || stateSnapshot.voteData || {};
    const inactiveMemberIdSet = new Set(getInactiveMemberIds(voteDataForReconcile));
    const activeMemberIdSet = membersForReconcile.length
        ? new Set(
            membersForReconcile
                .filter((member) => member.is_active !== false && !inactiveMemberIdSet.has(member.id))
                .map((member) => member.id)
        )
        : null;

    let attendanceRowsForMeetings = [];
    if (targetMeetingIds.length) {
        if (Array.isArray(context.attendanceRows)) {
            attendanceRowsForMeetings = context.attendanceRows
                .filter((record) => targetMeetingIds.includes(record?.meeting_id))
                .map(normalizeAttendanceRecord);
        } else {
            const attendanceRows = await queryWithRetry(
                () => fetchAttendanceForMeetings(targetMeetingIds),
                'Failed to load attendance for agenda reconciliation'
            );

            if (!attendanceRows) {
                return false;
            }

            attendanceRowsForMeetings = attendanceRows.map(normalizeAttendanceRecord);
        }
    }

    const writtenAttendanceByMeetingId = new Map();
    targetMeetingIds.forEach((meetingId) => {
        const currentWrittenRecords = getUniqueAttendanceRecords(
            attendanceRowsForMeetings,
            meetingId,
            activeMemberIdSet
        ).filter((record) => record.type === 'written');

        currentWrittenRecords.forEach((record) => {
            const meetingId = record?.meeting_id;
            const memberId = record?.member_id;
            if (!meetingId || !memberId) return;

            const memberIdSet = writtenAttendanceByMeetingId.get(meetingId) || new Set();
            memberIdSet.add(memberId);
            writtenAttendanceByMeetingId.set(meetingId, memberIdSet);
        });
    });

    const writtenVotes = await queryWithRetry(
        () => fetchWrittenVotesForAgendas(targetAgendaIds),
        'Failed to reconcile written vote counts'
    );

    if (!writtenVotes) {
        return false;
    }

    const countsByAgendaId = new Map();
    const voteMemberIdsByAgendaId = new Map();
    (writtenVotes || []).forEach((vote) => {
        const agendaId = vote?.agenda_id;
        const memberId = vote?.member_id;
        const meetingId = meetingIdByAgendaId.get(agendaId);
        const writtenAttendanceMemberIds = writtenAttendanceByMeetingId.get(meetingId) || new Set();
        if (!agendaId || !memberId || !writtenAttendanceMemberIds.has(memberId)) return;
        if (!['yes', 'no', 'abstain'].includes(vote.choice)) return;

        const currentCounts = countsByAgendaId.get(agendaId) || { yes: 0, no: 0, abstain: 0 };
        const currentMemberIds = voteMemberIdsByAgendaId.get(agendaId) || new Set();
        currentCounts[vote.choice] += 1;
        currentMemberIds.add(memberId);
        countsByAgendaId.set(agendaId, currentCounts);
        voteMemberIdsByAgendaId.set(agendaId, currentMemberIds);
    });

    const missingVoteRows = [];
    targetAgendas.forEach((agenda) => {
        const meetingId = meetingIdByAgendaId.get(agenda.id);
        if (!meetingId) return;

        const writtenAttendanceMemberIds = writtenAttendanceByMeetingId.get(meetingId) || new Set();
        const existingVoteMemberIds = voteMemberIdsByAgendaId.get(agenda.id) || new Set();

        writtenAttendanceMemberIds.forEach((memberId) => {
            if (existingVoteMemberIds.has(memberId)) return;

            missingVoteRows.push({
                member_id: memberId,
                meeting_id: meetingId,
                agenda_id: agenda.id,
                choice: 'yes'
            });
        });
    });

    if (missingVoteRows.length) {
        const { error: backfillError } = await upsertWrittenVotes(missingVoteRows);

        if (backfillError) {
            console.error('Failed to backfill missing written votes for agendas:', backfillError);
        } else {
            missingVoteRows.forEach((vote) => {
                const currentCounts = countsByAgendaId.get(vote.agenda_id) || { yes: 0, no: 0, abstain: 0 };
                const currentMemberIds = voteMemberIdsByAgendaId.get(vote.agenda_id) || new Set();
                currentCounts.yes += 1;
                currentMemberIds.add(vote.member_id);
                countsByAgendaId.set(vote.agenda_id, currentCounts);
                voteMemberIdsByAgendaId.set(vote.agenda_id, currentMemberIds);
            });
        }
    }

    const updates = targetAgendas
        .map((agenda) => {
            const writtenCounts = countsByAgendaId.get(agenda.id) || { yes: 0, no: 0, abstain: 0 };
            const nextFields = {
                written_yes: writtenCounts.yes,
                written_no: writtenCounts.no,
                written_abstain: writtenCounts.abstain,
                votes_yes: writtenCounts.yes + toVoteNumber(agenda.onsite_yes),
                votes_no: writtenCounts.no + toVoteNumber(agenda.onsite_no),
                votes_abstain: writtenCounts.abstain + toVoteNumber(agenda.onsite_abstain)
            };

            const hasMismatch = (
                toVoteNumber(agenda.written_yes) !== nextFields.written_yes ||
                toVoteNumber(agenda.written_no) !== nextFields.written_no ||
                toVoteNumber(agenda.written_abstain) !== nextFields.written_abstain ||
                toVoteNumber(agenda.votes_yes) !== nextFields.votes_yes ||
                toVoteNumber(agenda.votes_no) !== nextFields.votes_no ||
                toVoteNumber(agenda.votes_abstain) !== nextFields.votes_abstain
            );

            return hasMismatch ? { id: agenda.id, fields: nextFields } : null;
        })
        .filter(Boolean);

    if (!updates.length) {
        return false;
    }

    if (suppressAgendaRealtimeUntilRef) {
        suppressAgendaRealtimeUntilRef.current = Date.now() + 1500;
    }

    for (const update of updates) {
        const { error: updateError } = await updateAgendaFields(update.id, update.fields);

        if (updateError) {
            console.error('Failed to sync agenda written vote totals:', update.id, updateError);
        }
    }

    return true;
};
