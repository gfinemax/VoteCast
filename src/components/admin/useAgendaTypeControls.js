'use client';

export default function useAgendaTypeControls({
    currentAgenda,
    currentAgendaId,
    voteData,
    isConfirmed,
    updateAgenda,
    setAgendaTypeLock
}) {
    const agendaTypeLocks = (voteData?.agendaTypeLocks && typeof voteData.agendaTypeLocks === 'object')
        ? voteData.agendaTypeLocks
        : {};
    const isTypeLocked = !!agendaTypeLocks[currentAgendaId];

    const handleTypeChange = async (newType) => {
        if (!currentAgenda) return;
        if (isConfirmed) return;
        if (isTypeLocked) {
            alert('투표 유형 잠금이 켜져 있어 변경할 수 없습니다. 왼쪽 자물쇠 버튼을 눌러 잠금을 해제하세요.');
            return;
        }

        const result = await updateAgenda({ id: currentAgenda.id, type: newType });
        if (result?.ok === false) {
            alert(result.error?.message || '안건 유형 변경 저장에 실패했습니다.');
        }
    };

    const toggleTypeLock = async () => {
        if (!currentAgendaId) return;

        try {
            await setAgendaTypeLock(currentAgendaId, !isTypeLocked);
        } catch (error) {
            console.error('Failed to persist agenda type lock:', error);
            alert(error.message || '잠금 상태 저장에 실패했습니다.');
        }
    };

    return {
        isTypeLocked,
        handleTypeChange,
        toggleTypeLock
    };
}
