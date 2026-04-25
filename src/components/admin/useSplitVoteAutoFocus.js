'use client';

import { useEffect, useRef } from 'react';

export default function useSplitVoteAutoFocus({
    currentAgendaId,
    hasSplitVoteColumns,
    isConfirmed
}) {
    const primaryOnsiteInputRef = useRef(null);

    useEffect(() => {
        if (!hasSplitVoteColumns || isConfirmed) return undefined;

        const frameId = window.requestAnimationFrame(() => {
            primaryOnsiteInputRef.current?.focus();
        });

        return () => {
            window.cancelAnimationFrame(frameId);
        };
    }, [currentAgendaId, hasSplitVoteColumns, isConfirmed]);

    return primaryOnsiteInputRef;
}
