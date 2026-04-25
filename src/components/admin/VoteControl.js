'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/store';
import AttendanceSummaryPanel from '@/components/admin/AttendanceSummaryPanel';
import ConfirmedDecisionToast from '@/components/admin/ConfirmedDecisionToast';
import DeclarationEditor from '@/components/admin/DeclarationEditor';
import DecisionConfirmModal from '@/components/admin/DecisionConfirmModal';
import FinalConfirmationPanel from '@/components/admin/FinalConfirmationPanel';
import useAgendaTypeControls from '@/components/admin/useAgendaTypeControls';
import useConfirmedDecisionToast from '@/components/admin/useConfirmedDecisionToast';
import VoteAgendaHeader from '@/components/admin/VoteAgendaHeader';
import VoteInputSection from '@/components/admin/VoteInputSection';
import VoteProgressFooter from '@/components/admin/VoteProgressFooter';
import useVoteControlDerivedContext from '@/components/admin/useVoteControlDerivedContext';
import useVoteDecisionModal from '@/components/admin/useVoteDecisionModal';
import useVoteDeclarationSync from '@/components/admin/useVoteDeclarationSync';
import useVoteInputHandlers from '@/components/admin/useVoteInputHandlers';
import useSplitVoteAutoFocus from '@/components/admin/useSplitVoteAutoFocus';

