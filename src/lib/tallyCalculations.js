import {
    calculateAgendaPass,
    getAgendaAttendanceDisplayStats,
    getAgendaVoteBuckets,
    getAttendanceQuorumTarget,
    getMeetingAttendanceStats,
    getUniqueAttendanceRecords,
    normalizeAgendaType
} from '@/lib/voteCalculations';
import {
    getElectionResultLabel,
    getElectionThresholdLabel
} from '@/lib/electionRules';

export const VOTE_CHOICE_LABELS = {
    yes: '찬성',
    no: '반대',
    abstain: '기권',
    missing: '미기재',
    onsite: '현장'
};

export const ATTENDANCE_TYPE_LABELS = {
    direct: '직접투표',
    proxy: '대리투표',
    written: '서면결의서',
    none: '미참석'
};

export const CONFIRMATION_SOURCE_LABELS = {
    auto: '프로그램 자동 집계',
    matrix: '검산표 확인 집계',
    manual: '관리자 수기 확정'
};

const EMPTY_TOTALS = Object.freeze({ yes: 0, no: 0, abstain: 0 });

const toNumber = (value) => {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
};

export const buildAgendaGroups = (agendas = []) => {
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

    return groups;
};

export const getMeetingAgendas = (agendas = [], meetingId = null) => {
    if (!meetingId) return [];

    const sortedAgendas = [...agendas].sort((left, right) => (toNumber(left?.order_index) || 0) - (toNumber(right?.order_index) || 0));
    const folderIndex = sortedAgendas.findIndex((agenda) => agenda.id === meetingId);
    if (folderIndex < 0) return [];

    const items = [];
    for (let index = folderIndex + 1; index < sortedAgendas.length; index += 1) {
        const agenda = sortedAgendas[index];
        if (agenda.type === 'folder') break;
        items.push(agenda);
    }

    return items;
};

export const getDefaultMeetingId = ({ agendas = [], activeMeetingId = null, currentMeetingId = null, currentAgendaId = null } = {}) => {
    if (activeMeetingId) return activeMeetingId;
    if (currentMeetingId) return currentMeetingId;

    const sortedAgendas = [...agendas].sort((left, right) => (toNumber(left?.order_index) || 0) - (toNumber(right?.order_index) || 0));
    const currentAgendaIndex = sortedAgendas.findIndex((agenda) => agenda.id === currentAgendaId);
    if (currentAgendaIndex >= 0) {
        for (let index = currentAgendaIndex; index >= 0; index -= 1) {
            if (sortedAgendas[index]?.type === 'folder') return sortedAgendas[index].id;
        }
    }

    return sortedAgendas.find((agenda) => agenda.type === 'folder')?.id || null;
};

const getActiveMembers = (members = [], inactiveMemberIds = []) => {
    const inactiveMemberIdSet = new Set(inactiveMemberIds || []);
    return members.filter((member) => member.is_active !== false && !inactiveMemberIdSet.has(member.id));
};

const getChoiceCounts = (votes = []) => {
    const counts = { ...EMPTY_TOTALS };

    votes.forEach((vote) => {
        if (['yes', 'no', 'abstain'].includes(vote?.choice)) {
            counts[vote.choice] += 1;
        }
    });

    return counts;
};

const buildVoteLookup = (votes = []) => {
    const lookup = new Map();
    votes.forEach((vote) => {
        if (!vote?.member_id || !vote?.agenda_id || !['yes', 'no', 'abstain'].includes(vote?.choice)) return;
        lookup.set(`${vote.member_id}:${vote.agenda_id}`, vote.choice);
    });
    return lookup;
};

const getAgendaSpecialResult = (agenda = {}) => {
    const snapshot = agenda?.vote_snapshot || {};
    if (snapshot.result === 'WITHDRAWN' || agenda?.is_withdrawn) {
        return {
            result: '상정 철회',
            resultReason: snapshot.resultReason || agenda?.withdrawal_reason || '',
            isWithdrawn: true
        };
    }
    if (snapshot.result === 'CONDITIONAL_PASSED') {
        return {
            result: snapshot.resultLabel || '조건부 가결',
            resultReason: snapshot.resultReason || '',
            isWithdrawn: false
        };
    }
    return null;
};

