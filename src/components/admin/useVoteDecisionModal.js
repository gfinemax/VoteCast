'use client';

import { useState } from 'react';

export default function useVoteDecisionModal({
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
}) {
    const [confirmModalState, setConfirmModalState] = useState({ isOpen: false, type: null });

    const handleConfirmDecision = () => {
        if (isLocalDirty) return;
        setConfirmModalState({ isOpen: true, type: 'confirm' });
    };

    const handleResetDecision = () => {
        setConfirmReadyAgendaId(null);
        setConfirmModalState({ isOpen: true, type: 'reset' });
    };

    const handleCancelDecisionModal = () => {
        setConfirmModalState({ isOpen: false, type: null });
    };

    const executeModalAction = () => {
        if (!currentAgenda) return;

        if (confirmModalState.type === 'confirm') {
            const snapshotData = {
                stats: {
                    ...displayStats,
                    total: effectiveTotalAttendance
                },
                votes: { yes: votesYes, no: votesNo, abstain: votesAbstain },
                declaration: currentAgenda.declaration,
                result: isPassed ? 'PASSED' : 'FAILED',
                timestamp: new Date().toISOString()
            };
            updateAgenda({ id: currentAgenda.id, vote_snapshot: snapshotData });
            setConfirmModalState({ isOpen: false, type: null });
        } else if (confirmModalState.type === 'reset') {
            updateAgenda({ id: currentAgenda.id, vote_snapshot: null });
            setConfirmReadyAgendaId(null);
            setConfirmModalState({ isOpen: false, type: null });
        }
    };

    return {
        confirmModalState,
        handleConfirmDecision,
        handleResetDecision,
        handleCancelDecisionModal,
        executeModalAction
    };
}
