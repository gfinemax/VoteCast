'use client';

import { toVoteNumber } from '@/components/admin/voteControlDerivedData';

export default function useVoteInputHandlers({
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
}) {
    const editableVoteTargetTotal = hasSplitVoteColumns
        ? effectiveTotalAttendance - totalFixedVotes
        : effectiveTotalAttendance;

    const handleLocalVoteChange = (fieldKey, rawValue) => {
        if (isConfirmed || !currentAgenda) return;

        const value = (rawValue === '' || rawValue === null || rawValue === undefined) ? 0 : parseInt(rawValue);
        if (isNaN(value)) return;

        let newLocal = { ...localVotes, [fieldKey]: value };

        if (isAutoCalc) {
            if (fieldKey === 'yes') {
                const currentAbstain = toVoteNumber(localVotes.abstain);
                newLocal.no = Math.max(0, editableVoteTargetTotal - value - currentAbstain);
            } else if (fieldKey === 'no') {
                const currentAbstain = toVoteNumber(localVotes.abstain);
                newLocal.yes = Math.max(0, editableVoteTargetTotal - value - currentAbstain);
            } else if (fieldKey === 'abstain') {
                const currentNo = toVoteNumber(localVotes.no);
                newLocal.yes = Math.max(0, editableVoteTargetTotal - currentNo - value);
            }
        }

        setLocalVoteDraft({
            agendaId: currentAgenda.id,
            values: newLocal,
            dirty: true
        });
        setConfirmReadyAgendaId(null);
    };

    const handleApplyLocalVotes = () => {
        if (isConfirmed || !currentAgenda) return;

        const y = toVoteNumber(localVotes.yes);
        const n = toVoteNumber(localVotes.no);
        const a = toVoteNumber(localVotes.abstain);
        const appliedTotals = hasSplitVoteColumns
            ? {
                yes: fixedVoteTotals.yes + y,
                no: fixedVoteTotals.no + n,
                abstain: fixedVoteTotals.abstain + a
            }
            : { yes: y, no: n, abstain: a };

        let updates = {};
        if (hasSplitVoteColumns) {
            updates.onsite_yes = y;
            updates.onsite_no = n;
            updates.onsite_abstain = a;
        } else {
            updates.votes_yes = y;
            updates.votes_no = n;
            updates.votes_abstain = a;
        }

        if (isAutoCalc && !isEditingDeclaration) {
            updates.declaration = generateDefaultDeclaration(appliedTotals);
        }

        updateAgenda({ id: currentAgenda.id, ...updates });
        if (updates.declaration) {
            syncProjectorDeclaration(updates.declaration, {
                yes: appliedTotals.yes,
                no: appliedTotals.no,
                abstain: appliedTotals.abstain,
                totalAttendance: effectiveTotalAttendance
            });
        }
        setLocalVoteDraft({
            agendaId: currentAgenda.id,
            values: { yes: y, no: n, abstain: a },
            dirty: false
        });
        setConfirmReadyAgendaId(null);
    };

    const handleAutoSum = () => {
        if (isConfirmed || !currentAgenda) return;

        const remainder = Math.max(
            0,
            editableVoteTargetTotal - toVoteNumber(localVotes.no) - toVoteNumber(localVotes.abstain)
        );
        handleLocalVoteChange('yes', remainder);
    };

    const handleResetEditableVotes = () => {
        if (isConfirmed || !currentAgenda) return;

        const updates = hasSplitVoteColumns
            ? {
                onsite_yes: 0,
                onsite_no: 0,
                onsite_abstain: 0
            }
            : {
                votes_yes: 0,
                votes_no: 0,
                votes_abstain: 0
            };

        if (isAutoCalc && !isEditingDeclaration) {
            updates.declaration = generateDefaultDeclaration({
                yes: fixedVoteTotals.yes,
                no: fixedVoteTotals.no,
                abstain: fixedVoteTotals.abstain
            });
        }

        setLocalVoteDraft({
            agendaId: currentAgenda.id,
            values: { yes: 0, no: 0, abstain: 0 },
            dirty: false
        });
        setConfirmReadyAgendaId(null);
        updateAgenda({ id: currentAgenda.id, ...updates });
        if (updates.declaration) {
            syncProjectorDeclaration(updates.declaration, {
                yes: fixedVoteTotals.yes,
                no: fixedVoteTotals.no,
                abstain: fixedVoteTotals.abstain,
                totalAttendance: effectiveTotalAttendance
            });
        }
    };

    return {
        handleLocalVoteChange,
        handleApplyLocalVotes,
        handleAutoSum,
        handleResetEditableVotes
    };
}
