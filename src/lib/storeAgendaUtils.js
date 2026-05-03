import {
    normalizeAgendaType,
    toVoteNumber,
    withLegacyVoteTotals
} from './storeSelectors';

export const applyWrittenVoteDeltaToAgendaList = (agendas = [], votes = [], delta = 1) => {
    if (!Array.isArray(votes) || !votes.length || !delta) return agendas;

    const agendaById = new Map(agendas.map((agenda) => [agenda.id, agenda]));
    const deltasByAgendaId = new Map();
    votes.forEach((vote) => {
        const agendaId = parseInt(vote?.agenda_id, 10);
        const choice = vote?.choice;
        if (!agendaId || !['yes', 'no', 'abstain'].includes(choice)) return;
        if (normalizeAgendaType(agendaById.get(agendaId)?.type) === 'election') return;

        const currentDelta = deltasByAgendaId.get(agendaId) || { yes: 0, no: 0, abstain: 0 };
        currentDelta[choice] += delta;
        deltasByAgendaId.set(agendaId, currentDelta);
    });

    if (!deltasByAgendaId.size) return agendas;

    return agendas.map((agenda) => {
        const agendaDelta = deltasByAgendaId.get(agenda.id);
        if (!agendaDelta) return agenda;

        const nextAgenda = {
            ...agenda,
            written_yes: Math.max(0, toVoteNumber(agenda.written_yes) + agendaDelta.yes),
            written_no: Math.max(0, toVoteNumber(agenda.written_no) + agendaDelta.no),
            written_abstain: Math.max(0, toVoteNumber(agenda.written_abstain) + agendaDelta.abstain),
            votes_yes: Math.max(0, toVoteNumber(agenda.votes_yes) + agendaDelta.yes),
            votes_no: Math.max(0, toVoteNumber(agenda.votes_no) + agendaDelta.no),
            votes_abstain: Math.max(0, toVoteNumber(agenda.votes_abstain) + agendaDelta.abstain)
        };

        return withLegacyVoteTotals(nextAgenda);
    });
};

export const getAgendaIdsForMeeting = (agendas = [], meetingId) => {
    if (!meetingId) return [];

    const meetingIndex = agendas.findIndex((agenda) => agenda.id === meetingId);
    if (meetingIndex === -1) return [];

    const agendaIds = [];
    for (let index = meetingIndex + 1; index < agendas.length; index += 1) {
        const agenda = agendas[index];
        if (agenda.type === 'folder') break;
        agendaIds.push(agenda.id);
    }

    return agendaIds;
};

export const getMeetingIdForAgenda = (agendas = [], agendaId) => {
    if (!agendaId) return null;

    const sortedAgendas = [...agendas].sort((left, right) => (Number(left?.order_index) || 0) - (Number(right?.order_index) || 0));
    const agendaIndex = sortedAgendas.findIndex((agenda) => agenda.id === agendaId);
    if (agendaIndex === -1) return null;

    for (let index = agendaIndex; index >= 0; index -= 1) {
        const agenda = sortedAgendas[index];
        if (agenda?.type === 'folder') {
            return agenda.id;
        }
    }

    return null;
};

export const buildWrittenVotePreviewPayload = (agendas = [], meetingId = null, votes = []) => {
    if (!meetingId) return [];

    const meetingAgendaIds = new Set(getAgendaIdsForMeeting(agendas, meetingId));
    const choiceByAgendaId = new Map();
    (votes || []).forEach((vote) => {
        const agendaId = parseInt(vote?.agenda_id, 10);
        const choice = vote?.choice;
        if (!agendaId || !['yes', 'no', 'abstain'].includes(choice)) return;
        choiceByAgendaId.set(agendaId, choice);
    });

    return agendas
        .filter((agenda) => (
            meetingAgendaIds.has(agenda.id)
            && agenda.type !== 'folder'
            && normalizeAgendaType(agenda.type) !== 'election'
            && [
                'written_yes',
                'written_no',
                'written_abstain',
                'onsite_yes',
                'onsite_no',
                'onsite_abstain'
            ].every((field) => Object.prototype.hasOwnProperty.call(agenda, field))
        ))
        .map((agenda) => ({
            agenda_id: agenda.id,
            choice: choiceByAgendaId.get(agenda.id) || 'yes'
        }));
};

export const applyMailElectionVotePreview = (mailElectionVotes = [], {
    memberId,
    meetingId,
    votes = [],
    action = 'upsert'
} = {}) => {
    if (!memberId || !meetingId || !Array.isArray(votes) || !votes.length) {
        return mailElectionVotes;
    }

    const normalizedVotes = votes
        .map((vote) => ({
            agenda_id: parseInt(vote?.agenda_id, 10),
            choice: vote?.choice
        }))
        .filter((vote) => vote.agenda_id && ['yes', 'no', 'abstain'].includes(vote.choice));

    if (!normalizedVotes.length) return mailElectionVotes;

    const targetAgendaIds = new Set(normalizedVotes.map((vote) => vote.agenda_id));
    const remainingVotes = mailElectionVotes.filter((vote) => !(
        vote?.member_id === memberId
        && vote?.meeting_id === meetingId
        && targetAgendaIds.has(vote?.agenda_id)
    ));

    if (action === 'remove') {
        return remainingVotes;
    }

    const createdAt = new Date().toISOString();
    const previewRows = normalizedVotes.map((vote) => ({
        id: `preview-mail-${meetingId}-${memberId}-${vote.agenda_id}`,
        member_id: memberId,
        meeting_id: meetingId,
        agenda_id: vote.agenda_id,
        choice: vote.choice,
        created_at: createdAt
    }));

    return [...remainingVotes, ...previewRows];
};

export const getKeyboardNavigableAgendaIds = (agendas = []) => {
    const groups = [];
    let currentGroup = { folder: null, items: [] };

    agendas.forEach((agenda) => {
        if (agenda.type === 'folder') {
            if (currentGroup.folder || currentGroup.items.length > 0) {
                groups.push(currentGroup);
            }
            currentGroup = { folder: agenda, items: [] };
            return;
        }

        currentGroup.items.push(agenda);
    });

    if (currentGroup.folder || currentGroup.items.length > 0) {
        groups.push(currentGroup);
    }

    return groups
        .reverse()
        .flatMap((group) => group.items.map((item) => item.id));
};

export const getAgendaTypeLocks = (voteData = {}) => {
    if (!voteData?.agendaTypeLocks || typeof voteData.agendaTypeLocks !== 'object') return {};
    return voteData.agendaTypeLocks;
};
