'use client';

import { useEffect } from 'react';
import { PROJECTOR_SESSION_STORAGE_KEY } from './storeState';
import { isAbortError, queryWithRetry } from './storeSupabase';
import { areAttendanceListsEqual, normalizeAttendanceRecord } from './storeNormalizers';
import { fetchAttendance } from './votecastRepository';

export const useProjectorSessionPersistence = (state) => {
    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        if (!window.location.pathname.startsWith('/projector')) return undefined;

        const sessionSnapshot = {
            agendas: state.agendas,
            voteData: state.voteData,
            currentAgendaId: state.currentAgendaId,
            projectorMode: state.projectorMode,
            projectorData: state.projectorData,
            masterPresentationSource: state.masterPresentationSource
        };

        try {
            window.sessionStorage.setItem(PROJECTOR_SESSION_STORAGE_KEY, JSON.stringify(sessionSnapshot));
        } catch (error) {
            console.error('Failed to persist projector session state:', error);
        }

        return undefined;
    }, [
        state.agendas,
        state.currentAgendaId,
        state.masterPresentationSource,
        state.projectorData,
        state.projectorMode,
        state.voteData
    ]);
};

export const useProjectorSystemSettingsPolling = ({
    isInitialized,
    refreshSystemSettingsFromDb
}) => {
    useEffect(() => {
        if (!isInitialized || typeof window === 'undefined') return undefined;
        if (!window.location.pathname.startsWith('/projector')) return undefined;

        const pollId = window.setInterval(() => {
            refreshSystemSettingsFromDb({ preserveCurrentMeetingId: true });
        }, 1000);

        return () => {
            window.clearInterval(pollId);
        };
    }, [isInitialized, refreshSystemSettingsFromDb]);
};

export const useAttendancePollingFallback = ({
    isInitialized,
    setState,
    refreshMailElectionVotesFromDb
}) => {
    useEffect(() => {
        if (!isInitialized || typeof document === 'undefined') return undefined;

        let lastHiddenAt = 0;
        const STALE_THRESHOLD_MS = 3000;
        const POLL_INTERVAL_MS = 2000;

        const refetchAttendance = async () => {
            try {
                const data = await queryWithRetry(fetchAttendance, 'Failed to refetch attendance');
                if (data) {
                    setState((prev) => {
                        const normalizedAttendance = data.map(normalizeAttendanceRecord);
                        if (areAttendanceListsEqual(prev.attendance, normalizedAttendance)) {
                            return prev;
                        }
                        return { ...prev, attendance: normalizedAttendance };
                    });
                }
                await refreshMailElectionVotesFromDb();
            } catch (error) {
                if (isAbortError(error)) return;
                throw error;
            }
        };

        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'hidden') {
                lastHiddenAt = Date.now();
                return;
            }

            const hiddenDuration = lastHiddenAt > 0 ? Date.now() - lastHiddenAt : 0;
            if (hiddenDuration < STALE_THRESHOLD_MS) return;

            console.log(`[Visibility] Tab restored after ${Math.round(hiddenDuration / 1000)}s - refetching attendance`);
            await refetchAttendance();
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        const pollId = window.setInterval(() => {
            if (document.visibilityState === 'visible') {
                refetchAttendance();
            }
        }, POLL_INTERVAL_MS);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.clearInterval(pollId);
        };
    }, [isInitialized, refreshMailElectionVotesFromDb, setState]);
};

export const useWrittenVoteReconciliationPolling = ({
    isInitialized,
    stateRef,
    reconcileAgendaVoteCountsFromWrittenVotes,
    refreshAgendasFromDb
}) => {
    useEffect(() => {
        if (!isInitialized || typeof document === 'undefined') return undefined;

        const RECONCILE_POLL_MS = 3000;

        const reconcileWrittenVotes = async () => {
            try {
                const currentAgendas = stateRef.current.agendas;
                if (!currentAgendas.length) return;

                const didReconcile = await reconcileAgendaVoteCountsFromWrittenVotes(currentAgendas);
                if (didReconcile) {
                    await refreshAgendasFromDb();
                }
            } catch (error) {
                if (isAbortError(error)) return;
                throw error;
            }
        };

        const pollId = window.setInterval(() => {
            if (document.visibilityState === 'visible') {
                reconcileWrittenVotes();
            }
        }, RECONCILE_POLL_MS);

        return () => window.clearInterval(pollId);
    }, [isInitialized, reconcileAgendaVoteCountsFromWrittenVotes, refreshAgendasFromDb, stateRef]);
};
