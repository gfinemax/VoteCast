const EMPTY_VOTE_TOTALS = Object.freeze({ yes: 0, no: 0, abstain: 0 });

export const toVoteNumber = (value) => {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
};

export const getMailElectionVoteStats = (mailElectionVotes = [], agendaId = null, activeMemberIdSet = null) => {
    const emptyStats = {
        yes: 0,
        no: 0,
        abstain: 0,
        totalVotes: 0,
        participantCount: 0
    };

    if (!agendaId) return emptyStats;

    const participantIds = new Set();
    const totals = { ...EMPTY_VOTE_TOTALS };

    mailElectionVotes.forEach((vote) => {
        if (vote?.agenda_id !== agendaId) return;
        if (activeMemberIdSet && !activeMemberIdSet.has(vote.member_id)) return;
        if (!['yes', 'no', 'abstain'].includes(vote?.choice)) return;

        totals[vote.choice] += 1;
        participantIds.add(vote.member_id);
    });

    return {
        ...totals,
        totalVotes: totals.yes + totals.no + totals.abstain,
        participantCount: participantIds.size
    };
};

export const normalizeAgendaType = (type) => {
    if (type === 'general') return 'majority';
    if (type === 'special') return 'twoThirds';
    return type || 'majority';
};

export const getAgendaVoteBuckets = (agenda = {}, options = {}) => {
    const normalizedAgendaType = normalizeAgendaType(agenda?.type);
    const isElectionAgenda = normalizedAgendaType === 'election';
    const hasSplitVoteColumns = [
        'written_yes',
        'written_no',
        'written_abstain',
        'onsite_yes',
        'onsite_no',
        'onsite_abstain'
    ].some((field) => Object.prototype.hasOwnProperty.call(agenda, field));

    const mailVoteStats = isElectionAgenda
        ? getMailElectionVoteStats(options.mailElectionVotes, agenda?.id, options.activeMemberIdSet)
        : null;

    const fixed = isElectionAgenda
        ? {
            yes: mailVoteStats?.yes || 0,
            no: mailVoteStats?.no || 0,
            abstain: mailVoteStats?.abstain || 0
        }
        : (hasSplitVoteColumns
            ? {
                yes: toVoteNumber(agenda?.written_yes),
                no: toVoteNumber(agenda?.written_no),
                abstain: toVoteNumber(agenda?.written_abstain)
            }
            : { ...EMPTY_VOTE_TOTALS });

    const onsite = hasSplitVoteColumns
        ? {
            yes: toVoteNumber(agenda?.onsite_yes),
            no: toVoteNumber(agenda?.onsite_no),
            abstain: toVoteNumber(agenda?.onsite_abstain)
        }
        : {
            yes: toVoteNumber(agenda?.votes_yes),
            no: toVoteNumber(agenda?.votes_no),
            abstain: toVoteNumber(agenda?.votes_abstain)
        };

    return {
        hasSplitVoteColumns,
        isElectionAgenda,
        fixedLabel: isElectionAgenda ? '우편투표' : '서면결의서',
        fixedParticipantCount: isElectionAgenda ? (mailVoteStats?.participantCount || 0) : null,
        fixed,
        written: fixed,
        onsite,
        final: {
            yes: fixed.yes + onsite.yes,
            no: fixed.no + onsite.no,
            abstain: fixed.abstain + onsite.abstain
        }
    };
};

export const withLegacyVoteTotals = (agenda = {}, options = {}) => {
    const voteBuckets = getAgendaVoteBuckets(agenda, options);
    if (!voteBuckets.hasSplitVoteColumns) return agenda;

    return {
        ...agenda,
        votes_yes: voteBuckets.final.yes,
        votes_no: voteBuckets.final.no,
        votes_abstain: voteBuckets.final.abstain
    };
};

export const getMajorityThreshold = (count) => Math.floor((Number(count) || 0) / 2) + 1;

export const isElectionModeAllowedForMeetingType = (meetingType, electionMode) => {
    const normalizedMeetingType = meetingType || 'none';
    const normalizedElectionMode = electionMode || 'none';

    if (normalizedElectionMode === 'none') return true;
    if (normalizedElectionMode === 'onsite') return normalizedMeetingType === 'direct';
    if (normalizedElectionMode === 'mail') return ['proxy', 'written', 'none'].includes(normalizedMeetingType);

    return false;
};

