export const ELECTION_METHODS = {
    RUNOFF_MAJORITY: 'runoffMajority',
    PLURALITY: 'plurality',
    APPROVAL_MAJORITY: 'approvalMajority'
};

export const ELECTION_METHOD_SETTING_OPTIONS = [
    { value: 'auto', label: '자동 판별' },
    { value: 'approval_majority', label: '찬반투표' },
    { value: 'chair_runoff', label: '조합장 경선' },
    { value: 'plurality', label: '다득표 선출' }
];

const includesAny = (text = '', keywords = []) => keywords.some((keyword) => text.includes(keyword));

const getMajorityThreshold = (attendanceCount) => Math.floor((Number(attendanceCount) || 0) / 2) + 1;

const isChairAgendaTitle = (title = '') => includesAny(title, ['조합장']);
const isApprovalTitle = (title = '') => includesAny(title, ['찬반', '찬성', '반대', '단독', '단일']);

const getChairAgendaCount = (electionAgendas = []) => (
    electionAgendas.filter((agenda) => isChairAgendaTitle(String(agenda?.title || ''))).length
);

const getConfiguredElectionRule = (agenda = {}) => {
    const setting = agenda?.election_method || agenda?.electionMethod || null;
    const title = String(agenda?.title || '');
    const isChair = isChairAgendaTitle(title);

    if (setting === 'approval_majority') {
        return {
            role: isChair ? '조합장' : '임원',
            method: ELECTION_METHODS.APPROVAL_MAJORITY,
            isContest: false,
            label: isChair ? '조합장 찬반투표' : '찬반투표',
            positiveLabel: '찬성',
            negativeLabel: '반대',
            abstainLabel: '기권'
        };
    }

    if (setting === 'chair_runoff') {
        return {
            role: '조합장',
            method: ELECTION_METHODS.RUNOFF_MAJORITY,
            isContest: true,
            label: '조합장 경선',
            positiveLabel: '선택',
            negativeLabel: '미선택',
            abstainLabel: '기권'
        };
    }

    if (setting === 'plurality') {
        const role = includesAny(title, ['대의원']) ? '대의원' : (includesAny(title, ['이사']) ? '이사' : '임원');
        return {
            role,
            method: ELECTION_METHODS.PLURALITY,
            isContest: true,
            label: `${role} 다득표 선출`,
            positiveLabel: '선택',
            negativeLabel: '미선택',
            abstainLabel: '기권'
        };
    }

    return null;
};

export const getElectionRule = (agenda = {}, electionAgendas = []) => {
    const configuredRule = getConfiguredElectionRule(agenda);
    if (configuredRule) return configuredRule;

    const title = String(agenda?.title || '');

    if (isChairAgendaTitle(title)) {
        const isSingleCandidateApproval = isApprovalTitle(title) || getChairAgendaCount(electionAgendas) === 1;
        if (isSingleCandidateApproval) {
            return {
                role: '조합장',
                method: ELECTION_METHODS.APPROVAL_MAJORITY,
                isContest: false,
                label: '조합장 찬반투표',
                positiveLabel: '찬성',
                negativeLabel: '반대',
                abstainLabel: '기권'
            };
        }

        return {
            role: '조합장',
            method: ELECTION_METHODS.RUNOFF_MAJORITY,
            isContest: true,
            label: '조합장 경선',
            positiveLabel: '선택',
            negativeLabel: '미선택',
            abstainLabel: '기권'
        };
    }

    if (includesAny(title, ['이사'])) {
        return {
            role: '이사',
            method: ELECTION_METHODS.PLURALITY,
            isContest: true,
            label: '이사 선거',
            positiveLabel: '선택',
            negativeLabel: '미선택',
            abstainLabel: '기권'
        };
    }

    if (includesAny(title, ['대의원'])) {
        return {
            role: '대의원',
            method: ELECTION_METHODS.PLURALITY,
            isContest: true,
            label: '대의원 선거',
            positiveLabel: '선택',
            negativeLabel: '미선택',
            abstainLabel: '기권'
        };
    }

    if (includesAny(title, ['감사'])) {
        return {
            role: '감사',
            method: ELECTION_METHODS.APPROVAL_MAJORITY,
            isContest: false,
            label: '감사 선거',
            positiveLabel: '찬성',
            negativeLabel: '반대',
            abstainLabel: '기권'
        };
    }

    return {
        role: '임원',
        method: ELECTION_METHODS.APPROVAL_MAJORITY,
        isContest: false,
        label: '임원 선거',
        positiveLabel: '찬성',
        negativeLabel: '반대',
        abstainLabel: '기권'
    };
};

