'use client';

import {
    getElectionQuorumConditionLabel,
    getElectionRule
} from '@/lib/electionRules';

const getAgendaTypeBadgeText = ({ isSpecialVote, currentAgendaType }) => {
    if (isSpecialVote) return '특별결의(2/3)';
    if (currentAgendaType === 'election') return '임원선거';
    return '일반결의(과반)';
};

const getDecisionQuorumConditionLabel = ({ isSpecialVote, quorumTarget }) => {
    const quorumText = quorumTarget ? `성원 ${Number(quorumTarget).toLocaleString()}명 이상` : (isSpecialVote ? '재적 2/3 출석' : '재적 과반 출석');
    return isSpecialVote
        ? `${quorumText} / 찬성 출석 2/3`
        : `${quorumText} / 찬성 출석 과반`;
};

export default function VoteAgendaHeader({
    title,
    agenda,
    electionAgendas = [],
    isSpecialVote,
    currentAgendaType,
    quorumTarget
}) {
    const electionRule = currentAgendaType === 'election' ? getElectionRule(agenda || { title }, electionAgendas) : null;
    const quorumConditionLabel = currentAgendaType === 'election'
        ? getElectionQuorumConditionLabel(agenda || { title }, electionAgendas, quorumTarget)
        : getDecisionQuorumConditionLabel({ isSpecialVote, quorumTarget });

    return (
        <div className="flex justify-between items-start gap-4">
            <div className="flex-1">
                <h2 className="text-lg font-bold leading-snug break-keep">
                    {title}
                    <span className="inline-block align-middle ml-2 -mt-1 text-sm font-bold text-white bg-blue-600 px-2 py-0.5 rounded shadow-sm whitespace-nowrap">
                        {getAgendaTypeBadgeText({ isSpecialVote, currentAgendaType })}
                    </span>
                    {electionRule && (
                        <span className="inline-block align-middle ml-2 -mt-1 text-sm font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded shadow-sm whitespace-nowrap">
                            {electionRule.label}
                        </span>
                    )}
                    <span className="inline-block align-middle ml-2 -mt-1 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded shadow-sm whitespace-nowrap">
                        {quorumConditionLabel}
                    </span>
                </h2>
            </div>
        </div>
    );
}