export const getAllowedElectionModesForMeetingType = (meetingType) => (
    ['onsite', 'mail', 'none'].filter((mode) => isElectionModeAllowedForMeetingType(meetingType, mode))
);

export const getDefaultElectionModeForMeetingType = (meetingType) => (
    meetingType === 'direct' ? 'onsite' : 'none'
);

export const sanitizeElectionModeForMeetingType = (meetingType, electionMode) => (
    isElectionModeAllowedForMeetingType(meetingType, electionMode)
        ? (electionMode || 'none')
        : getDefaultElectionModeForMeetingType(meetingType)
);

export const getElectionModeValidationMessage = (meetingType, electionMode) => {
    if (electionMode === 'onsite') {
        return '현장투표는 본인 참석인 경우에만 선택할 수 있습니다.';
    }
    if (electionMode === 'mail') {
        return meetingType === 'direct'
            ? '본인 참석은 우편투표와 함께 저장할 수 없습니다. 현장투표 또는 선거 불참을 선택하세요.'
            : '선거 참여 방식이 참석유형과 맞지 않습니다.';
    }
    return '선거 참여 방식이 참석유형과 맞지 않습니다.';
};

export const normalizeAgendaTypeForDb = (type) => {
    const normalized = normalizeAgendaType(type);
    if (['majority', 'twoThirds', 'election', 'folder'].includes(normalized)) {
        return normalized;
    }
    return 'majority';
};

export const normalizeAgendaRecord = (agenda = {}, options = {}) => withLegacyVoteTotals({
    ...agenda,
    type: normalizeAgendaTypeForDb(agenda?.type)
}, options);

export const getAttendanceQuorumTarget = (type, totalMembers) => {
    return normalizeAgendaType(type) === 'twoThirds'
        ? Math.ceil((Number(totalMembers) || 0) * (2 / 3))
        : getMajorityThreshold(totalMembers);
};

const getAttendanceRecordRank = (record = {}) => {
    const timestamp = Date.parse(record.created_at || '');
    if (!Number.isNaN(timestamp)) {
        return timestamp;
    }

    return Number(record.id) || 0;
};

export const getUniqueAttendanceRecords = (attendance = [], meetingId = null, activeMemberIdSet = null) => {
    const uniqueRecords = new Map();

    attendance.forEach((record) => {
        if (meetingId !== null && record.meeting_id !== meetingId) return;
        if (activeMemberIdSet && !activeMemberIdSet.has(record.member_id)) return;

        const existing = uniqueRecords.get(record.member_id);
        if (!existing || getAttendanceRecordRank(record) >= getAttendanceRecordRank(existing)) {
            uniqueRecords.set(record.member_id, record);
        }
    });

    return Array.from(uniqueRecords.values());
};

export const getMeetingAttendanceStats = (attendance = [], meetingId = null, activeMemberIdSet = null) => {
    if (!meetingId) {
        return { direct: 0, proxy: 0, written: 0, election: 0, total: 0, participantTotal: 0 };
    }

    const uniqueRecords = getUniqueAttendanceRecords(attendance, meetingId, activeMemberIdSet);
    const direct = uniqueRecords.filter((record) => record.type === 'direct').length;
    const proxy = uniqueRecords.filter((record) => record.type === 'proxy').length;
    const written = uniqueRecords.filter((record) => record.type === 'written').length;
    const election = uniqueRecords.filter((record) => record.has_election).length;
    const participantTotal = uniqueRecords.filter((record) => record.type || record.has_election).length;

    return {
        direct,
        proxy,
        written,
        election,
        total: direct + proxy + written,
        participantTotal
    };
};