const getResultLabel = (agenda, yesCount, attendanceCount, electionAgendas = [], quorumTarget = 0) => {
    const specialResult = getAgendaSpecialResult(agenda);
    if (specialResult) return specialResult.result;

    if (attendanceCount < quorumTarget) {
        return '유회 (성원 미달)';
    }

    const agendaType = normalizeAgendaType(agenda?.type);
    const passed = calculateAgendaPass(yesCount, attendanceCount, agendaType === 'twoThirds');

    if (agendaType === 'election') {
        return getElectionResultLabel(agenda, yesCount, attendanceCount, electionAgendas, quorumTarget);
    }
    return passed ? '가결' : '미가결';
};

const getThresholdLabel = (agenda, attendanceCount, electionAgendas = []) => {
    if (getAgendaSpecialResult(agenda)?.isWithdrawn) {
        return '상정 철회로 투표 미실시';
    }

    const agendaType = normalizeAgendaType(agenda?.type);
    if (agendaType === 'twoThirds') {
        return `출석 인원 3분의 2 이상 (${Math.ceil((Number(attendanceCount) || 0) * (2 / 3)).toLocaleString()}명 이상)`;
    }
    if (agendaType === 'election') {
        return getElectionThresholdLabel(agenda, attendanceCount, electionAgendas);
    }
    return `출석 인원 과반수 (${Math.floor((Number(attendanceCount) || 0) / 2 + 1).toLocaleString()}명 이상)`;
};

export const buildTallyAudit = ({
    agendas = [],
    members = [],
    attendance = [],
    mailElectionVotes = [],
    writtenVotes = [],
    meetingId = null,
    inactiveMemberIds = []
} = {}) => {
    const activeMembers = getActiveMembers(members, inactiveMemberIds);
    const activeMemberIdSet = new Set(activeMembers.map((member) => member.id));
    const meeting = agendas.find((agenda) => agenda.id === meetingId && agenda.type === 'folder') || null;
    const meetingAgendas = getMeetingAgendas(agendas, meetingId);
    const standardAgendas = meetingAgendas.filter((agenda) => normalizeAgendaType(agenda?.type) !== 'election');
    const electionAgendas = meetingAgendas.filter((agenda) => normalizeAgendaType(agenda?.type) === 'election');
    const meetingAttendanceRecords = getUniqueAttendanceRecords(attendance, meetingId, activeMemberIdSet);
    const attendanceByMemberId = new Map(meetingAttendanceRecords.map((record) => [record.member_id, record]));
    const meetingStats = getMeetingAttendanceStats(attendance, meetingId, activeMemberIdSet);
    const writtenVoteLookup = buildVoteLookup(writtenVotes);
    const mailElectionVoteLookup = buildVoteLookup(mailElectionVotes);

    const agendaResults = meetingAgendas.map((agenda) => {
        const agendaType = normalizeAgendaType(agenda?.type);
        const displayStats = getAgendaAttendanceDisplayStats({
            agenda,
            meetingStats,
            meetingId,
            attendance,
            mailElectionVotes,
            activeMemberIdSet
        });
        const buckets = getAgendaVoteBuckets(agenda, {
            mailElectionVotes,
            activeMemberIdSet
        });
        const writtenVotesForAgenda = writtenVotes.filter((vote) => vote.agenda_id === agenda.id && activeMemberIdSet.has(vote.member_id));
        const writtenDetailCounts = getChoiceCounts(writtenVotesForAgenda);
        const finalTotals = {
            yes: buckets.final.yes,
            no: buckets.final.no,
            abstain: buckets.final.abstain
        };
        const totalVotes = finalTotals.yes + finalTotals.no + finalTotals.abstain;
        const attendanceCount = displayStats.total;
        const specialResult = getAgendaSpecialResult(agenda);
        const mismatch = specialResult?.isWithdrawn ? false : totalVotes !== attendanceCount;
        const isElection = agendaType === 'election';

        const quorumTarget = getAttendanceQuorumTarget(agendaType, activeMembers.length);
        const result = getResultLabel(agenda, finalTotals.yes, attendanceCount, electionAgendas, quorumTarget);

        return {
            id: agenda.id,
            agenda,
            title: agenda.title || '',
            type: agendaType,
            isElection,
            attendanceCount,
            fixedLabel: buckets.fixedLabel,
            fixed: buckets.fixed,
            onsite: buckets.onsite,
            writtenDetailCounts,
            final: finalTotals,
            totalVotes,
            mismatch,
            result,
            resultReason: specialResult?.resultReason || '',
            isWithdrawn: !!specialResult?.isWithdrawn,
            thresholdLabel: getThresholdLabel(agenda, attendanceCount, electionAgendas),
            quorumTarget
        };
    });

    const memberRows = activeMembers.map((member) => {
        const record = attendanceByMemberId.get(member.id) || null;
        const standardVotes = standardAgendas.map((agenda) => ({
            agendaId: agenda.id,
            agenda,
            choice: writtenVoteLookup.get(`${member.id}:${agenda.id}`) || null
        }));
        const electionVotes = electionAgendas.map((agenda) => ({
            agendaId: agenda.id,
            agenda,
            choice: mailElectionVoteLookup.get(`${member.id}:${agenda.id}`) || null
        }));
        const issues = [];

        if (record?.type === 'proxy' && !String(record?.proxy_name || '').trim()) {
            issues.push('대리인명 없음');
        }

        if (record?.type === 'written') {
            const missingWrittenAgendaCount = standardVotes.filter((vote) => !vote.choice).length;
            if (standardAgendas.length > 0 && missingWrittenAgendaCount > 0) {
                issues.push(`서면 안건 ${missingWrittenAgendaCount}건 미기재`);
            }
        }

        const hasMailElectionVote = electionVotes.some((vote) => !!vote.choice);
        if (record?.type === 'direct' && hasMailElectionVote) {
            issues.push('직접참석/우편투표 중복');
        }
        if (record?.type === 'proxy' && record?.has_election && !hasMailElectionVote) {
            issues.push('대리 선거 우편투표 누락');
        }
        if (record?.type === 'written' && record?.has_election && !hasMailElectionVote) {
            issues.push('우편투표 누락');
        }

        return {
            member,
            record,
            attendanceType: record?.type || 'none',
            proxyName: record?.proxy_name || '',
            hasElection: !!record?.has_election,
            standardVotes,
            electionVotes,
            issues
        };
    });

    const issueList = [];

    if (!meetingId) {
        issueList.push({
            level: 'warning',
            title: '활성 총회가 선택되지 않았습니다.',
            detail: '검산 대상 총회를 먼저 선택해야 정확한 참석 및 안건 집계가 가능합니다.'
        });
    }

    agendaResults.forEach((result) => {
        if (result.mismatch) {
            issueList.push({
                level: 'danger',
                title: `${result.title} 투표 수 불일치`,
                detail: `출석 인정 ${result.attendanceCount.toLocaleString()}명, 투표 합계 ${result.totalVotes.toLocaleString()}표입니다.`
            });
        }
    });

    memberRows.forEach((row) => {
        row.issues.forEach((issue) => {
            issueList.push({
                level: 'warning',
                title: `${row.member.unit || ''} ${row.member.name || ''}`.trim(),
                detail: issue
            });
        });
    });

    return {
        meeting,
        meetingId,
        activeMembers,
        activeMemberIdSet,
        meetingAgendas,
        standardAgendas,
        electionAgendas,
        meetingStats,
        agendaResults,
        memberRows,
        issueList,
        hasIssues: issueList.length > 0
    };
};

