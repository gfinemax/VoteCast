'use client';

import { useMemo } from 'react';
import {
    calculateAgendaPass,
    getAgendaAttendanceDisplayStats,
    getAgendaVoteBuckets,
    getAttendanceQuorumTarget,
    getElectionAgendaValidationStats,
    getMeetingAttendanceStats,
    normalizeAgendaType
} from '@/lib/store';
import { buildSplitVoteDisplayCards, getVoteCountSummary } from '@/components/admin/voteControlDerivedData';

const EMPTY_INACTIVE_MEMBER_IDS = [];

export default function useVoteControlDerivedContext({
    members,
    attendance,
    agendas,
    currentAgendaId,
    voteData,
    mailElectionVotes,
    localVoteDraft,
    confirmReadyAgendaId
}) {
    const inactiveMemberIds = Array.isArray(voteData?.inactiveMemberIds)
        ? voteData.inactiveMemberIds
        : EMPTY_INACTIVE_MEMBER_IDS;
    const activeMemberIdSet = useMemo(() => {
        const inactiveMemberIdSet = new Set(inactiveMemberIds);
        return new Set(
            members
                .filter(member => member.is_active !== false && !inactiveMemberIdSet.has(member.id))
                .map(member => member.id)
        );
    }, [inactiveMemberIds, members]);
    const activeMembers = useMemo(() => {
        return members.filter(member => activeMemberIdSet.has(member.id));
    }, [activeMemberIdSet, members]);
    const currentAgenda = agendas.find(agenda => agenda.id === currentAgendaId);
    const meetingId = useMemo(() => {
        if (!currentAgenda) return null;
        if (currentAgenda.type === 'folder') return currentAgenda.id;

        const currentIndex = agendas.findIndex(agenda => agenda.id === currentAgendaId);
        for (let index = currentIndex - 1; index >= 0; index--) {
            if (agendas[index].type === 'folder') return agendas[index].id;
        }
        return null;
    }, [agendas, currentAgenda, currentAgendaId]);
    const baseMeetingStats = useMemo(() => {
        return getMeetingAttendanceStats(attendance, meetingId, activeMemberIdSet);
    }, [activeMemberIdSet, attendance, meetingId]);
    const snapshot = currentAgenda?.vote_snapshot;
    const isConfirmed = !!snapshot;
    const liveVoteBuckets = useMemo(() => getAgendaVoteBuckets(currentAgenda, {
        mailElectionVotes,
        activeMemberIdSet
    }), [activeMemberIdSet, currentAgenda, mailElectionVotes]);
    const hasSplitVoteColumns = liveVoteBuckets.hasSplitVoteColumns;
    const fixedVoteTotals = liveVoteBuckets.fixed;
    const fixedVoteLabel = liveVoteBuckets.fixedLabel;
    const onsiteVoteTotals = hasSplitVoteColumns ? liveVoteBuckets.onsite : liveVoteBuckets.final;
    const finalVoteTotals = liveVoteBuckets.final;
    const realtimeStats = useMemo(() => getAgendaAttendanceDisplayStats({
        agenda: currentAgenda,
        meetingStats: baseMeetingStats,
        meetingId,
        attendance,
        mailElectionVotes,
        activeMemberIdSet
    }), [activeMemberIdSet, attendance, baseMeetingStats, currentAgenda, mailElectionVotes, meetingId]);
    const displayStats = isConfirmed
        ? {
            ...realtimeStats,
            ...(snapshot.stats || {}),
            total: (snapshot?.stats?.total > 0 ? snapshot.stats.total : realtimeStats.total)
        }
        : realtimeStats;
    const votesYes = isConfirmed ? snapshot.votes.yes : finalVoteTotals.yes;
    const votesNo = isConfirmed ? snapshot.votes.no : finalVoteTotals.no;
    const votesAbstain = isConfirmed ? snapshot.votes.abstain : finalVoteTotals.abstain;
    const declaration = isConfirmed ? snapshot.declaration : (currentAgenda?.declaration || '');
    const totalFixedVotes = fixedVoteTotals.yes + fixedVoteTotals.no + fixedVoteTotals.abstain;
    const syncedLocalVotes = {
        yes: onsiteVoteTotals.yes,
        no: onsiteVoteTotals.no,
        abstain: onsiteVoteTotals.abstain
    };
    const isDraftForCurrentAgenda = localVoteDraft.agendaId === currentAgendaId;
    const localVotes = isDraftForCurrentAgenda ? localVoteDraft.values : syncedLocalVotes;
    const isLocalDirty = isDraftForCurrentAgenda && localVoteDraft.dirty;
    const isReadyToConfirm = confirmReadyAgendaId === currentAgendaId;
    const currentAgendaType = normalizeAgendaType(currentAgenda?.type);
    const isSpecialVote = currentAgendaType === 'twoThirds';
    const isElection = currentAgendaType === 'election';
    const electionValidation = getElectionAgendaValidationStats({
        agenda: currentAgenda,
        meetingId,
        attendance,
        mailElectionVotes,
        activeMemberIdSet
    });
    const effectiveTotalAttendance = isConfirmed
        ? displayStats.total
        : (isElection ? electionValidation.expectedTotalVotes : displayStats.total);
    const effectiveOnsiteEligibleCount = isConfirmed
        ? (displayStats.direct + displayStats.proxy)
        : (isElection ? electionValidation.onsiteEligibleCount : (displayStats.direct + displayStats.proxy));
    const navigableAgendas = useMemo(() => agendas.filter(agenda => agenda.type !== 'folder'), [agendas]);
    const currentNavIndex = navigableAgendas.findIndex(agenda => agenda.id === currentAgendaId);
    const progressPercent = navigableAgendas.length > 0
        ? Math.round(((currentNavIndex + 1) / navigableAgendas.length) * 100)
        : 0;
    const totalMembers = activeMembers.length;
    const quorumTarget = getAttendanceQuorumTarget(currentAgendaType, totalMembers);
    const directTarget = Math.ceil(totalMembers * 0.2);
    const isDirectSatisfied = !isElection || (displayStats.direct >= directTarget);
    const isQuorumSatisfied = (effectiveTotalAttendance >= quorumTarget) && isDirectSatisfied;
    const isPassed = isQuorumSatisfied && calculateAgendaPass(votesYes, effectiveTotalAttendance, isSpecialVote);
    const totalOnsiteAttendance = displayStats.direct + displayStats.proxy;
    const voteCountSummary = getVoteCountSummary({
        votesYes,
        votesNo,
        votesAbstain,
        hasSplitVoteColumns,
        totalFixedVotes,
        localVotes,
        isLocalDirty,
        effectiveTotalAttendance,
        effectiveOnsiteEligibleCount,
        isElection,
        electionValidation
    });
    const splitVoteDisplayCards = buildSplitVoteDisplayCards({
        hasSplitVoteColumns,
        fixedVoteTotals,
        localVotes
    });
    const canConfirmDecision = isReadyToConfirm && !isLocalDirty && !voteCountSummary.isApplyDisabled;

    return {
        currentAgenda,
        isConfirmed,
        hasSplitVoteColumns,
        fixedVoteTotals,
        fixedVoteLabel,
        votesYes,
        votesNo,
        votesAbstain,
        declaration,
        totalFixedVotes,
        localVotes,
        isLocalDirty,
        isReadyToConfirm,
        currentAgendaType,
        isSpecialVote,
        isElection,
        electionValidation,
        effectiveTotalAttendance,
        effectiveOnsiteEligibleCount,
        navigableAgendas,
        currentNavIndex,
        progressPercent,
        totalMembers,
        quorumTarget,
        directTarget,
        isDirectSatisfied,
        isQuorumSatisfied,
        isPassed,
        totalOnsiteAttendance,
        displayStats,
        voteCountSummary,
        splitVoteDisplayCards,
        canConfirmDecision
    };
}
