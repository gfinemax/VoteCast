'use client';

import { useState } from 'react';

export default function useConfirmedDecisionToast({
    currentAgendaId,
    isConfirmed
}) {
    const [dismissedToastKey, setDismissedToastKey] = useState(null);
    const toastKey = `${currentAgendaId}:${isConfirmed ? 'confirmed' : 'live'}`;
    const isVisible = isConfirmed && dismissedToastKey !== toastKey;

    return {
        isVisible,
        dismiss: () => setDismissedToastKey(toastKey)
    };
}