export const buildManualResultsFromAgendaResults = (agendaResults = []) => (
    agendaResults.reduce((acc, result) => {
        acc[result.id] = {
            attendanceCount: result.attendanceCount,
            yes: result.final.yes,
            no: result.final.no,
            abstain: result.final.abstain
        };
        return acc;
    }, {})
);

export const applyManualResults = (agendaResults = [], manualResults = {}, sourceType = 'auto') => (
    agendaResults.map((result) => {
        const manual = manualResults[result.id] || {};
        if (sourceType !== 'manual') return result;

        const attendanceCount = toNumber(manual.attendanceCount);
        const final = {
            yes: toNumber(manual.yes),
            no: toNumber(manual.no),
            abstain: toNumber(manual.abstain)
        };
        const totalVotes = final.yes + final.no + final.abstain;

        return {
            ...result,
            attendanceCount,
            final,
            totalVotes,
            mismatch: result.isWithdrawn ? false : totalVotes !== attendanceCount,
            result: getResultLabel(result.agenda, final.yes, attendanceCount, agendaResults.filter((item) => item.isElection).map((item) => item.agenda), result.quorumTarget),
            thresholdLabel: getThresholdLabel(result.agenda, attendanceCount, agendaResults.filter((item) => item.isElection).map((item) => item.agenda))
        };
    })
);

export const formatKoreanDate = (value = new Date()) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
};
