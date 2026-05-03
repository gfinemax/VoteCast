export const INITIAL_DATA = {
    agendas: [],
    members: [],
    attendance: [],
    mailElectionVotes: [],
    dataConnectionError: null,
    lastDataSyncAt: null,
    currentMeetingId: null,
    activeMeetingId: null,
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
        agendaOrderLocked: false
    },
    currentAgendaId: 1,
    projectorMode: 'IDLE',
    projectorData: null,
    masterPresentationSource: null,
    projectorConnected: false,
    projectorConnectedCount: 0,
    declarationEditState: {}
};

export const WINDOW_SYNC_CHANNEL = 'votecast-system-settings-sync';
export const WINDOW_SYNC_STORAGE_KEY = '__votecast_system_settings_sync__';
export const WINDOW_AGENDAS_SYNC_CHANNEL = 'votecast-agendas-sync';
export const WINDOW_AGENDAS_SYNC_STORAGE_KEY = '__votecast_agendas_sync__';
export const PROJECTOR_SESSION_STORAGE_KEY = '__votecast_projector_session__';

export const normalizeProjectorModeValue = (mode) => mode === 'ADJUSTING' ? 'RESULT' : (mode || 'IDLE');

export const getVoteDataSyncVersion = (voteData = {}) => {
    const parsed = parseInt(voteData?.__syncVersion, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
};

export const stampVoteDataWithSyncVersion = (voteData = {}, syncVersion) => ({
    ...voteData,
    __syncVersion: syncVersion
});

export const readProjectorSessionState = () => {
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

export const createInitialState = () => {
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
