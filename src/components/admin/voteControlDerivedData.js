export const toVoteNumber = (value) => parseInt(value) || 0;

export function getVoteCountSummary({
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
}) {
    const totalVotesCast = votesYes + votesNo + votesAbstain;
    const localOnsiteVotesCast = toVoteNumber(localVotes.yes) + toVoteNumber(localVotes.no) + toVoteNumber(localVotes.abstain);
    const localTotalVotesCast = hasSplitVoteColumns
        ? totalFixedVotes + localOnsiteVotesCast
        : localOnsiteVotesCast;
    const displayTotalVotesCast = isLocalDirty ? localTotalVotesCast : totalVotesCast;
    const isVoteCountValid = displayTotalVotesCast === effectiveTotalAttendance;
    const onsiteVotesCast = hasSplitVoteColumns ? localOnsiteVotesCast : displayTotalVotesCast;
    const isElectionMailMissing = isElection && electionValidation.missingMailVoteCount > 0;
    const hasElectionMailOverlap = isElection && electionValidation.overlapMailVoteCount > 0;
    const hasInvalidProxyElection = isElection && electionValidation.invalidProxyElectionCount > 0;
    const isOnsiteOverflow = hasSplitVoteColumns && onsiteVotesCast > effectiveOnsiteEligibleCount;
    const hasElectionValidationIssue = isElection && (
        isElectionMailMissing
        || hasElectionMailOverlap
        || hasInvalidProxyElection
        || isOnsiteOverflow
        || displayTotalVotesCast !== electionValidation.expectedTotalVotes
    );
    const isApplyDisabled = !isVoteCountValid || isOnsiteOverflow || (isElection && hasElectionValidationIssue);
    const voteCountDelta = effectiveTotalAttendance - displayTotalVotesCast;
    const voteCountStatusText = voteCountDelta > 0
        ? `${voteCountDelta}표 부족`
        : `${Math.abs(voteCountDelta)}표 초과`;

    return {
        displayTotalVotesCast,
        isVoteCountValid,
        onsiteVotesCast,
        isElectionMailMissing,
        hasElectionMailOverlap,
        hasInvalidProxyElection,
        isOnsiteOverflow,
        hasElectionValidationIssue,
        isApplyDisabled,
        voteCountStatusText
    };
}

export function buildSplitVoteDisplayCards({
    hasSplitVoteColumns,
    fixedVoteTotals,
    localVotes
}) {
    if (!hasSplitVoteColumns) return [];

    return [
        {
            key: 'yes',
            summaryLabel: '전체 찬성',
            inputLabel: '현장 찬성',
            totalValue: fixedVoteTotals.yes + toVoteNumber(localVotes.yes),
            writtenValue: fixedVoteTotals.yes,
            onsiteValue: localVotes.yes,
            tone: {
                rowTint: 'border-emerald-900/50 bg-emerald-900/10',
                labelBadge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                totalText: 'text-emerald-400',
                writtenText: 'text-emerald-600',
                inputLabel: 'text-emerald-600',
                inputBox: 'bg-slate-950 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)] border-transparent text-emerald-400 caret-emerald-400 focus:bg-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30'
            }
        },
        {
            key: 'no',
            summaryLabel: '전체 반대',
            inputLabel: '현장 반대',
            totalValue: fixedVoteTotals.no + toVoteNumber(localVotes.no),
            writtenValue: fixedVoteTotals.no,
            onsiteValue: localVotes.no,
            tone: {
                rowTint: 'border-rose-900/50 bg-rose-900/10',
                labelBadge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
                totalText: 'text-rose-400',
                writtenText: 'text-rose-400',
                inputLabel: 'text-rose-600',
                inputBox: 'bg-slate-950 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)] border-transparent text-rose-400 caret-rose-400 focus:bg-slate-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/30'
            }
        },
        {
            key: 'abstain',
            summaryLabel: '전체 기권',
            inputLabel: '현장 기권',
            totalValue: fixedVoteTotals.abstain + toVoteNumber(localVotes.abstain),
            writtenValue: fixedVoteTotals.abstain,
            onsiteValue: localVotes.abstain,
            tone: {
                rowTint: 'border-slate-800 bg-slate-800/40',
                labelBadge: 'bg-slate-700/50 text-slate-300 border-slate-600/50',
                totalText: 'text-slate-200',
                writtenText: 'text-slate-500',
                inputLabel: 'text-slate-500',
                inputBox: 'bg-slate-950 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)] border-transparent text-slate-300 caret-slate-400 focus:bg-slate-900 focus:border-slate-500 focus:ring-2 focus:ring-slate-500/30'
            }
        }
    ];
}
