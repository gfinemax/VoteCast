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
    resultStatus,
    resultReason,
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
            const trimmedReason = String(resultReason || '').trim();
            const isWithdrawn = resultStatus === 'withdrawn';
            const isConditionalApproved = resultStatus === 'conditional_approved';
            const resultLabel = isWithdrawn
                ? '상정 철회'
                : (isConditionalApproved ? '조건부 가결' : (isPassed ? '가결' : '부결'));
            const finalDeclaration = isWithdrawn
                ? `"${currentAgenda.title}"은 다음 사유로 상정 철회되었음을 선포합니다.\n사유: ${trimmedReason}`
                : (isConditionalApproved
                    ? `"${currentAgenda.title}"은 출석 ${Number(effectiveTotalAttendance || 0).toLocaleString()}명 중 찬성 ${Number(votesYes || 0).toLocaleString()}표, 반대 ${Number(votesNo || 0).toLocaleString()}표, 기권 ${Number(votesAbstain || 0).toLocaleString()}표로 조건부 가결 되었음을 선포합니다.\n조건/사유: ${trimmedReason}`
                    : currentAgenda.declaration);
            const snapshotData = {
                stats: {
                    ...displayStats,
                    total: effectiveTotalAttendance
                },
                votes: { yes: votesYes, no: votesNo, abstain: votesAbstain },
                declaration: finalDeclaration,
                result: isWithdrawn ? 'WITHDRAWN' : (isConditionalApproved ? 'CONDITIONAL_PASSED' : (isPassed ? 'PASSED' : 'FAILED')),
                resultLabel,
                resultReason: trimmedReason,
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