export default function VoteControl() {
    const { state, actions } = useStore();
    const { updateAgenda, setDeclarationEditMode, setAgendaTypeLock, updateProjectorData, moveAgendaSelection } = actions;
    const { members, attendance, agendas, currentAgendaId, voteData, projectorMode, projectorData, mailElectionVotes } = state;
    const [confirmReadyAgendaId, setConfirmReadyAgendaId] = useState(null);
    const [localVoteDraft, setLocalVoteDraft] = useState({
        agendaId: null,
        values: { yes: 0, no: 0, abstain: 0 },
        dirty: false
    });
    const {
        currentAgenda,
        isConfirmed,
        hasSplitVoteColumns,
        fixedVoteTotals,
        fixedVoteLabel,
        votesYes,
        votesNo,
        votesAbstain,
        declaration,
        totalFixedVotes,
        localVotes,
        isLocalDirty,
        isReadyToConfirm,
        currentAgendaType,
        isSpecialVote,
        isElection,
        electionValidation,
        effectiveTotalAttendance,
        effectiveOnsiteEligibleCount,
        navigableAgendas,
        currentNavIndex,
        progressPercent,
        totalMembers,
        quorumTarget,
        directTarget,
        isDirectSatisfied,
        isQuorumSatisfied,
        isPassed,
        totalOnsiteAttendance,
        displayStats,
        voteCountSummary,
        splitVoteDisplayCards,
        canConfirmDecision
    } = useVoteControlDerivedContext({
        members,
        attendance,
        agendas,
        currentAgendaId,
        voteData,
        mailElectionVotes,
        localVoteDraft,
        confirmReadyAgendaId
    });
    const confirmedDecisionToast = useConfirmedDecisionToast({
        currentAgendaId,
        isConfirmed
    });

    const {
        generateDefaultDeclaration,
        syncProjectorDeclaration,
        isEditingDeclaration,
        isAutoCalc,
        localDeclaration,
        setIsAutoCalc,
        handleDeclarationDraftChange,
        handleStartDeclarationEdit,
        handleFinishDeclarationEdit
    } = useVoteDeclarationSync({
        currentAgenda,
        currentAgendaId,
        declaration,
        declarationEditStateByAgenda: state.declarationEditState,
        effectiveTotalAttendance,
        isElection,
        isSpecialVote,
        isConfirmed,
        votesYes,
        votesNo,
        votesAbstain,
        projectorMode,
        projectorData,
        updateAgenda,
        updateProjectorData,
        setDeclarationEditMode
    });

    const {
        isTypeLocked,
        handleTypeChange,
        toggleTypeLock
    } = useAgendaTypeControls({
        currentAgenda,
        currentAgendaId,
        voteData,
        isConfirmed,
        updateAgenda,
        setAgendaTypeLock
    });
    const primaryOnsiteInputRef = useSplitVoteAutoFocus({
        currentAgendaId,
        hasSplitVoteColumns,
        isConfirmed
    });

    const {
        handleLocalVoteChange,
        handleApplyLocalVotes,
        handleAutoSum,
        handleResetEditableVotes
    } = useVoteInputHandlers({
        isConfirmed,
        currentAgenda,
        localVotes,
        isAutoCalc,
        hasSplitVoteColumns,
        effectiveTotalAttendance,
        totalFixedVotes,
        fixedVoteTotals,
        isEditingDeclaration,
        setLocalVoteDraft,
        setConfirmReadyAgendaId,
        generateDefaultDeclaration,
        updateAgenda,
        syncProjectorDeclaration
    });

    const {
        confirmModalState,
        handleConfirmDecision,
        handleResetDecision,
        handleCancelDecisionModal,
        executeModalAction
    } = useVoteDecisionModal({
        currentAgenda,
        displayStats,
        effectiveTotalAttendance,
        votesYes,
        votesNo,
        votesAbstain,
        isPassed,
        isLocalDirty,
        updateAgenda,
        setConfirmReadyAgendaId
    });

    if (!currentAgenda) return <div className="p-10 text-center text-slate-400">안건을 선택해주세요.</div>;

    const {
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
    } = voteCountSummary;

    return (
        <div className="space-y-2 pb-2">
            {confirmedDecisionToast.isVisible && (
                <ConfirmedDecisionToast onDismiss={confirmedDecisionToast.dismiss} />
            )}
            <VoteAgendaHeader
                title={currentAgenda.title}
                isSpecialVote={isSpecialVote}
                currentAgendaType={currentAgendaType}
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch mb-4">
                <div className="lg:col-span-4 flex flex-col items-stretch">
                    <AttendanceSummaryPanel
                        isConfirmed={isConfirmed}
                        quorumTarget={quorumTarget}
                        effectiveTotalAttendance={effectiveTotalAttendance}
                        fixedAttendanceLabel={displayStats.fixedAttendanceLabel}
                        isElection={isElection}
                        totalOnsiteAttendance={totalOnsiteAttendance}
                        proxyCount={displayStats.proxy}
                        fixedAttendanceCount={displayStats.fixedAttendanceCount}
                        directCount={displayStats.direct}
                        totalMembers={totalMembers}
                        isSpecialVote={isSpecialVote}
                        isQuorumSatisfied={isQuorumSatisfied}
                        isDirectSatisfied={isDirectSatisfied}
                        currentAgendaType={currentAgendaType}
                        isTypeLocked={isTypeLocked}
                        onToggleLock={toggleTypeLock}
                        onTypeChange={handleTypeChange}
                        directTarget={directTarget}
                    />
                </div>

                <div className="lg:col-span-8 flex flex-col items-stretch">
                    <VoteInputSection
                        isConfirmed={isConfirmed}
                        hasSplitVoteColumns={hasSplitVoteColumns}
                        effectiveTotalAttendance={effectiveTotalAttendance}
                        isLocalDirty={isLocalDirty}
                        isApplyDisabled={isApplyDisabled}
                        isAutoCalc={isAutoCalc}
                        onApply={handleApplyLocalVotes}
                        onToggleAutoCalc={setIsAutoCalc}
                        onReset={handleResetEditableVotes}
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
                        displayStats={displayStats}
                        splitVoteDisplayCards={splitVoteDisplayCards}
                        primaryOnsiteInputRef={primaryOnsiteInputRef}
                        onLocalVoteChange={handleLocalVoteChange}
                        localVotes={localVotes}
                        onAutoSum={handleAutoSum}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                <div className="lg:col-span-4 flex flex-col gap-4">
                    <DeclarationEditor
                        isEditing={isEditingDeclaration}
                        isConfirmed={isConfirmed}
                        declaration={declaration}
                        localDeclaration={localDeclaration}
                        onChange={handleDeclarationDraftChange}
                        onStartEdit={handleStartDeclarationEdit}
                        onFinishEdit={handleFinishDeclarationEdit}
                    />
                </div>
                <div className="lg:col-span-8 flex flex-col gap-4">
                    <FinalConfirmationPanel
                        isConfirmed={isConfirmed}
                        isReadyToConfirm={isReadyToConfirm}
                        isLocalDirty={isLocalDirty}
                        isVoteCountValid={isVoteCountValid}
                        voteCountStatusText={voteCountStatusText}
                        displayTotalVotesCast={displayTotalVotesCast}
                        effectiveTotalAttendance={effectiveTotalAttendance}
                        hasElectionValidationIssue={hasElectionValidationIssue}
                        canConfirmDecision={canConfirmDecision}
                        onReadyChange={(checked) => setConfirmReadyAgendaId(checked ? currentAgendaId : null)}
                        onResetDecision={handleResetDecision}
                        onConfirmDecision={handleConfirmDecision}
                    />
                </div>
            </div>
            <VoteProgressFooter
                currentNavIndex={currentNavIndex}
                navigableAgendas={navigableAgendas}
                progressPercent={progressPercent}
                onPrevious={() => moveAgendaSelection(-1)}
                onNext={() => moveAgendaSelection(1)}
            />
            {confirmModalState.isOpen && (
                <DecisionConfirmModal
                    type={confirmModalState.type}
                    onCancel={handleCancelDecisionModal}
                    onConfirm={executeModalAction}
                />
            )}
        </div>
    );
}
