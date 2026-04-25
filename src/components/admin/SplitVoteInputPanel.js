'use client';

import VoteActionBar from '@/components/admin/VoteActionBar';
import VoteNumericInput from '@/components/admin/VoteNumericInput';
import VoteValidationAlert from '@/components/admin/VoteValidationAlert';

const SPLIT_VOTE_GRID_CLASS = 'lg:grid-cols-[72px_minmax(40px,0.45fr)_16px_minmax(96px,1.15fr)_16px_minmax(84px,0.75fr)]';
const ONSITE_INPUT_HEADER_WIDTH_CLASS = 'w-[82%] mx-auto';
const ONSITE_INPUT_FIELD_WIDTH_CLASS = 'w-full lg:w-[82%] lg:mx-auto';

export default function SplitVoteInputPanel({
    effectiveTotalAttendance,
    isLocalDirty,
    isApplyDisabled,
    isConfirmed,
    isAutoCalc,
    onApply,
    onToggleAutoCalc,
    onReset,
    isVoteCountValid,
    isOnsiteOverflow,
    isElection,
    hasElectionValidationIssue,
    isElectionMailMissing,
    hasElectionMailOverlap,
    hasInvalidProxyElection,
    electionValidation,
    members,
    onsiteVotesCast,
    effectiveOnsiteEligibleCount,
    displayTotalVotesCast,
    voteCountStatusText,
    fixedVoteLabel,
    fixedAttendanceCount,
    onsiteAttendanceCount,
    splitVoteDisplayCards,
    primaryOnsiteInputRef,
    onLocalVoteChange
}) {
    return (
        <div className="flex flex-col flex-1 mt-0">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2 shadow-[0_12px_40px_-15px_rgba(0,0,0,0.5)] flex-1">
                <div className="mb-2 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-3 ml-2">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700">
                            <span className="text-xs font-bold text-slate-400">성원합계</span>
                            <span className="text-sm font-black text-blue-400 tabular-nums">{effectiveTotalAttendance}명</span>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <VoteActionBar
                            variant="dark"
                            isLocalDirty={isLocalDirty}
                            isApplyDisabled={isApplyDisabled}
                            isConfirmed={isConfirmed}
                            isAutoCalc={isAutoCalc}
                            onApply={onApply}
                            onToggleAutoCalc={onToggleAutoCalc}
                            onReset={onReset}
                        />
                    </div>
                </div>

                <div className="min-h-[48px] mb-1 flex items-center">
                    <VoteValidationAlert
                        isVisible={!isVoteCountValid || isOnsiteOverflow || (isElection && hasElectionValidationIssue)}
                        isElection={isElection}
                        hasElectionValidationIssue={hasElectionValidationIssue}
                        isElectionMailMissing={isElectionMailMissing}
                        hasElectionMailOverlap={hasElectionMailOverlap}
                        hasInvalidProxyElection={hasInvalidProxyElection}
                        isOnsiteOverflow={isOnsiteOverflow}
                        electionValidation={electionValidation}
                        members={members}
                        onsiteVotesCast={onsiteVotesCast}
                        effectiveOnsiteEligibleCount={effectiveOnsiteEligibleCount}
                        displayTotalVotesCast={displayTotalVotesCast}
                        voteCountStatusText={voteCountStatusText}
                    />
                </div>

                <div className={`hidden ${SPLIT_VOTE_GRID_CLASS} gap-1 px-2 pb-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 lg:grid items-center`}>
                    <div className="text-center text-slate-400">구분</div>
                    <div className="min-w-0 text-center text-slate-500 whitespace-pre-wrap">{fixedVoteLabel}({fixedAttendanceCount}명)</div>
                    <div className="w-4 text-center text-slate-700 text-xl font-black leading-none">+</div>
                    <div className={`min-w-0 ${ONSITE_INPUT_HEADER_WIDTH_CLASS} text-center text-blue-400 border border-blue-900/50 bg-blue-900/20 rounded px-2 py-0.5 leading-tight flex flex-col items-center justify-center`}>
                        <span>현장 참석입력</span>
                        <span className="text-[10px] font-bold text-blue-300">
                            {isElection
                                ? `(조합원=${effectiveOnsiteEligibleCount}명)`
                                : `(조합원+대리인=${onsiteAttendanceCount}명)`
                            }
                        </span>
                    </div>
                    <div className="w-4 text-center text-slate-700 text-xl font-black leading-none">=</div>
                    <div className="min-w-0 text-center leading-tight text-emerald-400/70 break-keep">입력합계 {displayTotalVotesCast}명</div>
                </div>

                <div className="space-y-2">
                    {splitVoteDisplayCards.map((card) => (
                        <div
                            key={`${card.key}-row`}
                            className={`grid grid-cols-1 ${SPLIT_VOTE_GRID_CLASS} gap-2 lg:gap-1 items-center rounded-2xl border px-3 py-1.5 lg:px-2 transition-colors overflow-hidden ${card.tone.rowTint} hover:shadow-md`}
                        >
                            <div className="flex items-center justify-between lg:flex lg:justify-center">
                                <span className={`inline-flex h-12 w-[80px] items-center justify-center rounded-lg border px-2 text-sm font-bold shadow-sm lg:h-10 lg:w-[64px] lg:px-1 lg:text-xs xl:h-12 xl:w-[72px] xl:text-sm ${card.tone.labelBadge}`}>
                                    {card.summaryLabel.replace('전체 ', '')}
                                </span>
                            </div>

                            <div className="flex flex-col items-center justify-between rounded-xl bg-slate-800/30 px-4 py-3 lg:bg-transparent lg:px-0 lg:py-0 lg:justify-center">
                                <span className="text-xs font-bold text-slate-500 lg:hidden mb-1">{fixedVoteLabel}</span>
                                <span className={`font-mono text-xl md:text-2xl font-black tabular-nums ${card.tone.writtenText}`}>{card.writtenValue}</span>
                            </div>

                            <div className="hidden lg:flex justify-center text-slate-700 text-xl font-black leading-none xl:text-2xl">+</div>

                            <div className="relative lg:flex lg:justify-center">
                                <div className={`mb-1 text-xs font-bold lg:hidden ${card.tone.inputLabel}`}>현장 참석입력</div>
                                <VoteNumericInput
                                    innerRef={card.key === 'yes' ? primaryOnsiteInputRef : null}
                                    value={card.onsiteValue}
                                    placeholder="0"
                                    onChange={(value) => onLocalVoteChange(card.key, value)}
                                    disabled={isConfirmed}
                                    className={`${ONSITE_INPUT_FIELD_WIDTH_CLASS} rounded-xl border px-2 py-1 text-center text-xl md:text-2xl font-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] outline-none disabled:bg-slate-50 disabled:text-slate-400 transition-all ${card.tone.inputBox}`}
                                />
                            </div>

                            <div className="hidden lg:flex justify-center text-slate-700 text-xl font-black leading-none xl:text-2xl">=</div>

                            <div className="min-w-0 flex flex-col items-center justify-between rounded-xl bg-slate-800/30 px-4 py-3 lg:bg-transparent lg:px-0 lg:py-0 lg:justify-center">
                                <span className="text-xs font-bold text-slate-500 lg:hidden mb-1">최종 득표</span>
                                <div className="flex min-w-0 w-full items-end justify-center gap-1 whitespace-nowrap">
                                    <span className={`min-w-0 font-mono text-xl lg:text-[22px] xl:text-2xl font-black tabular-nums leading-none ${card.tone.totalText}`}>{card.totalValue}</span>
                                    <span className="text-sm font-bold text-slate-400 mb-1 md:mb-0.5">표</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