export const getElectionChoiceLabel = (agenda, choice, electionAgendas = []) => {
    const rule = getElectionRule(agenda, electionAgendas);
    if (choice === 'yes') return rule.positiveLabel;
    if (choice === 'no') return rule.negativeLabel;
    if (choice === 'abstain') return rule.abstainLabel;
    if (choice === 'missing') return '미기재';
    return '-';
};

export const getElectionVoteColumnLabels = (agenda, electionAgendas = []) => {
    const rule = getElectionRule(agenda, electionAgendas);
    return {
        yes: rule.isContest ? '득표/선택' : '찬성',
        no: rule.isContest ? '미선택' : '반대',
        abstain: '기권/무효'
    };
};

export const getElectionThresholdLabel = (agenda, attendanceCount, electionAgendas = []) => {
    const rule = getElectionRule(agenda, electionAgendas);
    const threshold = getMajorityThreshold(attendanceCount).toLocaleString();

    if (rule.method === ELECTION_METHODS.RUNOFF_MAJORITY) {
        return `${rule.label}: 1차 출석 과반수(${threshold}표 이상) 미달 시 상위 2인 2차, 2차 미달 시 3차 최다득표`;
    }

    if (rule.method === ELECTION_METHODS.PLURALITY) {
        return `${rule.label}: 다득표순 정원 이내 선출`;
    }

    return `${rule.label}: 출석 조합원 과반수(${threshold}표 이상) 찬성`;
};

export const getElectionQuorumConditionLabel = (agenda, electionAgendas = [], quorumTarget = null) => {
    const rule = getElectionRule(agenda, electionAgendas);
    const quorumText = quorumTarget ? `성원 ${Number(quorumTarget).toLocaleString()}명 이상` : '재적 과반 출석';
    const onsitePrefix = '현장 20% 참석';

    if (rule.method === ELECTION_METHODS.RUNOFF_MAJORITY) {
        return `${quorumText} / ${onsitePrefix} / 1·2차 과반, 3차 최다득표`;
    }

    if (rule.method === ELECTION_METHODS.PLURALITY) {
        return `${quorumText} / ${onsitePrefix} / 다득표순 정원 이내`;
    }

    return `${quorumText} / ${onsitePrefix} / 찬성 출석 과반`;
};


export const getElectionResultLabel = (agenda, yesCount, attendanceCount, electionAgendas = []) => {
    const rule = getElectionRule(agenda, electionAgendas);

    if (rule.method === ELECTION_METHODS.PLURALITY) {
        return '다득표 확인';
    }

    if (rule.method === ELECTION_METHODS.RUNOFF_MAJORITY) {
        return Number(yesCount) >= getMajorityThreshold(attendanceCount) ? '1차 당선권' : '결선 확인';
    }

    return Number(yesCount) >= getMajorityThreshold(attendanceCount) ? '당선' : '낙선';
};

export const getDefaultElectionChoice = (agenda, electionAgendas = []) => (
    getElectionRule(agenda, electionAgendas).isContest ? 'no' : 'yes'
);

export const isChairContestAgenda = (agenda, electionAgendas = []) => {
    const rule = getElectionRule(agenda, electionAgendas);
    return rule.role === '조합장' && rule.isContest;
};
