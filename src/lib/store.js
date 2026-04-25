'use client';

import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { supabase } from '@/lib/supabase';

export {
    buildDefaultDeclaration,
    calculateAgendaPass
} from './voteCalculations';

// Initial Empty Data (will be populated from DB)
const INITIAL_DATA = {
    agendas: [],
    members: [],
    attendance: [],
    mailElectionVotes: [],
    currentMeetingId: null, // Legacy/UI: Selected Folder(General Meeting) for Admin View
    activeMeetingId: null,  // New: GLOBALLY Active Meeting for Admission (controlled by Admin)
    voteData: {
        totalMembers: 0,
        directAttendance: 0,
        proxyAttendance: 0,
        writtenAttendance: 0,
        voteType: 'majority',
        votesYes: 0,
        votesNo: 0,
        votesAbstain: 0,
        customDeclaration: '',
        resultDeclaration: '',
        resultAgendaId: null,
        resultVotesYes: 0,
        resultVotesNo: 0,
        resultVotesAbstain: 0,
        resultTotalAttendance: 0,
        resultIsPassed: false,
        inactiveMemberIds: [],
        agendaTypeLocks: {},
        agendaOrderLocked: false,
    },
    currentAgendaId: 1,
    projectorMode: 'IDLE',
    projectorData: null,
    masterPresentationSource: null, // Global Master PPT
    projectorConnected: false, // New: Projector Online Status
    projectorConnectedCount: 0,
    // UI State for Declaration Editing (per-agenda map)
    declarationEditState: {}, // { [agendaId]: { isEditing: bool, isAutoCalc: bool } }
};