export const getAgendaAttendanceDisplayStats = ({
    agenda = null,
    meetingStats = null,
    meetingId = null,
    attendance = [],
    mailElectionVotes = [],
    activeMemberIdSet = null
} = {}) => {
    const baseStats = meetingStats || getMeetingAttendanceStats([], null, null);
    const isElectionAgenda = normalizeAgendaType(agenda?.type) === 'election';

    if (!isElectionAgenda || !agenda?.id) {
        return {
            ...baseStats,
            isElectionAgenda,
            fixedAttendanceLabel: '서면결의서',
            fixedAttendanceCount: baseStats.written,
            mailParticipantCount: 0,
            onsiteEligibleCount: baseStats.direct + baseStats.proxy
        };
    }

    const electionValidation = getElectionAgendaValidationStats({
        agenda,
        meetingId,
        attendance,
        mailElectionVotes,
        activeMemberIdSet
    });

    return {
        ...baseStats,
        isElectionAgenda,
        fixedAttendanceLabel: '우편투표',
        fixedAttendanceCount: electionValidation.actualMailVoteCount,
        mailParticipantCount: electionValidation.actualMailVoteCount,
        onsiteEligibleCount: electionValidation.onsiteEligibleCount,
        total: electionValidation.expectedTotalVotes
    };
};

export const getElectionAgendaValidationStats = ({
    agenda = null,
    meetingId = null,
    attendance = [],
    mailElectionVotes = [],
    activeMemberIdSet = null
} = {}) => {
    const emptyStats = {
        expectedMailVoteCount: 0,
        actualMailVoteCount: 0,
        missingMailVoteCount: 0,
        overlapMailVoteCount: 0,
        invalidProxyElectionCount: 0,
        onsiteEligibleCount: 0,
        expectedTotalVotes: 0,
        missingMailVoteMemberIds: [],
        overlapMailVoteMemberIds: [],
        invalidProxyElectionMemberIds: []
    };

    if (normalizeAgendaType(agenda?.type) !== 'election' || !agenda?.id || !meetingId) {
        return emptyStats;
    }

    const uniqueRecords = getUniqueAttendanceRecords(attendance, meetingId, activeMemberIdSet);
    const directElectionIds = new Set(
        uniqueRecords
            .filter((record) => record.type === 'direct' && record.has_election)
            .map((record) => record.member_id)
    );
    const proxyElectionIds = new Set(
        uniqueRecords
            .filter((record) => record.type === 'proxy' && record.has_election)
            .map((record) => record.member_id)
    );
    const expectedMailVoteIds = new Set(
        uniqueRecords
            .filter((record) => record.has_election && (record.type === 'written' || record.type === 'proxy' || !record.type))
            .map((record) => record.member_id)
    );

    const actualMailVoteIds = new Set();
    mailElectionVotes.forEach((vote) => {
        if (vote?.agenda_id !== agenda.id) return;
        if (activeMemberIdSet && !activeMemberIdSet.has(vote.member_id)) return;
        if (!['yes', 'no', 'abstain'].includes(vote?.choice)) return;
        actualMailVoteIds.add(vote.member_id);
    });

    const missingMailVoteMemberIds = [];
    expectedMailVoteIds.forEach((memberId) => {
        if (!actualMailVoteIds.has(memberId)) {
            missingMailVoteMemberIds.push(memberId);
        }
    });

    const overlapMailVoteMemberIds = [];
    actualMailVoteIds.forEach((memberId) => {
        if (directElectionIds.has(memberId)) {
            overlapMailVoteMemberIds.push(memberId);
        }
    });
    const invalidProxyElectionMemberIds = [];
    proxyElectionIds.forEach((memberId) => {
        if (!actualMailVoteIds.has(memberId)) {
            invalidProxyElectionMemberIds.push(memberId);
        }
    });

    const missingMailVoteCount = missingMailVoteMemberIds.length;
    const overlapMailVoteCount = overlapMailVoteMemberIds.length;
    const invalidProxyElectionCount = invalidProxyElectionMemberIds.length;
    const onsiteEligibleCount = directElectionIds.size;

    return {
        expectedMailVoteCount: expectedMailVoteIds.size,
        actualMailVoteCount: actualMailVoteIds.size,
        missingMailVoteCount,
        overlapMailVoteCount,
        invalidProxyElectionCount,
        missingMailVoteMemberIds,
        overlapMailVoteMemberIds,
        invalidProxyElectionMemberIds,
        onsiteEligibleCount,
        expectedTotalVotes: onsiteEligibleCount + actualMailVoteIds.size
    };
};
