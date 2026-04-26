'use client';

import { Lock, ShieldAlert } from 'lucide-react';
import SplitVoteInputPanel from '@/components/admin/SplitVoteInputPanel';
import StandardVoteInputPanel from '@/components/admin/StandardVoteInputPanel';

export default function VoteInputSection({
    isConfirmed,
    hasSplitVoteColumns,
    effectiveTotalAttendance,
    isLocalDirty,
    isApplyDisabled,
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
    displayStats,
    splitVoteDisplayCards,
    primaryOnsiteInputRef,
    onLocalVoteChange,
    localVotes,
    onAutoSum,
    isQuorumSatisfied
}) {
    const isQuorumLocked = !isQuorumSatisfied && !isConfirmed;

    return (
        <section className={`flex flex-col flex-1 ${isConfirmed ? "pointer-events-none opacity-90" : ""}`}>
            <div className="flex justify-between items-end mb-1">
                <h3 className="text-base font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                    02. 투표결과 입력
                    {isConfirmed && <Lock size={14} className="text-slate-400" />}
                    {isQuorumLocked && <ShieldAlert size={14} className="text-amber-500" />}
                </h3>
            </div>
            <div className={`flex flex-col flex-1 ${hasSplitVoteColumns ? '' : `p-3 rounded-2xl border ${isConfirmed ? 'bg-slate-50 border-slate-200 opacity-90' : 'bg-white border-slate-200 shadow-sm'}`}`}>
                <div className={`flex flex-col flex-1 ${hasSplitVoteColumns ? '' : 'space-y-3'}`}>
                    {hasSplitVoteColumns ? (
                        <SplitVoteInputPanel
                            effectiveTotalAttendance={effectiveTotalAttendance}
                            isLocalDirty={isLocalDirty}
                            isApplyDisabled={isApplyDisabled}
                            isConfirmed={isConfirmed}
                            isAutoCalc={isAutoCalc}
                            onApply={onApply}
                            onToggleAutoCalc={onToggleAutoCalc}
                            onReset={onReset}
                            isVoteCountValid={isVoteCountValid}
                            isOnsiteOverflow={isOnsiteOverflow}
                            isElection={isElection}
                            hasElectionValidationIssue={hasElectionValidationIssue}
                            isElectionMailMissing={isElectionMailMissing}
                            hasElectionMailOverlap={hasElectionMailOverlap}
                            hasInvalidProxyElection={hasInvalidProxyElection}
                            electionValidation={electionValidation}
                            members={members}
                            onsiteVotesCast={onsiteVotesCast}
                            effectiveOnsiteEligibleCount={effectiveOnsiteEligibleCount}
                            displayTotalVotesCast={displayTotalVotesCast}
                            voteCountStatusText={voteCountStatusText}
                            fixedVoteLabel={fixedVoteLabel}
                            fixedAttendanceCount={displayStats.fixedAttendanceCount}
                            onsiteAttendanceCount={displayStats.direct + displayStats.proxy}
                            splitVoteDisplayCards={splitVoteDisplayCards}
                            primaryOnsiteInputRef={primaryOnsiteInputRef}
                            onLocalVoteChange={onLocalVoteChange}
                            isQuorumLocked={isQuorumLocked}
                        />
                    ) : (
                        <StandardVoteInputPanel
                            displayTotalVotesCast={displayTotalVotesCast}
                            effectiveTotalAttendance={effectiveTotalAttendance}
                            isVoteCountValid={isVoteCountValid}
                            voteCountStatusText={voteCountStatusText}
                            isLocalDirty={isLocalDirty}
                            isApplyDisabled={isApplyDisabled}
                            isConfirmed={isConfirmed}
                            isAutoCalc={isAutoCalc}
                            localVotes={localVotes}
                            onApply={onApply}
                            onToggleAutoCalc={onToggleAutoCalc}
                            onReset={onReset}
                            onAutoSum={onAutoSum}
                            onLocalVoteChange={onLocalVoteChange}
                            isQuorumLocked={isQuorumLocked}
                        />
                    )}
                </div>
            </div>
        </section>
    );
}