const WINDOW_SYNC_CHANNEL = 'votecast-system-settings-sync';
const WINDOW_SYNC_STORAGE_KEY = '__votecast_system_settings_sync__';
const WINDOW_AGENDAS_SYNC_CHANNEL = 'votecast-agendas-sync';
const WINDOW_AGENDAS_SYNC_STORAGE_KEY = '__votecast_agendas_sync__';
const PROJECTOR_SESSION_STORAGE_KEY = '__votecast_projector_session__';
const normalizeProjectorModeValue = (mode) => mode === 'ADJUSTING' ? 'RESULT' : (mode || 'IDLE');
const getVoteDataSyncVersion = (voteData = {}) => {
    const parsed = parseInt(voteData?.__syncVersion, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
};
const stampVoteDataWithSyncVersion = (voteData = {}, syncVersion) => ({
    ...voteData,
    __syncVersion: syncVersion
});
const readProjectorSessionState = () => {
    if (typeof window === 'undefined') return null;
    if (!window.location.pathname.startsWith('/projector')) return null;

    try {
        const raw = window.sessionStorage.getItem(PROJECTOR_SESSION_STORAGE_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;

        return {
            agendas: Array.isArray(parsed.agendas) ? parsed.agendas : INITIAL_DATA.agendas,
            voteData: { ...INITIAL_DATA.voteData, ...(parsed.voteData || {}) },
            currentAgendaId: parsed.currentAgendaId || INITIAL_DATA.currentAgendaId,
            projectorMode: normalizeProjectorModeValue(parsed.projectorMode),
            projectorData: Object.prototype.hasOwnProperty.call(parsed, 'projectorData')
                ? parsed.projectorData
                : INITIAL_DATA.projectorData,
            masterPresentationSource: parsed.masterPresentationSource || INITIAL_DATA.masterPresentationSource
        };
    } catch (error) {
        console.error('Failed to restore projector session state:', error);
        return null;
    }
};
const createInitialState = () => {
    const projectorSessionState = readProjectorSessionState();
    if (!projectorSessionState) return INITIAL_DATA;

    return {
        ...INITIAL_DATA,
        ...projectorSessionState,
        voteData: {
            ...INITIAL_DATA.voteData,
            ...(projectorSessionState.voteData || {})
        }
    };
};

const applyWrittenVoteDeltaToAgendaList = (agendas = [], votes = [], delta = 1) => {
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

const normalizeMemberPayload = (member = {}) => ({
    unit: String(member.unit || '').trim(),
    name: String(member.name || '').trim(),
    proxy: String(member.proxy || '').trim()
});

const normalizeAttendanceBoolean = (value) => (
    value === true
    || value === 'true'
    || value === 1
    || value === '1'
);

const normalizeAttendanceRecord = (record = {}) => ({
    ...record,
    type: record?.type || null,
    proxy_name: record?.proxy_name || null,
    has_election: normalizeAttendanceBoolean(record?.has_election)
});

const normalizeCheckInPayload = (inputOrType = 'direct', proxyName = null, votes = null) => {
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

        return {
            meetingType,
            hasElection: electionMode !== 'none',
            electionMode,
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
        proxyName: meetingType === 'proxy' ? (String(proxyName || '').trim() || null) : null,
        writtenVotes: meetingType === 'written' && Array.isArray(votes) ? votes : [],
        electionVotes: []
    };
};

const sortMembersById = (members = []) => (
    [...members].sort((left, right) => (Number(left?.id) || 0) - (Number(right?.id) || 0))
);

const upsertMemberInList = (members = [], nextMember) => {
    const nextMembers = members.filter((member) => member.id !== nextMember.id);
    nextMembers.push(nextMember);
    return sortMembersById(nextMembers);
};

const getInactiveMemberIds = (voteData = {}) => {
    if (!Array.isArray(voteData?.inactiveMemberIds)) return [];
    return voteData.inactiveMemberIds
        .map((value) => parseInt(value, 10))
        .filter((value) => !Number.isNaN(value));
};

const getAgendaTypeLocks = (voteData = {}) => {
    if (!voteData?.agendaTypeLocks || typeof voteData.agendaTypeLocks !== 'object') return {};
    return voteData.agendaTypeLocks;
};

const toVoteNumber = (value) => {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
};

const EMPTY_VOTE_TOTALS = Object.freeze({ yes: 0, no: 0, abstain: 0 });

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

const areAttendanceListsEqual = (list1, list2) => {
    if (list1.length !== list2.length) return false;
    return list1.every((record, index) => (
        record.id === list2[index]?.id
        && record.type === list2[index]?.type
        && record.has_election === list2[index]?.has_election
        && record.proxy_name === list2[index]?.proxy_name
    ));
};

const areAgendaListsEqual = (left = [], right = []) => {
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

const areAgendaRecordsEqual = (left = {}, right = {}) => {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) return false;

    return leftKeys.every((key) => left[key] === right[key]);
};

export const getMajorityThreshold = (count) => Math.floor((Number(count) || 0) / 2) + 1;
export const normalizeAgendaType = (type) => {
    if (type === 'general') return 'majority';
    if (type === 'special') return 'twoThirds';
    return type || 'majority';
};
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
const getElectionModeValidationMessage = (meetingType, electionMode) => {
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
const normalizeAgendaTypeForDb = (type) => {
    const normalized = normalizeAgendaType(type);
    if (['majority', 'twoThirds', 'election', 'folder'].includes(normalized)) {
        return normalized;
    }
    return 'majority';
};
const normalizeAgendaRecord = (agenda = {}, options = {}) => withLegacyVoteTotals({
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
            .filter((record) => record.type === 'direct')
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

const getAgendaIdsForMeeting = (agendas = [], meetingId) => {
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

const getMeetingIdForAgenda = (agendas = [], agendaId) => {
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

// Create Context
const StoreContext = createContext(null);

// Provider Component
export function StoreProvider({ children }) {
    const [state, setState] = useState(createInitialState);
    const [isInitialized, setIsInitialized] = useState(false);
    const isReorderingAgendasRef = useRef(false);
    const suppressAgendaRealtimeUntilRef = useRef(0);
    const stateRef = useRef(state);
    const pendingAttendanceOpsRef = useRef(new Set());
    const windowSyncIdRef = useRef(`window-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const broadcastChannelRef = useRef(null);
    const agendaBroadcastChannelRef = useRef(null);
    const attendanceSyncChannelRef = useRef(null);
    const lastAppliedSystemSyncVersionRef = useRef(getVoteDataSyncVersion(state.voteData));
    const nextSystemSyncVersionRef = useRef(getVoteDataSyncVersion(state.voteData));
    const lastAgendaSyncMessageAtRef = useRef(0);

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        if (!window.location.pathname.startsWith('/projector')) return undefined;

        const sessionSnapshot = {
            agendas: state.agendas,
            voteData: state.voteData,
            currentAgendaId: state.currentAgendaId,
            projectorMode: state.projectorMode,
            projectorData: state.projectorData,
            masterPresentationSource: state.masterPresentationSource
        };

        try {
            window.sessionStorage.setItem(PROJECTOR_SESSION_STORAGE_KEY, JSON.stringify(sessionSnapshot));
        } catch (error) {
            console.error('Failed to persist projector session state:', error);
        }

        return undefined;
    }, [state.agendas, state.currentAgendaId, state.masterPresentationSource, state.projectorData, state.projectorMode, state.voteData]);

    const getDefaultMeetingId = React.useCallback((agendas = []) => {
        if (agendas.length === 0) return null;

        const firstFolder = agendas.find((agenda) => agenda.type === 'folder');
        return firstFolder ? firstFolder.id : null;
    }, []);

    const createNextSystemSyncVersion = React.useCallback(() => {
        const nextVersion = Math.max(
            Date.now(),
            lastAppliedSystemSyncVersionRef.current + 1,
            nextSystemSyncVersionRef.current + 1
        );

        nextSystemSyncVersionRef.current = nextVersion;
        return nextVersion;
    }, []);

    const createStampedVoteData = React.useCallback((voteData = {}, syncVersion = createNextSystemSyncVersion()) => {
        lastAppliedSystemSyncVersionRef.current = Math.max(lastAppliedSystemSyncVersionRef.current, syncVersion);
        nextSystemSyncVersionRef.current = Math.max(nextSystemSyncVersionRef.current, syncVersion);
        return stampVoteDataWithSyncVersion(voteData, syncVersion);
    }, [createNextSystemSyncVersion]);

    const shouldApplySystemSettings = React.useCallback((settings, options = {}) => {
        const incomingVersion = getVoteDataSyncVersion(settings?.vote_data);
        const currentVersion = lastAppliedSystemSyncVersionRef.current;
        const { allowLegacyVersion = false } = options;

        if (incomingVersion === 0 && currentVersion > 0 && !allowLegacyVersion) {
            return false;
        }

        if (incomingVersion < currentVersion) {
            return false;
        }

        if (incomingVersion > 0) {
            lastAppliedSystemSyncVersionRef.current = incomingVersion;
            nextSystemSyncVersionRef.current = Math.max(nextSystemSyncVersionRef.current, incomingVersion);
        }

        return true;
    }, []);

    const applySystemSettingsToState = React.useCallback((settings, options = {}) => {
        if (!settings) return;
        if (!shouldApplySystemSettings(settings, options)) return;

        const {
            defaultMeetingId = null,
            preserveCurrentMeetingId = false,
            projectorData = Object.prototype.hasOwnProperty.call(settings, 'projector_data')
                ? settings.projector_data
                : null
        } = options;

        const normalizedProjectorMode = normalizeProjectorModeValue(settings.projector_mode);

        setState((prev) => ({
            ...prev,
            currentMeetingId: preserveCurrentMeetingId
                ? prev.currentMeetingId
                : (defaultMeetingId ?? prev.currentMeetingId),
            voteData: { ...INITIAL_DATA.voteData, ...(settings.vote_data || {}) },
            currentAgendaId: settings.current_agenda_id || 1,
            activeMeetingId: settings.active_meeting_id || null,
            projectorMode: normalizedProjectorMode,
            projectorData,
            masterPresentationSource: settings.master_presentation_source
        }));
    }, [shouldApplySystemSettings]);

    const refreshSystemSettingsFromDb = React.useCallback(async (options = {}) => {
        const { data: settings, error } = await supabase
            .from('system_settings')
            .select('*')
            .eq('id', 1)
            .single();

        if (error) {
            console.error('Failed to refresh system settings:', {
                message: error.message,
                status: error.status,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            return null;
        }

        if (settings.projector_mode === 'ADJUSTING') {
            await supabase
                .from('system_settings')
                .update({ projector_mode: 'RESULT' })
                .eq('id', 1);
            settings.projector_mode = 'RESULT';
        }

        applySystemSettingsToState(settings, options);
        return settings;
    }, [applySystemSettingsToState]);

    const createSystemSettingsSnapshot = React.useCallback((overrides = {}) => {
        const currentState = stateRef.current;
        const hasOwn = (key) => Object.prototype.hasOwnProperty.call(overrides, key);

        return {
            current_agenda_id: hasOwn('current_agenda_id') ? overrides.current_agenda_id : currentState.currentAgendaId,
            active_meeting_id: hasOwn('active_meeting_id') ? overrides.active_meeting_id : currentState.activeMeetingId,
            projector_mode: hasOwn('projector_mode') ? overrides.projector_mode : currentState.projectorMode,
            vote_data: hasOwn('vote_data') ? overrides.vote_data : currentState.voteData,
            master_presentation_source: hasOwn('master_presentation_source') ? overrides.master_presentation_source : currentState.masterPresentationSource,
            projector_data: hasOwn('projector_data') ? overrides.projector_data : currentState.projectorData
        };
    }, []);

    const broadcastSystemSettingsSync = React.useCallback((overrides = {}) => {
        if (typeof window === 'undefined') return;

        const message = {
            senderId: windowSyncIdRef.current,
            sentAt: Date.now(),
            settings: createSystemSettingsSnapshot(overrides)
        };

        try {
            broadcastChannelRef.current?.postMessage(message);
        } catch (error) {
            console.error('Failed to post BroadcastChannel sync message:', error);
        }

        try {
            window.localStorage.setItem(WINDOW_SYNC_STORAGE_KEY, JSON.stringify(message));
            window.localStorage.removeItem(WINDOW_SYNC_STORAGE_KEY);
        } catch (error) {
            console.error('Failed to write localStorage sync message:', error);
        }
    }, [createSystemSettingsSnapshot]);

    const broadcastAgendaRowsSync = React.useCallback((rows = []) => {
        if (typeof window === 'undefined') return;

        const message = {
            senderId: windowSyncIdRef.current,
            sentAt: Date.now(),
            agendas: rows
        };

        try {
            agendaBroadcastChannelRef.current?.postMessage(message);
        } catch (error) {
            console.error('Failed to post agenda BroadcastChannel sync message:', error);
        }

        try {
            window.localStorage.setItem(WINDOW_AGENDAS_SYNC_STORAGE_KEY, JSON.stringify(message));
            window.localStorage.removeItem(WINDOW_AGENDAS_SYNC_STORAGE_KEY);
        } catch (error) {
            console.error('Failed to write agenda localStorage sync message:', error);
        }
    }, []);

    useEffect(() => {
        if (!isInitialized || typeof window === 'undefined') return undefined;
        if (!window.location.pathname.startsWith('/projector')) return undefined;

        const pollId = window.setInterval(() => {
            refreshSystemSettingsFromDb({ preserveCurrentMeetingId: true });
        }, 1000);

        return () => {
            window.clearInterval(pollId);
        };
    }, [isInitialized, refreshSystemSettingsFromDb]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const applyIncomingWindowSync = (message) => {
            if (!message?.settings) return;
            if (message.senderId === windowSyncIdRef.current) return;
            if ((message.sentAt || 0) < lastAppliedSystemSyncVersionRef.current) return;

            applySystemSettingsToState(message.settings, {
                preserveCurrentMeetingId: true,
                projectorData: message.settings.projector_data ?? null
            });
        };

        if ('BroadcastChannel' in window) {
            const channel = new BroadcastChannel(WINDOW_SYNC_CHANNEL);
            broadcastChannelRef.current = channel;
            channel.onmessage = (event) => applyIncomingWindowSync(event.data);
        }

        const handleStorage = (event) => {
            if (event.key !== WINDOW_SYNC_STORAGE_KEY || !event.newValue) return;

            try {
                applyIncomingWindowSync(JSON.parse(event.newValue));
            } catch (error) {
                console.error('Failed to parse localStorage sync message:', error);
            }
        };

        window.addEventListener('storage', handleStorage);

        return () => {
            window.removeEventListener('storage', handleStorage);
            if (broadcastChannelRef.current) {
                broadcastChannelRef.current.close();
                broadcastChannelRef.current = null;
            }
        };
    }, [applySystemSettingsToState]);

    const applyAgendaRowsToState = React.useCallback((rows) => {
        if (!rows) return;

        setState((prev) => {
            const editingAgendaIds = Object.keys(prev.declarationEditState || {})
                .filter((id) => prev.declarationEditState[id]?.isEditing);

            const mergedAgendas = rows.map((agenda) => {
                const normalizedAgenda = normalizeAgendaRecord(agenda, {
                    mailElectionVotes: stateRef.current.mailElectionVotes
                });
                if (editingAgendaIds.includes(String(agenda.id))) {
                    const existingAgenda = prev.agendas.find((item) => item.id === agenda.id);
                    if (existingAgenda) {
                        return { ...normalizedAgenda, declaration: existingAgenda.declaration };
                    }
                }

                return normalizedAgenda;
            });

            if (areAgendaListsEqual(prev.agendas, mergedAgendas)) {
                return prev;
            }

            return { ...prev, agendas: mergedAgendas };
        });
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const applyIncomingAgendaSync = (message) => {
            if (!Array.isArray(message?.agendas)) return;
            if (message.senderId === windowSyncIdRef.current) return;
            if ((message.sentAt || 0) < lastAgendaSyncMessageAtRef.current) return;

            lastAgendaSyncMessageAtRef.current = message.sentAt || lastAgendaSyncMessageAtRef.current;

            applyAgendaRowsToState(message.agendas);
        };

        if ('BroadcastChannel' in window) {
            const channel = new BroadcastChannel(WINDOW_AGENDAS_SYNC_CHANNEL);
            agendaBroadcastChannelRef.current = channel;
            channel.onmessage = (event) => applyIncomingAgendaSync(event.data);
        }

        const handleStorage = (event) => {
            if (event.key !== WINDOW_AGENDAS_SYNC_STORAGE_KEY || !event.newValue) return;

            try {
                applyIncomingAgendaSync(JSON.parse(event.newValue));
            } catch (error) {
                console.error('Failed to parse agenda localStorage sync message:', error);
            }
        };

        window.addEventListener('storage', handleStorage);

        return () => {
            window.removeEventListener('storage', handleStorage);
            if (agendaBroadcastChannelRef.current) {
                agendaBroadcastChannelRef.current.close();
                agendaBroadcastChannelRef.current = null;
            }
        };
    }, [applyAgendaRowsToState]);

    const refreshAgendasFromDb = React.useCallback(async () => {
        const { data, error } = await supabase
            .from('agendas')
            .select('*')
            .order('order_index', { ascending: true });

        if (error) {
            console.error('Failed to refresh agendas:', error);
            return null;
        }

        applyAgendaRowsToState(data || []);
        return data;
    }, [applyAgendaRowsToState]);

    const refreshAttendanceFromDb = React.useCallback(async () => {
        const { data, error } = await supabase
            .from('attendance')
            .select('*');

        if (error) {
            console.error('Failed to refresh attendance:', error);
            return null;
        }

        const rows = (data || []).map(normalizeAttendanceRecord);
        setState((prev) => {
            if (areAttendanceListsEqual(prev.attendance, rows)) {
                return prev;
            }

            return {
                ...prev,
                attendance: rows
            };
        });

        return rows;
    }, []);

    const refreshMailElectionVotesFromDb = React.useCallback(async () => {
        const { data, error } = await supabase
            .from('mail_election_votes')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) {
            if (error.code === '42P01') {
                console.warn("Table 'mail_election_votes' not found yet. Skipping load.");
                return [];
            }
            console.error('Failed to refresh mail election votes:', error);
            return null;
        }

        const rows = data || [];
        setState((prev) => {
            if (
                prev.mailElectionVotes.length === rows.length
                && prev.mailElectionVotes.every((vote, index) => (
                    vote.id === rows[index]?.id
                    && vote.choice === rows[index]?.choice
                ))
            ) {
                return prev;
            }

            return {
                ...prev,
                mailElectionVotes: rows
            };
        });

        return rows;
    }, []);

    const reconcileAgendaVoteCountsFromWrittenVotes = React.useCallback(async (agendaRows = null) => {
        const agendasToCheck = Array.isArray(agendaRows) ? agendaRows : stateRef.current.agendas;
        const agendaContextRows = Array.isArray(agendaRows) && agendaRows.length > 1
            ? agendaRows
            : stateRef.current.agendas;
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

        const writtenAttendanceByMeetingId = new Map();
        if (targetMeetingIds.length) {
            const { data: writtenAttendanceRows, error: writtenAttendanceError } = await supabase
                .from('attendance')
                .select('meeting_id, member_id')
                .in('meeting_id', targetMeetingIds)
                .eq('type', 'written');

            if (writtenAttendanceError) {
                console.error('Failed to load written attendance for agenda reconciliation:', writtenAttendanceError);
                return false;
            }

            (writtenAttendanceRows || []).forEach((record) => {
                const meetingId = record?.meeting_id;
                const memberId = record?.member_id;
                if (!meetingId || !memberId) return;

                const memberIdSet = writtenAttendanceByMeetingId.get(meetingId) || new Set();
                memberIdSet.add(memberId);
                writtenAttendanceByMeetingId.set(meetingId, memberIdSet);
            });
        }

        const { data: writtenVotes, error } = await supabase
            .from('written_votes')
            .select('agenda_id, member_id, choice')
            .in('agenda_id', targetAgendaIds);

        if (error) {
            console.error('Failed to reconcile written vote counts:', error);
            return false;
        }

        const countsByAgendaId = new Map();
        const voteMemberIdsByAgendaId = new Map();
        (writtenVotes || []).forEach((vote) => {
            const currentCounts = countsByAgendaId.get(vote.agenda_id) || { yes: 0, no: 0, abstain: 0 };
            const currentMemberIds = voteMemberIdsByAgendaId.get(vote.agenda_id) || new Set();
            if (vote.choice === 'yes' || vote.choice === 'no' || vote.choice === 'abstain') {
                currentCounts[vote.choice] += 1;
            }
            if (vote?.member_id) {
                currentMemberIds.add(vote.member_id);
            }
            countsByAgendaId.set(vote.agenda_id, currentCounts);
            voteMemberIdsByAgendaId.set(vote.agenda_id, currentMemberIds);
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
            const { error: backfillError } = await supabase
                .from('written_votes')
                .upsert(missingVoteRows, {
                    onConflict: 'member_id,meeting_id,agenda_id',
                    ignoreDuplicates: true
                });

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

        suppressAgendaRealtimeUntilRef.current = Date.now() + 1500;

        for (const update of updates) {
            const { error: updateError } = await supabase
                .from('agendas')
                .update(update.fields)
                .eq('id', update.id);

            if (updateError) {
                console.error('Failed to sync agenda written vote totals:', update.id, updateError);
            }
        }

        return true;
    }, []);

    const syncAgendaForWrittenVote = React.useCallback(async (agendaId) => {
        if (!agendaId) return;

        const targetAgenda = stateRef.current.agendas.find((agenda) => agenda.id === agendaId);
        if (!targetAgenda) {
            // Agenda not in local state yet — just refresh everything
            await refreshAgendasFromDb();
            return;
        }

        // Reconcile acts as a safety net (e.g. if the RPC didn't update agendas)
        await reconcileAgendaVoteCountsFromWrittenVotes([targetAgenda]);
        // Always refresh local state from DB — the RPC may have already updated
        // agendas correctly (so reconcile found no mismatch), but our local
        // state still has the old values.
        await refreshAgendasFromDb();
    }, [reconcileAgendaVoteCountsFromWrittenVotes, refreshAgendasFromDb]);

    // Initial Fetch
    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data: agendas } = await supabase.from('agendas').select('*').order('order_index', { ascending: true });
                const { data: members } = await supabase.from('members').select('*').order('id', { ascending: true });
                const { data: attendance } = await supabase.from('attendance').select('*');
                const { data: mailElectionVotes, error: mailElectionVotesError } = await supabase.from('mail_election_votes').select('*').order('created_at', { ascending: true });
                let nextAgendas = (agendas || []).map((agenda) => normalizeAgendaRecord(agenda, {
                    mailElectionVotes: mailElectionVotes || []
                }));

                if (mailElectionVotesError && mailElectionVotesError.code !== '42P01') {
                    console.error('Failed to load mail election votes:', mailElectionVotesError);
                }

                const didReconcile = await reconcileAgendaVoteCountsFromWrittenVotes(nextAgendas);
                if (didReconcile) {
                    const { data: refreshedAgendas } = await supabase
                        .from('agendas')
                        .select('*')
                        .order('order_index', { ascending: true });
                    nextAgendas = (refreshedAgendas || nextAgendas).map((agenda) => normalizeAgendaRecord(agenda, {
                        mailElectionVotes: mailElectionVotes || []
                    }));
                }

                const defaultMeetingId = getDefaultMeetingId(nextAgendas);

                setState(prev => ({
                    ...prev,
                    agendas: nextAgendas,
                    members: members || [],
                    attendance: (attendance || []).map(normalizeAttendanceRecord),
                    mailElectionVotes: mailElectionVotes || []
                }));

                await refreshSystemSettingsFromDb({ defaultMeetingId, allowLegacyVersion: true });
                setIsInitialized(true);
            } catch (error) {
                console.error("Error fetching initial data:", error);
            }
        };

        fetchData();
    }, [getDefaultMeetingId, reconcileAgendaVoteCountsFromWrittenVotes, refreshSystemSettingsFromDb]);

    // Realtime Subscriptions
    useEffect(() => {
        const channel = supabase.channel('room_common')
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
                const { data } = await supabase.from('members').select('*').order('id', { ascending: true });
                if (data) setState(prev => ({ ...prev, members: data }));
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance' }, (payload) => {
                console.log('[Realtime] Attendance INSERT:', payload.new);
                setState(prev => {
                    // Remove potential optimistic record (deduplicate by composite key)
                    const cleanList = prev.attendance.filter(a =>
                        !(a.member_id === payload.new.member_id && a.meeting_id === payload.new.meeting_id)
                    );
                    return {
                        ...prev,
                        attendance: [...cleanList, normalizeAttendanceRecord(payload.new)]
                    };
                });
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'attendance' }, (payload) => {
                console.log('[Realtime] Attendance DELETE:', payload.old);
                setState(prev => ({
                    ...prev,
                    attendance: prev.attendance.filter(a => a.id !== payload.old.id)
                }));
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'attendance' }, (payload) => {
                console.log('[Realtime] Attendance UPDATE:', payload.new);
                setState(prev => ({
                    ...prev,
                    attendance: prev.attendance.map((a) => (
                        a.id === payload.new.id ? normalizeAttendanceRecord(payload.new) : a
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
                    // Bridge the boot-time race between initial load and realtime attach.
                    await refreshSystemSettingsFromDb({ preserveCurrentMeetingId: true });
                }
            });

        // New: Presence Channel for Projector Detection
        const presenceChannel = supabase.channel('room_presence', {
            config: {
                presence: {
                    key: 'admin',
                },
            },
        });

        presenceChannel
            .on('presence', { event: 'sync' }, () => {
                const newState = presenceChannel.presenceState();
                const projectorUsers = Object.values(newState)
                    .flat()
                    .filter((user) => user?.type === 'projector');
                const projectorConnectedCount = projectorUsers.length;
                const isConnected = projectorConnectedCount > 0;

                setState(prev => {
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

        // Fast Attendance Sync via Supabase Broadcast (sub-second, bypasses WAL latency)
        // Receives inline data — no DB refetch needed on the receiver side
        const attendanceSyncChannel = supabase.channel('attendance_sync')
            .on('broadcast', { event: 'attendance_insert' }, (msg) => {
                const rawRecord = msg.payload?.record;
                if (!rawRecord) return;
                const record = normalizeAttendanceRecord(rawRecord);
                console.log('[Broadcast] Attendance INSERT received:', record.member_id);
                setState(prev => {
                    const cleanList = prev.attendance.filter(a =>
                        !(a.member_id === record.member_id && a.meeting_id === record.meeting_id)
                    );
                    return { ...prev, attendance: [...cleanList, record] };
                });
            })
            .on('broadcast', { event: 'attendance_delete' }, (msg) => {
                const { memberId, meetingId } = msg.payload || {};
                if (!memberId || !meetingId) return;
                console.log('[Broadcast] Attendance DELETE received:', memberId);
                setState(prev => ({
                    ...prev,
                    attendance: prev.attendance.filter(a =>
                        !(a.member_id === memberId && a.meeting_id === meetingId)
                    )
                }));
            })
            .on('broadcast', { event: 'written_votes_preview' }, (msg) => {
                const votes = Array.isArray(msg.payload?.votes) ? msg.payload.votes : [];
                const delta = Number(msg.payload?.delta) || 0;
                if (!votes.length || !delta) return;
                console.log('[Broadcast] Written vote preview received:', delta, votes.length);
                setState(prev => ({
                    ...prev,
                    agendas: applyWrittenVoteDeltaToAgendaList(prev.agendas, votes, delta)
                }));
            })
            .on('broadcast', { event: 'written_votes_changed' }, async (msg) => {
                const meetingId = msg.payload?.meetingId || null;
                console.log('[Broadcast] Written votes changed — reconciling agendas', meetingId);

                const currentAgendas = stateRef.current.agendas;
                const targetAgendas = meetingId
                    ? currentAgendas.filter((agenda) => getAgendaIdsForMeeting(currentAgendas, meetingId).includes(agenda.id))
                    : currentAgendas;

                await reconcileAgendaVoteCountsFromWrittenVotes(targetAgendas);
                await refreshAgendasFromDb();
            })
            .on('broadcast', { event: 'mail_election_votes_changed' }, async () => {
                await refreshMailElectionVotesFromDb();
            })
            .subscribe();
        attendanceSyncChannelRef.current = attendanceSyncChannel;

        return () => {
            supabase.removeChannel(channel);
            supabase.removeChannel(presenceChannel);
            supabase.removeChannel(attendanceSyncChannel);
            attendanceSyncChannelRef.current = null;
        };
    }, [applySystemSettingsToState, reconcileAgendaVoteCountsFromWrittenVotes, refreshAgendasFromDb, refreshMailElectionVotesFromDb, refreshSystemSettingsFromDb, syncAgendaForWrittenVote]);

    // Visibility Change + Polling Fallback for Attendance
    // Handles mobile browser WebSocket disconnects (tab switch, screen lock, etc.)
    useEffect(() => {
        if (!isInitialized || typeof document === 'undefined') return undefined;

        let lastHiddenAt = 0;
        const STALE_THRESHOLD_MS = 3000; // Only refetch if hidden for 3+ seconds
        const POLL_INTERVAL_MS = 2000; // Poll every 2s — primary sync mechanism

        const refetchAttendance = async () => {
            const { data } = await supabase.from('attendance').select('*');
            if (data) {
                setState(prev => {
                    const normalizedAttendance = data.map(normalizeAttendanceRecord);
                    if (areAttendanceListsEqual(prev.attendance, normalizedAttendance)) {
                        return prev;
                    }
                    return { ...prev, attendance: normalizedAttendance };
                });
            }
            await refreshMailElectionVotesFromDb();
        };

        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'hidden') {
                lastHiddenAt = Date.now();
                return;
            }

            // Tab is now visible again
            const hiddenDuration = lastHiddenAt > 0 ? Date.now() - lastHiddenAt : 0;
            if (hiddenDuration < STALE_THRESHOLD_MS) return;

            console.log(`[Visibility] Tab restored after ${Math.round(hiddenDuration / 1000)}s — refetching attendance`);
            await refetchAttendance();
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Lightweight poll as Realtime fallback (only when tab is visible)
        const pollId = window.setInterval(() => {
            if (document.visibilityState === 'visible') {
                refetchAttendance();
            }
        }, POLL_INTERVAL_MS);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.clearInterval(pollId);
        };
    }, [isInitialized, refreshMailElectionVotesFromDb]);

    // Polling Fallback for Written Vote Reconciliation
    // Same pattern as attendance polling — guarantees written vote counts stay in sync
    // even when Supabase Realtime (postgres_changes) fails to deliver events.
    useEffect(() => {
        if (!isInitialized || typeof document === 'undefined') return undefined;

        const RECONCILE_POLL_MS = 3000; // Poll every 3s

        const reconcileWrittenVotes = async () => {
            const currentAgendas = stateRef.current.agendas;
            if (!currentAgendas.length) return;

            const didReconcile = await reconcileAgendaVoteCountsFromWrittenVotes(currentAgendas);
            if (didReconcile) {
                await refreshAgendasFromDb();
            }
        };

        const pollId = window.setInterval(() => {
            if (document.visibilityState === 'visible') {
                reconcileWrittenVotes();
            }
        }, RECONCILE_POLL_MS);

        return () => window.clearInterval(pollId);
    }, [isInitialized, reconcileAgendaVoteCountsFromWrittenVotes, refreshAgendasFromDb]);

    const setAgendaById = React.useCallback(async (id) => {
        console.log('[setAgenda] Called with ID:', id);

        const targetAgenda = stateRef.current.agendas.find(a => a.id === id);
        if (!targetAgenda) {
            console.log('[setAgenda] ERROR: targetAgenda not found!');
            return;
        }

        let newType = targetAgenda.type || 'majority';
        if (newType === 'general') newType = 'majority';
        if (newType === 'special') newType = 'twoThirds';

        const vData = stateRef.current.voteData || {};
        const currentMembers = stateRef.current.members || [];
        const inactiveMemberIdSet = new Set(getInactiveMemberIds(vData));
        const activeMemberIdSet = new Set(
            currentMembers
                .filter((member) => member.is_active !== false && !inactiveMemberIdSet.has(member.id))
                .map((member) => member.id)
        );
        let targetMeetingId = null;
        if (targetAgenda.type === 'folder') {
            targetMeetingId = targetAgenda.id;
        } else {
            const targetIndex = stateRef.current.agendas.findIndex((agenda) => agenda.id === targetAgenda.id);
            for (let i = targetIndex - 1; i >= 0; i -= 1) {
                if (stateRef.current.agendas[i].type === 'folder') {
                    targetMeetingId = stateRef.current.agendas[i].id;
                    break;
                }
            }
        }
        const meetingStats = getMeetingAttendanceStats(stateRef.current.attendance, targetMeetingId, activeMemberIdSet);
        const attendanceStats = getAgendaAttendanceDisplayStats({
            agenda: targetAgenda,
            meetingStats,
            mailElectionVotes: stateRef.current.mailElectionVotes,
            activeMemberIdSet
        });
        const total = attendanceStats.total;
        const criterion = newType === 'twoThirds' ? "3분의 2 이상" : "과반수 이상";
        const voteBuckets = getAgendaVoteBuckets(targetAgenda, {
            mailElectionVotes: stateRef.current.mailElectionVotes,
            activeMemberIdSet
        });
        const votesYes = voteBuckets.final.yes;
        const votesNo = voteBuckets.final.no;
        const votesAbstain = voteBuckets.final.abstain;
        const isElectionStore = voteBuckets.fixedLabel === '우편투표';
        const attendancePrefix = isElectionStore
            ? `우편투표를 포함한 총 ${total.toLocaleString()}명 중`
            : `서면결의서를 포함한 총 ${total.toLocaleString()}명 중`;

        const defaultDecl = total > 0 ? `"${targetAgenda.title}"은 ${attendancePrefix}
찬성 ${votesYes}표, 반대 ${votesNo}표, 기권 ${votesAbstain}표인 ${criterion} 찬성으로
"${targetAgenda.title}"은 가결되었음을 선포합니다.` : "";


        const newVoteData = createStampedVoteData({
            ...vData,
            voteType: newType,
            customDeclaration: defaultDecl,
            presentationPage: targetAgenda.start_page || 1
        });

        console.log('[setAgenda] Setting currentAgendaId to:', id);

        setState(prev => ({
            ...prev,
            currentAgendaId: id,
            voteData: newVoteData
        }));

        const { error } = await supabase.from('system_settings').update({
            current_agenda_id: id,
            vote_data: newVoteData
        }).eq('id', 1);

        if (error) console.error("Set Agenda Error:", error);
        else {
            broadcastSystemSettingsSync({
                current_agenda_id: id,
                vote_data: newVoteData
            });
        }
    }, [broadcastSystemSettingsSync, createStampedVoteData]);

    // Actions
    const actions = React.useMemo(() => ({
        // Local Admin View Switcher
        setMeetingId: (id) => {
            setState(prev => ({ ...prev, currentMeetingId: id }));
        },

        // Global Admission Control (Admin Only)
        setActiveMeeting: async (id) => {
            // Optimistic
            setState(prev => ({ ...prev, activeMeetingId: id }));
            // DB Update
            const { error } = await supabase.from('system_settings')
                .update({ active_meeting_id: id })
                .eq('id', 1);
            if (error) console.error("Failed to set active meeting:", error);
            else {
                broadcastSystemSettingsSync({ active_meeting_id: id });
            }
        },

        checkInMember: async (memberId, typeOrPayload = 'direct', proxyName = null, votes = null) => {
            // USE ACTIVE MEETING ID (Global)
            const meetingId = stateRef.current.activeMeetingId;
            if (!meetingId) {
                console.error("No active meeting open for admission.");
                return { ok: false, error: new Error('활성 총회가 없습니다.') }; // Block check-in if no meeting is active
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

            const {
                meetingType,
                hasElection,
                electionMode,
                proxyName: normalizedProxyName,
                writtenVotes,
                electionVotes
            } = normalizeCheckInPayload(typeOrPayload, proxyName, votes);

            if (!meetingType && !hasElection) {
                console.error("Check-in payload must include a meeting type or election participation.");
                return { ok: false, error: new Error('총회 상태 또는 선거 참여를 하나 이상 선택해야 합니다.') };
            }
            if (!isElectionModeAllowedForMeetingType(meetingType, electionMode)) {
                return { ok: false, error: new Error(getElectionModeValidationMessage(meetingType, electionMode)) };
            }

            pendingAttendanceOpsRef.current.add(attendanceKey);
            const agendaTypeById = new Map(stateRef.current.agendas.map((agenda) => [agenda.id, normalizeAgendaType(agenda?.type)]));
            const writtenVotePayload = (meetingType === 'written' ? writtenVotes : []).filter((vote) => (
                agendaTypeById.get(vote?.agenda_id) && agendaTypeById.get(vote.agenda_id) !== 'election'
            ));
            const electionVotePayload = (electionMode === 'mail' ? electionVotes : []).filter((vote) => (
                agendaTypeById.get(vote?.agenda_id) === 'election'
            ));
            let didApplyWrittenPreview = false;

            try {
                // Optimistic Update (Attendance Only)
                const tempId = Date.now();
                const newRecord = normalizeAttendanceRecord({
                    id: tempId,
                    member_id: memberId,
                    meeting_id: meetingId,
                    type: meetingType,
                    has_election: hasElection,
                    proxy_name: normalizedProxyName,
                    created_at: new Date().toISOString()
                });

                setState(prev => ({
                    ...prev,
                    attendance: [...prev.attendance, newRecord]
                }));

                if (writtenVotePayload.length) {
                    setState(prev => ({
                        ...prev,
                        agendas: applyWrittenVoteDeltaToAgendaList(prev.agendas, writtenVotePayload, 1)
                    }));
                    attendanceSyncChannelRef.current?.send({
                        type: 'broadcast',
                        event: 'written_votes_preview',
                        payload: { meetingId, votes: writtenVotePayload, delta: 1 }
                    });
                    didApplyWrittenPreview = true;
                }

                // Broadcast to other clients BEFORE RPC (RPC can be slow)
                attendanceSyncChannelRef.current?.send({
                    type: 'broadcast',
                    event: 'attendance_insert',
                    payload: { record: newRecord }
                });

                // Use RPC for Transactional Check-in (with Votes)
                // Even if no votes, RPC handles attendance insert safely.
                const { error } = await supabase.rpc('check_in_member', {
                    p_member_id: memberId,
                    p_meeting_id: meetingId,
                    p_type: meetingType,
                    p_has_election: hasElection,
                    p_proxy_name: normalizedProxyName,
                    p_votes: writtenVotePayload.length ? writtenVotePayload : null,
                    p_election_votes: electionVotePayload.length ? electionVotePayload : null
                });

                if (error) {
                    // If RPC fails (e.g., function not found), try fallback only if NO votes
                    if (error.code === '42883' && !writtenVotePayload.length && !electionVotePayload.length) { // undefined_function
                        console.warn("RPC 'check_in_member' not found. Falling back to simple insert.");
                        const { error: fallbackError } = await supabase.from('attendance').insert({
                            member_id: memberId,
                            meeting_id: meetingId,
                            type: meetingType,
                            has_election: hasElection,
                            proxy_name: normalizedProxyName
                        });
                        if (fallbackError) {
                            console.error("Fallback Check-in Failed:", fallbackError);
                            // Rollback
                            setState(prev => ({
                                ...prev,
                                attendance: prev.attendance.filter(a => a.id !== tempId)
                            }));
                            if (didApplyWrittenPreview) {
                                setState(prev => ({
                                    ...prev,
                                    agendas: applyWrittenVoteDeltaToAgendaList(prev.agendas, writtenVotePayload, -1)
                                }));
                                attendanceSyncChannelRef.current?.send({
                                    type: 'broadcast',
                                    event: 'written_votes_preview',
                                        payload: { meetingId, votes: writtenVotePayload, delta: -1 }
                                    });
                                }
                            return { ok: false, error: fallbackError };
                        }
                    } else {
                        console.error("Check-in Transaction Failed:", error);
                        // Rollback
                        setState(prev => ({
                            ...prev,
                            attendance: prev.attendance.filter(a => a.id !== tempId)
                        }));
                        if (didApplyWrittenPreview) {
                            setState(prev => ({
                                ...prev,
                                agendas: applyWrittenVoteDeltaToAgendaList(prev.agendas, writtenVotePayload, -1)
                            }));
                            attendanceSyncChannelRef.current?.send({
                                type: 'broadcast',
                                event: 'written_votes_preview',
                                payload: { meetingId, votes: writtenVotePayload, delta: -1 }
                            });
                        }
                        return { ok: false, error };
                    }
                }



                if (meetingType === 'written') {
                    // Reconcile as safety net (in case deployed RPC doesn't update agendas)
                    const meetingAgendaIds = getAgendaIdsForMeeting(stateRef.current.agendas, meetingId);
                    const meetingAgendas = stateRef.current.agendas.filter((agenda) => meetingAgendaIds.includes(agenda.id));
                    await reconcileAgendaVoteCountsFromWrittenVotes(meetingAgendas);

                    // Broadcast to ALL other clients so they refresh agendas instantly
                    attendanceSyncChannelRef.current?.send({
                        type: 'broadcast',
                        event: 'written_votes_changed',
                        payload: { meetingId }
                    });
                }

                if (electionVotePayload.length) {
                    await refreshMailElectionVotesFromDb();
                    attendanceSyncChannelRef.current?.send({
                        type: 'broadcast',
                        event: 'mail_election_votes_changed',
                        payload: { meetingId }
                    });
                }

                await refreshAgendasFromDb();
                return { ok: true };
            } finally {
                pendingAttendanceOpsRef.current.delete(attendanceKey);
            }
        },

        getCheckInDetails: async (memberId) => {
            const meetingId = stateRef.current.activeMeetingId;
            if (!meetingId || !memberId) {
                return null;
            }

            const attendanceRecord = getUniqueAttendanceRecords(stateRef.current.attendance, meetingId, null)
                .find((record) => record.member_id === memberId) || null;

            const [{ data: writtenVoteRows, error: writtenVoteError }, { data: electionVoteRows, error: electionVoteError }] = await Promise.all([
                supabase
                    .from('written_votes')
                    .select('agenda_id, choice')
                    .eq('member_id', memberId)
                    .eq('meeting_id', meetingId),
                supabase
                    .from('mail_election_votes')
                    .select('agenda_id, choice')
                    .eq('member_id', memberId)
                    .eq('meeting_id', meetingId)
            ]);

            if (writtenVoteError) {
                throw writtenVoteError;
            }
            if (electionVoteError && electionVoteError.code !== '42P01') {
                throw electionVoteError;
            }

            const writtenVotes = {};
            (writtenVoteRows || []).forEach((vote) => {
                if (vote?.agenda_id && ['yes', 'no', 'abstain'].includes(vote?.choice)) {
                    writtenVotes[vote.agenda_id] = vote.choice;
                }
            });

            const electionVotes = {};
            (electionVoteRows || []).forEach((vote) => {
                if (vote?.agenda_id && ['yes', 'no', 'abstain'].includes(vote?.choice)) {
                    electionVotes[vote.agenda_id] = vote.choice;
                }
            });

            return {
                attendanceRecord,
                meetingType: attendanceRecord?.type || 'none',
                electionMode: attendanceRecord?.has_election
                    ? ((electionVoteRows || []).length ? 'mail' : 'onsite')
                    : 'none',
                proxyName: attendanceRecord?.proxy_name || '',
                writtenVotes,
                electionVotes
            };
        },

        replaceCheckInMember: async (memberId, typeOrPayload = 'direct', proxyName = null, votes = null) => {
            const meetingId = stateRef.current.activeMeetingId;
            if (!meetingId) {
                console.error("No active meeting open for admission.");
                return { ok: false, error: new Error('활성 총회가 없습니다.') };
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

            const {
                meetingType,
                hasElection,
                electionMode,
                proxyName: normalizedProxyName,
                writtenVotes,
                electionVotes
            } = normalizeCheckInPayload(typeOrPayload, proxyName, votes);

            if (!meetingType && !hasElection) {
                return { ok: false, error: new Error('총회 상태 또는 선거 참여를 하나 이상 선택해야 합니다.') };
            }
            if (!isElectionModeAllowedForMeetingType(meetingType, electionMode)) {
                return { ok: false, error: new Error(getElectionModeValidationMessage(meetingType, electionMode)) };
            }

            const agendaTypeById = new Map(stateRef.current.agendas.map((agenda) => [agenda.id, normalizeAgendaType(agenda?.type)]));
            const writtenVotePayload = (meetingType === 'written' ? writtenVotes : []).filter((vote) => (
                agendaTypeById.get(vote?.agenda_id) && agendaTypeById.get(vote.agenda_id) !== 'election'
            ));
            const electionVotePayload = (electionMode === 'mail' ? electionVotes : []).filter((vote) => (
                agendaTypeById.get(vote?.agenda_id) === 'election'
            ));

            pendingAttendanceOpsRef.current.add(attendanceKey);

            try {
                let error = null;
                const { error: replaceError } = await supabase.rpc('replace_check_in_member', {
                    p_member_id: memberId,
                    p_meeting_id: meetingId,
                    p_type: meetingType,
                    p_has_election: hasElection,
                    p_proxy_name: normalizedProxyName,
                    p_votes: writtenVotePayload.length ? writtenVotePayload : null,
                    p_election_votes: electionVotePayload.length ? electionVotePayload : null
                });
                error = replaceError;

                if (error && error.code === '42883') {
                    const { error: cancelError } = await supabase.rpc('cancel_check_in_member', {
                        p_member_id: memberId,
                        p_meeting_id: meetingId
                    });
                    if (!cancelError) {
                        const { error: checkInError } = await supabase.rpc('check_in_member', {
                            p_member_id: memberId,
                            p_meeting_id: meetingId,
                            p_type: meetingType,
                            p_has_election: hasElection,
                            p_proxy_name: normalizedProxyName,
                            p_votes: writtenVotePayload.length ? writtenVotePayload : null,
                            p_election_votes: electionVotePayload.length ? electionVotePayload : null
                        });
                        error = checkInError;
                    } else {
                        error = cancelError;
                    }
                }

                if (error) {
                    console.error('Replace Check-in Failed:', error);
                    return { ok: false, error };
                }

                await Promise.all([
                    refreshAttendanceFromDb(),
                    refreshAgendasFromDb(),
                    refreshMailElectionVotesFromDb()
                ]);

                attendanceSyncChannelRef.current?.send({
                    type: 'broadcast',
                    event: 'attendance_replace',
                    payload: { memberId, meetingId }
                });
                attendanceSyncChannelRef.current?.send({
                    type: 'broadcast',
                    event: 'written_votes_changed',
                    payload: { meetingId }
                });
                attendanceSyncChannelRef.current?.send({
                    type: 'broadcast',
                    event: 'mail_election_votes_changed',
                    payload: { meetingId }
                });

                return { ok: true };
            } finally {
                pendingAttendanceOpsRef.current.delete(attendanceKey);
            }
        },

        cancelCheckInMember: async (memberId) => {
            // Cancel from the ACTIVE meeting context
            const meetingId = stateRef.current.activeMeetingId;
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
            let didApplyWrittenPreview = false;

            try {
                if (hadWrittenAttendance) {
                    const { data: existingWrittenVotes } = await supabase
                        .from('written_votes')
                        .select('agenda_id, choice')
                        .eq('member_id', memberId)
                        .eq('meeting_id', meetingId);
                    writtenVotePayload = Array.isArray(existingWrittenVotes) ? existingWrittenVotes : [];
                }

                if (hadElectionAttendance) {
                    await refreshMailElectionVotesFromDb();
                }

                setState(prev => ({
                    ...prev,
                    attendance: prev.attendance.filter(a => !(a.member_id === memberId && a.meeting_id === meetingId))
                }));

                if (writtenVotePayload.length) {
                    setState(prev => ({
                        ...prev,
                        agendas: applyWrittenVoteDeltaToAgendaList(prev.agendas, writtenVotePayload, -1)
                    }));
                    attendanceSyncChannelRef.current?.send({
                        type: 'broadcast',
                        event: 'written_votes_preview',
                        payload: { meetingId, votes: writtenVotePayload, delta: -1 }
                    });
                    didApplyWrittenPreview = true;
                }

                // Broadcast to other clients BEFORE RPC (RPC can be slow)
                attendanceSyncChannelRef.current?.send({
                    type: 'broadcast',
                    event: 'attendance_delete',
                    payload: { memberId, meetingId }
                });

                // Use RPC to Cancel (and reverse votes)
                const { error } = await supabase.rpc('cancel_check_in_member', {
                    p_member_id: memberId,
                    p_meeting_id: meetingId
                });

                if (error) {
                    // Fallback for simple delete if RPC missing
                    if (error.code === '42883') {
                        console.warn("RPC 'cancel_check_in_member' not found. Falling back to simple delete.");
                        const { error: fallbackError } = await supabase.from('attendance')
                            .delete()
                            .eq('member_id', memberId)
                            .eq('meeting_id', meetingId);
                        if (fallbackError) {
                            console.error("Fallback Cancel Check-in Failed:", fallbackError);
                            if (didApplyWrittenPreview) {
                                setState(prev => ({
                                    ...prev,
                                    agendas: applyWrittenVoteDeltaToAgendaList(prev.agendas, writtenVotePayload, 1)
                                }));
                                attendanceSyncChannelRef.current?.send({
                                    type: 'broadcast',
                                    event: 'written_votes_preview',
                                    payload: { meetingId, votes: writtenVotePayload, delta: 1 }
                                });
                            }
                            return;
                        }
                    } else {
                        console.error("Cancel Check-in Failed:", error);
                        if (didApplyWrittenPreview) {
                            setState(prev => ({
                                ...prev,
                                agendas: applyWrittenVoteDeltaToAgendaList(prev.agendas, writtenVotePayload, 1)
                            }));
                            attendanceSyncChannelRef.current?.send({
                                type: 'broadcast',
                                event: 'written_votes_preview',
                                payload: { meetingId, votes: writtenVotePayload, delta: 1 }
                            });
                        }
                        return;
                    }
                }



                if (hadWrittenAttendance) {
                    // Reconcile as safety net (in case deployed RPC doesn't update agendas)
                    const meetingAgendaIds = getAgendaIdsForMeeting(stateRef.current.agendas, meetingId);
                    const meetingAgendas = stateRef.current.agendas.filter((agenda) => meetingAgendaIds.includes(agenda.id));
                    await reconcileAgendaVoteCountsFromWrittenVotes(meetingAgendas);

                    // Broadcast to ALL other clients so they refresh agendas instantly
                    attendanceSyncChannelRef.current?.send({
                        type: 'broadcast',
                        event: 'written_votes_changed',
                        payload: { meetingId }
                    });
                }

                if (hadElectionAttendance) {
                    await refreshMailElectionVotesFromDb();
                    attendanceSyncChannelRef.current?.send({
                        type: 'broadcast',
                        event: 'mail_election_votes_changed',
                        payload: { meetingId }
                    });
                }

                await refreshAgendasFromDb();
            } finally {
                pendingAttendanceOpsRef.current.delete(attendanceKey);
            }
        },

        addAgenda: async (newAgenda, insertAfterOrderIndex = null) => {
            // Optimistic ID (temp) - ensuring it doesn't collide with real IDs (usually small integers)
            const tempId = Date.now();

            let autoType = normalizeAgendaTypeForDb(newAgenda.type || 'majority');
            if (newAgenda.title && (newAgenda.title.includes('선출') || newAgenda.title.includes('선거'))) {
                autoType = 'election';
            }

            let newOrderIndex;

            if (insertAfterOrderIndex !== null) {
                // Insertion Mode
                newOrderIndex = insertAfterOrderIndex + 1;

                // 1. Optimistic Update: Shift local state
                setState(prev => {
                    const sorted = [...prev.agendas].sort((a, b) => a.order_index - b.order_index);
                    const updated = sorted.map(a => a.order_index >= newOrderIndex ? { ...a, order_index: a.order_index + 1 } : a);
                    updated.push({ ...newAgenda, type: autoType, id: tempId, order_index: newOrderIndex });
                    return { ...prev, agendas: updated.sort((a, b) => a.order_index - b.order_index) };
                });

                // 2. Client Side Shift in DB
                // Fetch all items that need shifting, ORDER BY DESC to avoid unique constraint collisions (shift last items first)
                const { data: allAgendas } = await supabase
                    .from('agendas')
                    .select('id, order_index')
                    .gte('order_index', newOrderIndex)
                    .order('order_index', { ascending: false });

                if (allAgendas && allAgendas.length > 0) {
                    for (const item of allAgendas) {
                        const { error: moveError } = await supabase.from('agendas').update({ order_index: item.order_index + 1 }).eq('id', item.id);
                        if (moveError) console.error("Failed to shift agenda:", item.id, moveError);
                    }
                }
            } else {
                // Append Mode
                const { data: maxOrder } = await supabase.from('agendas').select('order_index').order('order_index', { ascending: false }).limit(1);
                newOrderIndex = (maxOrder?.[0]?.order_index || 0) + 1;

                // Optimistic Append
                setState(prev => ({
                    ...prev,
                    agendas: [...prev.agendas, { ...newAgenda, type: autoType, id: tempId, order_index: newOrderIndex }]
                }));
            }

            // Generate Manual ID (DB missing sequence)
            const { data: maxIdResult } = await supabase.from('agendas').select('id').order('id', { ascending: false }).limit(1);
            const nextId = (maxIdResult?.[0]?.id || 0) + 1;

            // Insert into DB (Let DB handle ID)
            const { data: insertedData, error } = await supabase.from('agendas').insert({
                ...newAgenda,
                id: nextId,
                type: autoType,
                order_index: newOrderIndex
            }).select().single();

            if (insertedData) {
                // Replace temp ID with real ID in local state to prevent "flash" or ref issues
                setState(prev => ({
                    ...prev,
                    agendas: prev.agendas.map(a => a.id === tempId ? insertedData : a)
                }));
            } else if (error) {
                console.error("Failed to add agenda:", JSON.stringify(error, null, 2));
                // Rollback optimistic update
                setState(prev => ({
                    ...prev,
                    agendas: prev.agendas.filter(a => a.id !== tempId)
                }));
            }
        },

        updateAgenda: async (updatedAgenda) => {
            const currentAgenda = stateRef.current.agendas.find(a => a.id === updatedAgenda.id) || {};
            const normalizedUpdatedAgenda = Object.prototype.hasOwnProperty.call(updatedAgenda, 'type')
                ? { ...updatedAgenda, type: normalizeAgendaTypeForDb(updatedAgenda.type) }
                : updatedAgenda;
            const mergedAgenda = { ...currentAgenda, ...normalizedUpdatedAgenda };
            const normalizedAgenda = withLegacyVoteTotals(mergedAgenda, {
                mailElectionVotes: stateRef.current.mailElectionVotes
            });
            if (areAgendaRecordsEqual(currentAgenda, normalizedAgenda)) {
                return { ok: true, skipped: true };
            }

            let nextAgendas = null;
            setState(prev => ({
                ...prev,
                agendas: (() => {
                    nextAgendas = prev.agendas.map((agenda) => (
                        agenda.id === updatedAgenda.id ? { ...agenda, ...normalizedAgenda } : agenda
                    ));
                    return nextAgendas;
                })()
            }));
            if (nextAgendas) {
                broadcastAgendaRowsSync(nextAgendas);
            }

            // Only send explicitly changed fields to the DB (NOT all agenda fields).
            // This prevents accidental overwrites of written_yes/no/abstain columns,
            // which are managed exclusively by the check_in_member RPC and reconcile logic.
            const { id, ...passedFields } = normalizedUpdatedAgenda;
            const dbFields = { ...passedFields };

            // When onsite vote fields change, include the derived votes_* totals
            const onsiteVoteFields = ['onsite_yes', 'onsite_no', 'onsite_abstain'];
            const legacyVoteFields = ['votes_yes', 'votes_no', 'votes_abstain'];
            const hasOnsiteChange = onsiteVoteFields.some(f => Object.prototype.hasOwnProperty.call(passedFields, f));
            const hasLegacyChange = legacyVoteFields.some(f => Object.prototype.hasOwnProperty.call(passedFields, f));

            if (hasOnsiteChange) {
                // Recompute legacy totals from the merged (up-to-date) values
                dbFields.votes_yes = normalizedAgenda.votes_yes;
                dbFields.votes_no = normalizedAgenda.votes_no;
                dbFields.votes_abstain = normalizedAgenda.votes_abstain;
            } else if (hasLegacyChange) {
                // Non-split mode: use the values as-is from the merged agenda
                dbFields.votes_yes = normalizedAgenda.votes_yes;
                dbFields.votes_no = normalizedAgenda.votes_no;
                dbFields.votes_abstain = normalizedAgenda.votes_abstain;
            }

            suppressAgendaRealtimeUntilRef.current = Date.now() + 1000;
            const { error } = await supabase.from('agendas').update(dbFields).eq('id', id);
            if (error) {
                console.error("FAILED to update Agenda:", error);
                let revertedAgendas = null;
                setState(prev => ({
                    ...prev,
                    agendas: (() => {
                        revertedAgendas = prev.agendas.map((agenda) => (
                            agenda.id === id ? currentAgenda : agenda
                        ));
                        return revertedAgendas;
                    })()
                }));
                if (revertedAgendas) {
                    broadcastAgendaRowsSync(revertedAgendas);
                }
                return { ok: false, error };
            }

            if (Object.prototype.hasOwnProperty.call(normalizedUpdatedAgenda, 'type')) {
                const { data: refreshedAgenda, error: refreshError } = await supabase
                    .from('agendas')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (refreshError) {
                    console.error('FAILED to refresh agenda after type update:', refreshError);
                } else if (refreshedAgenda) {
                    const normalizedRefreshedAgenda = normalizeAgendaRecord(refreshedAgenda, {
                        mailElectionVotes: stateRef.current.mailElectionVotes
                    });
                    let refreshedAgendas = null;
                    setState(prev => ({
                        ...prev,
                        agendas: (() => {
                            refreshedAgendas = prev.agendas.map((agenda) => (
                                agenda.id === id ? normalizedRefreshedAgenda : agenda
                            ));
                            return refreshedAgendas;
                        })()
                    }));
                    if (refreshedAgendas) {
                        broadcastAgendaRowsSync(refreshedAgendas);
                    }
                }
            }

            return { ok: true };
        },

        deleteAgenda: async (id) => {
            setState(prev => ({ ...prev, agendas: prev.agendas.filter(a => a.id !== id) }));
            await supabase.from('agendas').delete().eq('id', id);
        },

        setAgenda: async (id) => {
            await setAgendaById(id);
        },

        moveAgendaSelection: async (delta) => {
            const navigableAgendaIds = getKeyboardNavigableAgendaIds(stateRef.current.agendas);
            if (!navigableAgendaIds.length || !delta) return;

            const currentIndex = navigableAgendaIds.indexOf(stateRef.current.currentAgendaId);
            const normalizedDelta = delta > 0 ? 1 : -1;
            const nextIndex = currentIndex === -1
                ? (normalizedDelta > 0 ? 0 : navigableAgendaIds.length - 1)
                : Math.min(
                    navigableAgendaIds.length - 1,
                    Math.max(0, currentIndex + normalizedDelta)
                );

            if (currentIndex === nextIndex) return;

            await setAgendaById(navigableAgendaIds[nextIndex]);
        },

        reorderAgendas: async (nextAgendaIds) => {
            if (!Array.isArray(nextAgendaIds) || !nextAgendaIds.length) {
                throw new Error('정렬할 안건 순서가 비어 있습니다.');
            }

            const currentAgendas = [...stateRef.current.agendas].sort((a, b) => a.order_index - b.order_index);
            if (currentAgendas.length !== nextAgendaIds.length) {
                throw new Error('안건 순서 정보가 현재 목록과 일치하지 않습니다.');
            }

            const agendaMap = new Map(currentAgendas.map((agenda) => [agenda.id, agenda]));
            const nextAgendas = nextAgendaIds.map((id, index) => {
                const agenda = agendaMap.get(id);
                if (!agenda) {
                    throw new Error(`존재하지 않는 안건 ID입니다: ${id}`);
                }

                return {
                    ...agenda,
                    order_index: index + 1
                };
            });

            const unchanged = nextAgendas.every((agenda) => {
                const currentAgenda = agendaMap.get(agenda.id);
                return currentAgenda?.order_index === agenda.order_index;
            });

            if (unchanged) return;

            setState(prev => ({
                ...prev,
                agendas: nextAgendas
            }));

            isReorderingAgendasRef.current = true;

            try {
                const tempOffset = nextAgendas.length + 1000;
                const changedAgendas = nextAgendas.filter((agenda) => {
                    const currentAgenda = agendaMap.get(agenda.id);
                    return currentAgenda?.order_index !== agenda.order_index;
                });

                for (const agenda of changedAgendas) {
                    const { error } = await supabase
                        .from('agendas')
                        .update({ order_index: agenda.order_index + tempOffset })
                        .eq('id', agenda.id);

                    if (error) throw error;
                }

                for (const agenda of changedAgendas) {
                    const { error } = await supabase
                        .from('agendas')
                        .update({ order_index: agenda.order_index })
                        .eq('id', agenda.id);

                    if (error) throw error;
                }
            } catch (error) {
                await refreshAgendasFromDb();
                throw error;
            } finally {
                isReorderingAgendasRef.current = false;
                await refreshAgendasFromDb();
            }
        },

        addMember: async (member) => {
            const payload = normalizeMemberPayload(member);

            if (!payload.unit || !payload.name) {
                throw new Error('동/호수와 성명은 필수입니다.');
            }

            const { data: maxIdResult, error: maxIdError } = await supabase
                .from('members')
                .select('id')
                .order('id', { ascending: false })
                .limit(1);

            if (maxIdError) throw maxIdError;

            const nextId = (maxIdResult?.[0]?.id || 0) + 1;
            const nextMember = { id: nextId, ...payload };

            const hasActiveField = Object.prototype.hasOwnProperty.call(stateRef.current.members?.[0] || {}, 'is_active');
            if (hasActiveField) {
                nextMember.is_active = member?.is_active !== false;
            }

            const { data, error } = await supabase
                .from('members')
                .insert(nextMember)
                .select()
                .single();

            if (error) throw error;
            if (data) {
                setState((prev) => ({
                    ...prev,
                    members: upsertMemberInList(prev.members, data)
                }));
            }
            return data;
        },

        setMemberActive: async (memberId, isActive) => {
            if (!memberId) {
                throw new Error('대상 조합원이 올바르지 않습니다.');
            }

            const currentVoteData = stateRef.current.voteData || {};
            const inactiveMemberIds = new Set(getInactiveMemberIds(currentVoteData));

            if (isActive) {
                inactiveMemberIds.delete(memberId);
            } else {
                inactiveMemberIds.add(memberId);
            }

            const newVoteData = createStampedVoteData({
                ...currentVoteData,
                inactiveMemberIds: Array.from(inactiveMemberIds).sort((a, b) => a - b)
            });

            setState(prev => ({ ...prev, voteData: newVoteData }));

            const { error } = await supabase.from('system_settings')
                .update({ vote_data: newVoteData })
                .eq('id', 1);

            if (error) throw error;
            broadcastSystemSettingsSync({ vote_data: newVoteData });
        },

        setAgendaTypeLock: async (agendaId, isLocked) => {
            if (!agendaId) {
                throw new Error('잠금 대상 안건이 올바르지 않습니다.');
            }

            const currentVoteData = stateRef.current.voteData || {};
            const currentLocks = getAgendaTypeLocks(currentVoteData);
            const nextLocks = { ...currentLocks };

            if (isLocked) {
                nextLocks[agendaId] = true;
            } else {
                delete nextLocks[agendaId];
            }

            const newVoteData = createStampedVoteData({
                ...currentVoteData,
                agendaTypeLocks: nextLocks
            });

            setState(prev => ({ ...prev, voteData: newVoteData }));

            const { error } = await supabase.from('system_settings')
                .update({ vote_data: newVoteData })
                .eq('id', 1);

            if (error) throw error;
            broadcastSystemSettingsSync({ vote_data: newVoteData });
        },

        setAgendaOrderLock: async (isLocked) => {
            const currentVoteData = stateRef.current.voteData || {};
            const newVoteData = createStampedVoteData({
                ...currentVoteData,
                agendaOrderLocked: !!isLocked
            });

            setState(prev => ({ ...prev, voteData: newVoteData }));

            const { error } = await supabase.from('system_settings')
                .update({ vote_data: newVoteData })
                .eq('id', 1);

            if (error) throw error;
            broadcastSystemSettingsSync({ vote_data: newVoteData });
        },

        updateMember: async (member) => {
            if (!member?.id) {
                throw new Error('수정할 조합원 정보가 올바르지 않습니다.');
            }

            const updates = normalizeMemberPayload(member);

            if (!updates.unit || !updates.name) {
                throw new Error('동/호수와 성명은 비워둘 수 없습니다.');
            }

            if (Object.prototype.hasOwnProperty.call(member, 'is_active')) {
                updates.is_active = member.is_active;
            }

            const { data, error } = await supabase
                .from('members')
                .update(updates)
                .eq('id', member.id)
                .select()
                .single();

            if (error) throw error;
            if (data) {
                setState((prev) => ({
                    ...prev,
                    members: upsertMemberInList(prev.members, data)
                }));
            }
        },

        deleteMember: async (id) => {
            if (!id) {
                throw new Error('삭제할 조합원이 선택되지 않았습니다.');
            }

            const currentVoteData = stateRef.current.voteData || {};
            const nextVoteData = createStampedVoteData({
                ...currentVoteData,
                inactiveMemberIds: getInactiveMemberIds(currentVoteData).filter((memberId) => memberId !== id)
            });

            const { error } = await supabase
                .from('members')
                .delete()
                .eq('id', id);

            if (error) throw error;

            const { error: settingsError } = await supabase.from('system_settings')
                .update({ vote_data: nextVoteData })
                .eq('id', 1);

            if (settingsError) throw settingsError;
            broadcastSystemSettingsSync({ vote_data: nextVoteData });

            setState((prev) => ({
                ...prev,
                members: prev.members.filter((member) => member.id !== id),
                voteData: nextVoteData
            }));
        },

        updateVoteData: async (field, value) => {
            const currentVoteData = stateRef.current.voteData;
            const newVoteData = createStampedVoteData({ ...currentVoteData, [field]: value });

            setState(prev => ({ ...prev, voteData: newVoteData }));

            const { error } = await supabase.from('system_settings')
                .update({ vote_data: newVoteData })
                .eq('id', 1);

            if (error) console.error("Update VoteData Error:", error);
            else {
                broadcastSystemSettingsSync({ vote_data: newVoteData });
            }
        },

        updatePresentationPage: async (delta) => {
            const currentVoteData = stateRef.current.voteData;
            const currentPage = parseInt(currentVoteData.presentationPage) || 1;
            const newPage = Math.max(1, currentPage + delta);

            if (currentPage === newPage) return;

            const newVoteData = createStampedVoteData({ ...currentVoteData, presentationPage: newPage });
            setState(prev => ({ ...prev, voteData: newVoteData }));

            const { error } = await supabase.from('system_settings')
                .update({ vote_data: newVoteData })
                .eq('id', 1);

            if (error) {
                console.error('Update Presentation Page Error:', error);
                return;
            }

            broadcastSystemSettingsSync({ vote_data: newVoteData });
        },

        setPresentationPage: async (page) => {
            const normalizedPage = Math.max(1, parseInt(page, 10) || 1);
            const currentVoteData = stateRef.current.voteData;

            if ((parseInt(currentVoteData.presentationPage, 10) || 1) === normalizedPage) return;

            const newVoteData = createStampedVoteData({ ...currentVoteData, presentationPage: normalizedPage });
            setState(prev => ({ ...prev, voteData: newVoteData }));

            const { error } = await supabase.from('system_settings')
                .update({ vote_data: newVoteData })
                .eq('id', 1);

            if (error) {
                console.error('Set Presentation Page Error:', error);
                return;
            }

            broadcastSystemSettingsSync({ vote_data: newVoteData });
        },

        setProjectorMode: async (mode, data = null) => {
            const currentVoteData = stateRef.current.voteData || {};
            const nextVoteData = createStampedVoteData((mode === 'RESULT' && data?.declaration !== undefined)
                ? {
                    ...currentVoteData,
                    customDeclaration: data.declaration || '',
                    resultDeclaration: data.declaration || '',
                    resultAgendaId: data.agendaId || null,
                    resultVotesYes: data.votesYes ?? 0,
                    resultVotesNo: data.votesNo ?? 0,
                    resultVotesAbstain: data.votesAbstain ?? 0,
                    resultTotalAttendance: data.totalAttendance ?? 0,
                    resultIsPassed: !!data.isPassed
                }
                : currentVoteData);

            // Save both mode AND data to state
            setState(prev => ({
                ...prev,
                projectorMode: mode,
                projectorData: data,
                voteData: nextVoteData
            }));

            const { error } = await supabase.from('system_settings')
                .update({
                    projector_mode: mode,
                    vote_data: nextVoteData
                })
                .eq('id', 1);

            if (error) {
                console.error('Set Projector Mode Error:', error);
                return;
            }

            broadcastSystemSettingsSync({
                projector_mode: mode,
                projector_data: data,
                vote_data: nextVoteData
            });
        },

        updateProjectorData: async (data) => {
            const currentVoteData = stateRef.current.voteData || {};
            const nextVoteData = createStampedVoteData({
                ...currentVoteData,
                customDeclaration: data?.declaration || '',
                resultDeclaration: data?.declaration || '',
                resultAgendaId: data?.agendaId || currentVoteData.resultAgendaId || null,
                resultVotesYes: data?.votesYes ?? currentVoteData.resultVotesYes ?? 0,
                resultVotesNo: data?.votesNo ?? currentVoteData.resultVotesNo ?? 0,
                resultVotesAbstain: data?.votesAbstain ?? currentVoteData.resultVotesAbstain ?? 0,
                resultTotalAttendance: data?.totalAttendance ?? currentVoteData.resultTotalAttendance ?? 0,
                resultIsPassed: data?.isPassed ?? currentVoteData.resultIsPassed ?? false
            });

            setState(prev => ({
                ...prev,
                projectorData: data,
                voteData: nextVoteData
            }));

            const { error } = await supabase.from('system_settings')
                .update({ vote_data: nextVoteData })
                .eq('id', 1);

            if (error) {
                console.error('Update Projector Data Error:', error);
                return;
            }

            broadcastSystemSettingsSync({
                projector_data: data,
                vote_data: nextVoteData
            });
        },

        // Declaration Editing State Management (per-agenda, local only)
        setDeclarationEditMode: (agendaId, isEditing, isAutoCalc) => {
            setState(prev => ({
                ...prev,
                declarationEditState: {
                    ...prev.declarationEditState,
                    [agendaId]: { isEditing, isAutoCalc }
                }
            }));
        },

        getDeclarationEditState: (agendaId) => {
            const editState = stateRef.current.declarationEditState[agendaId];
            return editState || { isEditing: false, isAutoCalc: true };
        },

        resetHelper: async () => { }
    }), [broadcastAgendaRowsSync, broadcastSystemSettingsSync, createStampedVoteData, reconcileAgendaVoteCountsFromWrittenVotes, refreshAgendasFromDb, refreshAttendanceFromDb, refreshMailElectionVotesFromDb, setAgendaById]); // Actions are stable because they use stateRef to access current state values

    return (
        <StoreContext.Provider value={{ state, actions }}>
            {children}
        </StoreContext.Provider>
    );
}

// Hook to consume the store
export function useStore() {
    const context = useContext(StoreContext);
    if (!context) {
        throw new Error('useStore must be used within a StoreProvider');
    }
    return context;
}
