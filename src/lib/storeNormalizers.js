export const normalizeMemberPayload = (member = {}) => ({
    unit: String(member.unit || '').trim(),
    name: String(member.name || '').trim(),
    proxy: String(member.proxy || '').trim()
});

export const normalizeAttendanceBoolean = (value) => (
    value === true
    || value === 'true'
    || value === 1
    || value === '1'
);

export const normalizeAttendanceRecord = (record = {}) => ({
    ...record,
    type: record?.type || null,
    proxy_name: record?.proxy_name || null,
    has_election: normalizeAttendanceBoolean(record?.has_election),
    ballot_issued: normalizeAttendanceBoolean(record?.ballot_issued)
});

export const normalizeCheckInPayload = (inputOrType = 'direct', proxyName = null, votes = null) => {
    if (inputOrType && typeof inputOrType === 'object' && !Array.isArray(inputOrType)) {
        const rawMeetingType = String(inputOrType.meetingType || inputOrType.type || '').trim();
        const meetingType = ['direct', 'proxy', 'written'].includes(rawMeetingType) ? rawMeetingType : null;
        const normalizedProxyName = meetingType === 'proxy'
            ? (String(inputOrType.proxyName || '').trim() || null)
            : null;
        const writtenVotes = meetingType === 'written' && Array.isArray(inputOrType.writtenVotes)
            ? inputOrType.writtenVotes
            : [];
        const electionMode = ['none', 'onsite', 'mail'].includes(inputOrType.electionMode)
            ? inputOrType.electionMode
            : (inputOrType.hasElection ? 'onsite' : 'none');
        const electionVotes = electionMode === 'mail' && Array.isArray(inputOrType.electionVotes)
            ? inputOrType.electionVotes
            : [];
        const meetingId = inputOrType.meetingId || null;

        return {
            meetingId,
            meetingType,
            hasElection: electionMode !== 'none',
            electionMode,
            ballotIssued: !!inputOrType.ballotIssued,
            proxyName: normalizedProxyName,
            writtenVotes,
            electionVotes
        };
    }

    const meetingType = ['direct', 'proxy', 'written'].includes(inputOrType) ? inputOrType : null;

    return {
        meetingType,
        hasElection: false,
        electionMode: 'none',
        ballotIssued: false,
        proxyName: meetingType === 'proxy' ? (String(proxyName || '').trim() || null) : null,
        writtenVotes: meetingType === 'written' && Array.isArray(votes) ? votes : [],
        electionVotes: []
    };
};

export const sortMembersById = (members = []) => (
    [...members].sort((left, right) => (Number(left?.id) || 0) - (Number(right?.id) || 0))
);

export const upsertMemberInList = (members = [], nextMember) => {
    const nextMembers = members.filter((member) => member.id !== nextMember.id);
    nextMembers.push(nextMember);
    return sortMembersById(nextMembers);
};

export const areAttendanceListsEqual = (list1, list2) => {
    if (list1.length !== list2.length) return false;
    return list1.every((record, index) => (
        record.id === list2[index]?.id
        && record.type === list2[index]?.type
        && record.has_election === list2[index]?.has_election
        && record.proxy_name === list2[index]?.proxy_name
    ));
};

export const areAgendaListsEqual = (left = [], right = []) => {
    if (left === right) return true;
    if (left.length !== right.length) return false;

    return left.every((agenda, index) => {
        const other = right[index];
        if (!other) return false;

        const leftKeys = Object.keys(agenda);
        const rightKeys = Object.keys(other);
        if (leftKeys.length !== rightKeys.length) return false;

        return leftKeys.every((key) => agenda[key] === other[key]);
    });
};

export const areAgendaRecordsEqual = (left = {}, right = {}) => {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) return false;

    return leftKeys.every((key) => left[key] === right[key]);
};
