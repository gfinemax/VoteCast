'use client';

import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { buildDefaultDeclaration, calculateAgendaPass } from './voteCalculations';
import {
    createInitialState,
    getVoteDataSyncVersion,
    INITIAL_DATA,
    normalizeProjectorModeValue,
    stampVoteDataWithSyncVersion
} from './storeState';
import {
    fetchSystemSettingsWithRetry,
    queryWithRetry,
    updateSystemSettingsWithRetry
} from './storeSupabase';
import { reconcileWrittenVoteAgendaCounts } from './storeWrittenVoteReconciliation';
import {
    useAttendancePollingFallback,
    useProjectorSessionPersistence,
    useProjectorSystemSettingsPolling,
    useWrittenVoteReconciliationPolling
} from './storeLifecycleEffects';
import { useInitialStoreData } from './storeInitialLoad';
import { useStoreRealtimeSubscriptions } from './storeRealtimeEffects';
import { createAttendanceActions } from './storeAttendanceActions';
import {
    broadcastAgendaRowsMessage,
    broadcastSystemSettingsMessage,
    useAgendaRowsWindowSync,
    useSystemSettingsWindowSync
} from './storeWindowSync';
import {
    getInactiveMemberIds,
    getMeetingAdmissionStatus,
    getMemberJoinedMeetingId
} from './storeHelpers';
import {
    getAgendaTypeLocks,
    getKeyboardNavigableAgendaIds
} from './storeAgendaUtils';
import {
    areAgendaListsEqual,
    areAgendaRecordsEqual,
    areAttendanceListsEqual,
    normalizeAttendanceRecord,
    normalizeMemberPayload,
    upsertMemberInList
} from './storeNormalizers';
import {
    deleteAgendaById,
    deleteMemberById,
    fetchAgendaById,
    fetchAgendaOrderRowsFrom,
    fetchAgendas,
    fetchAttendance,
    fetchMailElectionVotes,
    fetchMaxAgendaId,
    fetchMaxAgendaOrder,
    fetchMaxMemberId,
    insertAgenda,
    insertMember,
    updateAgendaFields,
    updateAgendaOrderIndex,
    updateMemberFields,
    updateSystemSettings
} from './votecastRepository';
import {
    getAgendaAttendanceDisplayStats,
    getAgendaVoteBuckets,
    getAllowedElectionModesForMeetingType,
    getAttendanceQuorumTarget,
    getDefaultElectionModeForMeetingType,
    getMajorityThreshold,
    getMailElectionVoteStats,
    getMeetingAttendanceStats,
    normalizeAgendaRecord,
    normalizeAgendaType,
    normalizeAgendaTypeForDb,
    sanitizeElectionModeForMeetingType,
    withLegacyVoteTotals
} from './storeSelectors';

export {
    buildDefaultDeclaration,
    calculateAgendaPass
} from './voteCalculations';
export {
    getAgendaAttendanceDisplayStats,
    getAgendaVoteBuckets,
    getAllowedElectionModesForMeetingType,
    getAttendanceQuorumTarget,
    getDefaultElectionModeForMeetingType,
    getElectionAgendaValidationStats,
    getMajorityThreshold,
    getMailElectionVoteStats,
    getMeetingAttendanceStats,
    getUniqueAttendanceRecords,
    isElectionModeAllowedForMeetingType,
    normalizeAgendaType,
    sanitizeElectionModeForMeetingType,
    withLegacyVoteTotals
} from './storeSelectors';
export { getKeyboardNavigableAgendaIds } from './storeAgendaUtils';

// Re-export getInactiveMemberIds for consumer pages
export { getInactiveMemberIds } from './storeHelpers';

// Create Context
const StoreContext = createContext(null);

// Provider Component
export function StoreProvider({ children }) {
    const [state, setState] = useState(createInitialState);
    const [isInitialized, setIsInitialized] = useState(false);
    const isReorderingAgendasRef = useRef(false);
    const suppressAgendaRealtimeUntilRef = useRef(0);
    const stateRef = useRef(state);
    const pendingAttendanceOpsRef = useRef(new Set());
    const windowSyncIdRef = useRef(`window-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const broadcastChannelRef = useRef(null);
    const systemSettingsChannelRef = useRef(null);
    const agendaBroadcastChannelRef = useRef(null);
    const attendanceSyncChannelRef = useRef(null);
    const lastAppliedSystemSyncVersionRef = useRef(getVoteDataSyncVersion(state.voteData));
    const nextSystemSyncVersionRef = useRef(getVoteDataSyncVersion(state.voteData));
    const lastAgendaSyncMessageAtRef = useRef(0);

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    useProjectorSessionPersistence(state);

    const createNextSystemSyncVersion = React.useCallback(() => {
        const nextVersion = Math.max(
            Date.now(),
            lastAppliedSystemSyncVersionRef.current + 1,
            nextSystemSyncVersionRef.current + 1
        );

        nextSystemSyncVersionRef.current = nextVersion;
        return nextVersion;
    }, []);

    const createStampedVoteData = React.useCallback((voteData = {}, syncVersion = createNextSystemSyncVersion()) => {
        lastAppliedSystemSyncVersionRef.current = Math.max(lastAppliedSystemSyncVersionRef.current, syncVersion);
        nextSystemSyncVersionRef.current = Math.max(nextSystemSyncVersionRef.current, syncVersion);
        return stampVoteDataWithSyncVersion(voteData, syncVersion);
    }, [createNextSystemSyncVersion]);

    const shouldApplySystemSettings = React.useCallback((settings, options = {}) => {
        const incomingVersion = getVoteDataSyncVersion(settings?.vote_data);
        const currentVersion = lastAppliedSystemSyncVersionRef.current;
        const { allowLegacyVersion = false } = options;

        if (incomingVersion === 0 && currentVersion > 0 && !allowLegacyVersion) {
            return false;
        }

        if (incomingVersion < currentVersion) {
            return false;
        }

        if (incomingVersion > 0) {
            lastAppliedSystemSyncVersionRef.current = incomingVersion;
            nextSystemSyncVersionRef.current = Math.max(nextSystemSyncVersionRef.current, incomingVersion);
        }

        return true;
    }, []);

    const applySystemSettingsToState = React.useCallback((settings, options = {}) => {
        if (!settings) return;
        if (!shouldApplySystemSettings(settings, options)) return;

        const {
            defaultMeetingId = null,
            preserveCurrentMeetingId = false,
            projectorData = Object.prototype.hasOwnProperty.call(settings, 'projector_data')
                ? settings.projector_data
                : null
        } = options;

        const normalizedProjectorMode = normalizeProjectorModeValue(settings.projector_mode);

        setState((prev) => ({
            ...prev,
            currentMeetingId: preserveCurrentMeetingId
                ? prev.currentMeetingId
                : (defaultMeetingId ?? prev.currentMeetingId),
            voteData: { ...INITIAL_DATA.voteData, ...(settings.vote_data || {}) },
            currentAgendaId: settings.current_agenda_id || 1,
            activeMeetingId: settings.active_meeting_id || null,
            projectorMode: normalizedProjectorMode,
            projectorData,
            masterPresentationSource: settings.master_presentation_source
        }));
    }, [shouldApplySystemSettings]);

    const refreshSystemSettingsFromDb = React.useCallback(async (options = {}) => {
        const settings = await fetchSystemSettingsWithRetry('Failed to refresh system settings');
        if (!settings) {
            return null;
        }

        if (settings.projector_mode === 'ADJUSTING') {
            await updateSystemSettingsWithRetry(
                { projector_mode: 'RESULT' },
                'Failed to normalize projector mode'
            );
            settings.projector_mode = 'RESULT';
        }

        applySystemSettingsToState(settings, options);
        return settings;
    }, [applySystemSettingsToState]);

    const broadcastSystemSettingsSync = React.useCallback((overrides = {}) => {
        broadcastSystemSettingsMessage({
            overrides,
            windowSyncIdRef,
            stateRef,
            broadcastChannelRef,
            systemSettingsChannelRef
        });
    }, []);

    const broadcastAgendaRowsSync = React.useCallback((rows = []) => {
        broadcastAgendaRowsMessage({
            rows,
            windowSyncIdRef,
            agendaBroadcastChannelRef
        });
    }, []);

    useProjectorSystemSettingsPolling({
        isInitialized,
        refreshSystemSettingsFromDb
    });

    useSystemSettingsWindowSync({
        windowSyncIdRef,
        lastAppliedSystemSyncVersionRef,
        broadcastChannelRef,
        applySystemSettingsToState
    });

    const applyAgendaRowsToState = React.useCallback((rows) => {
        if (!rows) return;

        setState((prev) => {
            const editingAgendaIds = Object.keys(prev.declarationEditState || {})
                .filter((id) => prev.declarationEditState[id]?.isEditing);

            const mergedAgendas = rows.map((agenda) => {
                const normalizedAgenda = normalizeAgendaRecord(agenda, {
                    mailElectionVotes: stateRef.current.mailElectionVotes
                });
                if (editingAgendaIds.includes(String(agenda.id))) {
                    const existingAgenda = prev.agendas.find((item) => item.id === agenda.id);
                    if (existingAgenda) {
                        return { ...normalizedAgenda, declaration: existingAgenda.declaration };
                    }
                }

                return normalizedAgenda;
            });

            if (areAgendaListsEqual(prev.agendas, mergedAgendas)) {
                return prev;
            }

            return { ...prev, agendas: mergedAgendas };
        });
    }, []);

    useAgendaRowsWindowSync({
        windowSyncIdRef,
        lastAgendaSyncMessageAtRef,
        agendaBroadcastChannelRef,
        applyAgendaRowsToState
    });

    const refreshAgendasFromDb = React.useCallback(async () => {
        const data = await queryWithRetry(
            fetchAgendas,
            'Failed to refresh agendas'
        );

        if (!data) return null;
        applyAgendaRowsToState(data || []);
        return data;
    }, [applyAgendaRowsToState]);

    const refreshAttendanceFromDb = React.useCallback(async () => {
        const data = await queryWithRetry(
            fetchAttendance,
            'Failed to refresh attendance'
        );

        if (!data) return null;
        const rows = (data || []).map(normalizeAttendanceRecord);
        setState((prev) => {
            if (areAttendanceListsEqual(prev.attendance, rows)) {
                return prev;
            }

            return {
                ...prev,
                attendance: rows
            };
        });

        return rows;
    }, []);

    const refreshMailElectionVotesFromDb = React.useCallback(async () => {
        const data = await queryWithRetry(
            fetchMailElectionVotes,
            'Failed to refresh mail election votes',
            { suppressCodes: ['42P01'] }
        );

        if (!data) return null;
        const rows = data || [];
        setState((prev) => {
            if (
                prev.mailElectionVotes.length === rows.length
                && prev.mailElectionVotes.every((vote, index) => (
                    vote.id === rows[index]?.id
                    && vote.choice === rows[index]?.choice
                ))
            ) {
                return prev;
            }

            return {
                ...prev,
                mailElectionVotes: rows
            };
        });

        return rows;
    }, []);

    const reconcileAgendaVoteCountsFromWrittenVotes = React.useCallback((agendaRows = null, context = {}) => (
        reconcileWrittenVoteAgendaCounts({
            agendaRows,
            context,
            stateSnapshot: stateRef.current,
            suppressAgendaRealtimeUntilRef
        })
    ), []);

    const syncAgendaForWrittenVote = React.useCallback(async (agendaId) => {
        if (!agendaId) return;

        const targetAgenda = stateRef.current.agendas.find((agenda) => agenda.id === agendaId);
        if (!targetAgenda) {
            // Agenda not in local state yet — just refresh everything
            await refreshAgendasFromDb();
            return;
        }

        // Reconcile acts as a safety net (e.g. if the RPC didn't update agendas)
        await reconcileAgendaVoteCountsFromWrittenVotes([targetAgenda]);
        // Always refresh local state from DB — the RPC may have already updated
        // agendas correctly (so reconcile found no mismatch), but our local
        // state still has the old values.
        await refreshAgendasFromDb();
    }, [reconcileAgendaVoteCountsFromWrittenVotes, refreshAgendasFromDb]);

    useInitialStoreData({
        stateRef,
        setState,
        setIsInitialized,
        reconcileAgendaVoteCountsFromWrittenVotes,
        refreshSystemSettingsFromDb
    });

    useStoreRealtimeSubscriptions({
        windowSyncIdRef,
        systemSettingsChannelRef,
        attendanceSyncChannelRef,
        isReorderingAgendasRef,
        suppressAgendaRealtimeUntilRef,
        stateRef,
        setState,
        applySystemSettingsToState,
        refreshAgendasFromDb,
        refreshMailElectionVotesFromDb,
        refreshSystemSettingsFromDb,
        syncAgendaForWrittenVote,
        reconcileAgendaVoteCountsFromWrittenVotes
    });

    useAttendancePollingFallback({
        isInitialized,
        setState,
        refreshMailElectionVotesFromDb
    });

    useWrittenVoteReconciliationPolling({
        isInitialized,
        stateRef,
        reconcileAgendaVoteCountsFromWrittenVotes,
        refreshAgendasFromDb
    });

    const setAgendaById = React.useCallback(async (id) => {
        console.log('[setAgenda] Called with ID:', id);

        const targetAgenda = stateRef.current.agendas.find(a => a.id === id);
        if (!targetAgenda) {
            console.log('[setAgenda] ERROR: targetAgenda not found!');
            return;
        }

        let newType = targetAgenda.type || 'majority';
        if (newType === 'general') newType = 'majority';
        if (newType === 'special') newType = 'twoThirds';

        const vData = stateRef.current.voteData || {};
        const currentMembers = stateRef.current.members || [];
        const inactiveMemberIdSet = new Set(getInactiveMemberIds(vData));
        const activeMemberIdSet = new Set(
            currentMembers
                .filter((member) => member.is_active !== false && !inactiveMemberIdSet.has(member.id))
                .map((member) => member.id)
        );
        let targetMeetingId = null;
        if (targetAgenda.type === 'folder') {
            targetMeetingId = targetAgenda.id;
        } else {
            const targetIndex = stateRef.current.agendas.findIndex((agenda) => agenda.id === targetAgenda.id);
            for (let i = targetIndex - 1; i >= 0; i -= 1) {
                if (stateRef.current.agendas[i].type === 'folder') {
                    targetMeetingId = stateRef.current.agendas[i].id;
                    break;
                }
            }
        }
        const meetingStats = getMeetingAttendanceStats(stateRef.current.attendance, targetMeetingId, activeMemberIdSet);
        const attendanceStats = getAgendaAttendanceDisplayStats({
            agenda: targetAgenda,
            meetingStats,
            mailElectionVotes: stateRef.current.mailElectionVotes,
            activeMemberIdSet
        });
        const total = attendanceStats.total;
        const voteBuckets = getAgendaVoteBuckets(targetAgenda, {
            mailElectionVotes: stateRef.current.mailElectionVotes,
            activeMemberIdSet
        });
        const votesYes = voteBuckets.final.yes;
        const votesNo = voteBuckets.final.no;
        const votesAbstain = voteBuckets.final.abstain;
        const isElectionStore = voteBuckets.fixedLabel === '우편투표';
        const activeMemberCount = activeMemberIdSet.size;
        const quorumTarget = getAttendanceQuorumTarget(newType, activeMemberCount);
        const directTarget = Math.ceil(activeMemberCount * 0.2);
        const isDirectSatisfied = newType !== 'election' || attendanceStats.direct >= directTarget;
        const isQuorumSatisfied = total >= quorumTarget && isDirectSatisfied;

        const defaultDecl = buildDefaultDeclaration({
            agenda: targetAgenda,
            effectiveTotalAttendance: total,
            isElection: isElectionStore,
            isSpecialVote: newType === 'twoThirds',
            isQuorumSatisfied,
            votesYes,
            votesNo,
            votesAbstain
        });


        const currentProjectorMode = stateRef.current.projectorMode;
        const nextProjectorData = stateRef.current.projectorData;

        const nextVoteDataPatch = {
            ...vData,
            voteType: newType,
            customDeclaration: defaultDecl,
            presentationPage: targetAgenda.start_page || 1
        };

        const newVoteData = createStampedVoteData(nextVoteDataPatch);

        console.log('[setAgenda] Setting currentAgendaId to:', id);

        stateRef.current = {
            ...stateRef.current,
            currentAgendaId: id,
            voteData: newVoteData,
            projectorMode: currentProjectorMode,
            projectorData: nextProjectorData
        };

        setState(prev => ({
            ...prev,
            currentAgendaId: id,
            voteData: newVoteData,
            projectorMode: currentProjectorMode,
            projectorData: nextProjectorData
        }));

        broadcastSystemSettingsSync({
            current_agenda_id: id,
            projector_mode: currentProjectorMode,
            projector_data: nextProjectorData,
            vote_data: newVoteData
        });

        await updateSystemSettingsWithRetry(
            {
                current_agenda_id: id,
                projector_mode: currentProjectorMode,
                projector_data: nextProjectorData,
                vote_data: newVoteData
            },
            'Set Agenda Error'
        );
    }, [broadcastSystemSettingsSync, createStampedVoteData]);

    // Actions
    const actions = React.useMemo(() => ({
        // Local Admin View Switcher
        setMeetingId: (id) => {
            setState(prev => ({ ...prev, currentMeetingId: id }));
        },

        // Global Admission Control (Admin Only)
        setActiveMeeting: async (id) => {
            // Optimistic
            setState(prev => ({ ...prev, activeMeetingId: id }));
            // DB Update
            const { error } = await updateSystemSettings({ active_meeting_id: id });
            if (error) console.error("Failed to set active meeting:", error);
            else {
                broadcastSystemSettingsSync({ active_meeting_id: id });
            }
        },

        setMeetingAdmissionStatus: async (meetingId, status) => {
            // status: 'idle' | 'open' | 'closed'
            if (!meetingId) return;

            const currentVoteData = stateRef.current.voteData || {};
            const meetingAdmissionStatus = currentVoteData.meetingAdmissionStatus || {};
            const newVoteData = createStampedVoteData({
                ...currentVoteData,
                meetingAdmissionStatus: {
                    ...meetingAdmissionStatus,
                    [meetingId]: status
                }
            });

            if (status === 'open') {
                // Opening admission: also set as active meeting
                setState(prev => ({ ...prev, activeMeetingId: meetingId, voteData: newVoteData }));
                const { error } = await updateSystemSettings({ active_meeting_id: meetingId, vote_data: newVoteData });
                if (error) console.error('Failed to set meeting admission status:', error);
                else broadcastSystemSettingsSync({ active_meeting_id: meetingId, vote_data: newVoteData });
            } else if (status === 'closed') {
                // Closing admission: clear activeMeetingId if it was this meeting
                const shouldClear = stateRef.current.activeMeetingId === meetingId;
                setState(prev => ({
                    ...prev,
                    activeMeetingId: shouldClear ? null : prev.activeMeetingId,
                    voteData: newVoteData
                }));
                const updates = { vote_data: newVoteData };
                if (shouldClear) updates.active_meeting_id = null;
                const { error } = await updateSystemSettings(updates);
                if (error) console.error('Failed to set meeting admission status:', error);
                else broadcastSystemSettingsSync(updates);
            } else {
                // idle
                setState(prev => ({ ...prev, voteData: newVoteData }));
                const { error } = await updateSystemSettings({ vote_data: newVoteData });
                if (error) console.error('Failed to set meeting admission status:', error);
                else broadcastSystemSettingsSync({ vote_data: newVoteData });
            }
        },

        setRosterConfirmedStatus: async (meetingId, isConfirmed) => {
            if (!meetingId) return;

            const currentVoteData = stateRef.current.voteData || {};
            const rosterConfirmedStatus = currentVoteData.rosterConfirmedStatus || {};
            const newVoteData = createStampedVoteData({
                ...currentVoteData,
                rosterConfirmedStatus: {
                    ...rosterConfirmedStatus,
                    [meetingId]: isConfirmed
                }
            });

            setState(prev => ({ ...prev, voteData: newVoteData }));
            const { error } = await updateSystemSettings({ vote_data: newVoteData });
            if (error) console.error('Failed to set roster confirmed status:', error);
            else broadcastSystemSettingsSync({ vote_data: newVoteData });
        },

        ...createAttendanceActions({
            stateRef,
            setState,
            pendingAttendanceOpsRef,
            attendanceSyncChannelRef,
            refreshAgendasFromDb,
            refreshAttendanceFromDb,
            refreshMailElectionVotesFromDb,
            reconcileAgendaVoteCountsFromWrittenVotes
        }),
        addAgenda: async (newAgenda, insertAfterOrderIndex = null) => {
            // Optimistic ID (temp) - ensuring it doesn't collide with real IDs (usually small integers)
            const tempId = Date.now();

            let autoType = normalizeAgendaTypeForDb(newAgenda.type || 'majority');
            if (newAgenda.title && (newAgenda.title.includes('선출') || newAgenda.title.includes('선거'))) {
                autoType = 'election';
            }

            let newOrderIndex;

            if (insertAfterOrderIndex !== null) {
                // Insertion Mode
                newOrderIndex = insertAfterOrderIndex + 1;

                // 1. Optimistic Update: Shift local state
                setState(prev => {
                    const sorted = [...prev.agendas].sort((a, b) => a.order_index - b.order_index);
                    const updated = sorted.map(a => a.order_index >= newOrderIndex ? { ...a, order_index: a.order_index + 1 } : a);
                    updated.push({ ...newAgenda, type: autoType, id: tempId, order_index: newOrderIndex });
                    return { ...prev, agendas: updated.sort((a, b) => a.order_index - b.order_index) };
                });

                // 2. Client Side Shift in DB
                // Fetch all items that need shifting, ORDER BY DESC to avoid unique constraint collisions (shift last items first)
                const { data: allAgendas } = await fetchAgendaOrderRowsFrom(newOrderIndex);

                if (allAgendas && allAgendas.length > 0) {
                    for (const item of allAgendas) {
                        const { error: moveError } = await updateAgendaOrderIndex(item.id, item.order_index + 1);
                        if (moveError) console.error("Failed to shift agenda:", item.id, moveError);
                    }
                }
            } else {
                // Append Mode
                const { data: maxOrder } = await fetchMaxAgendaOrder();
                newOrderIndex = (maxOrder?.[0]?.order_index || 0) + 1;

                // Optimistic Append
                setState(prev => ({
                    ...prev,
                    agendas: [...prev.agendas, { ...newAgenda, type: autoType, id: tempId, order_index: newOrderIndex }]
                }));
            }

            // Generate Manual ID (DB missing sequence)
            const { data: maxIdResult } = await fetchMaxAgendaId();
            const nextId = (maxIdResult?.[0]?.id || 0) + 1;

            // Insert into DB (Let DB handle ID)
            const { data: insertedData, error } = await insertAgenda({
                ...newAgenda,
                id: nextId,
                type: autoType,
                order_index: newOrderIndex
            });

            if (insertedData) {
                // Replace temp ID with real ID in local state to prevent "flash" or ref issues
                setState(prev => ({
                    ...prev,
                    agendas: prev.agendas.map(a => a.id === tempId ? insertedData : a)
                }));
            } else if (error) {
                console.error("Failed to add agenda:", JSON.stringify(error, null, 2));
                // Rollback optimistic update
                setState(prev => ({
                    ...prev,
                    agendas: prev.agendas.filter(a => a.id !== tempId)
                }));
            }
        },

        updateAgenda: async (updatedAgenda) => {
            const currentAgenda = stateRef.current.agendas.find(a => a.id === updatedAgenda.id) || {};
            const normalizedUpdatedAgenda = Object.prototype.hasOwnProperty.call(updatedAgenda, 'type')
                ? { ...updatedAgenda, type: normalizeAgendaTypeForDb(updatedAgenda.type) }
                : updatedAgenda;
            const mergedAgenda = { ...currentAgenda, ...normalizedUpdatedAgenda };
            const normalizedAgenda = withLegacyVoteTotals(mergedAgenda, {
                mailElectionVotes: stateRef.current.mailElectionVotes
            });
            if (areAgendaRecordsEqual(currentAgenda, normalizedAgenda)) {
                return { ok: true, skipped: true };
            }

            let nextAgendas = null;
            setState(prev => ({
                ...prev,
                agendas: (() => {
                    nextAgendas = prev.agendas.map((agenda) => (
                        agenda.id === updatedAgenda.id ? { ...agenda, ...normalizedAgenda } : agenda
                    ));
                    return nextAgendas;
                })()
            }));
            if (nextAgendas) {
                broadcastAgendaRowsSync(nextAgendas);
            }

            // Only send explicitly changed fields to the DB (NOT all agenda fields).
            // This prevents accidental overwrites of written_yes/no/abstain columns,
            // which are managed exclusively by the check_in_member RPC and reconcile logic.
            const { id, ...passedFields } = normalizedUpdatedAgenda;
            const dbFields = { ...passedFields };

            // When onsite vote fields change, include the derived votes_* totals
            const onsiteVoteFields = ['onsite_yes', 'onsite_no', 'onsite_abstain'];
            const legacyVoteFields = ['votes_yes', 'votes_no', 'votes_abstain'];
            const hasOnsiteChange = onsiteVoteFields.some(f => Object.prototype.hasOwnProperty.call(passedFields, f));
            const hasLegacyChange = legacyVoteFields.some(f => Object.prototype.hasOwnProperty.call(passedFields, f));

            if (hasOnsiteChange) {
                // Recompute legacy totals from the merged (up-to-date) values
                dbFields.votes_yes = normalizedAgenda.votes_yes;
                dbFields.votes_no = normalizedAgenda.votes_no;
                dbFields.votes_abstain = normalizedAgenda.votes_abstain;
            } else if (hasLegacyChange) {
                // Non-split mode: use the values as-is from the merged agenda
                dbFields.votes_yes = normalizedAgenda.votes_yes;
                dbFields.votes_no = normalizedAgenda.votes_no;
                dbFields.votes_abstain = normalizedAgenda.votes_abstain;
            }

            suppressAgendaRealtimeUntilRef.current = Date.now() + 1000;
            const { error } = await updateAgendaFields(id, dbFields);
            if (error) {
                console.error("FAILED to update Agenda:", error);
                let revertedAgendas = null;
                setState(prev => ({
                    ...prev,
                    agendas: (() => {
                        revertedAgendas = prev.agendas.map((agenda) => (
                            agenda.id === id ? currentAgenda : agenda
                        ));
                        return revertedAgendas;
                    })()
                }));
                if (revertedAgendas) {
                    broadcastAgendaRowsSync(revertedAgendas);
                }
                return { ok: false, error };
            }

            if (Object.prototype.hasOwnProperty.call(normalizedUpdatedAgenda, 'type')) {
                const { data: refreshedAgenda, error: refreshError } = await fetchAgendaById(id);

                if (refreshError) {
                    console.error('FAILED to refresh agenda after type update:', refreshError);
                } else if (refreshedAgenda) {
                    const normalizedRefreshedAgenda = normalizeAgendaRecord(refreshedAgenda, {
                        mailElectionVotes: stateRef.current.mailElectionVotes
                    });
                    let refreshedAgendas = null;
                    setState(prev => ({
                        ...prev,
                        agendas: (() => {
                            refreshedAgendas = prev.agendas.map((agenda) => (
                                agenda.id === id ? normalizedRefreshedAgenda : agenda
                            ));
                            return refreshedAgendas;
                        })()
                    }));
                    if (refreshedAgendas) {
                        broadcastAgendaRowsSync(refreshedAgendas);
                    }
                }
            }

            return { ok: true };
        },

        deleteAgenda: async (id) => {
            setState(prev => ({ ...prev, agendas: prev.agendas.filter(a => a.id !== id) }));
            await deleteAgendaById(id);
        },

        setAgenda: async (id) => {
            await setAgendaById(id);
        },

        moveAgendaSelection: async (delta) => {
            const navigableAgendaIds = getKeyboardNavigableAgendaIds(stateRef.current.agendas);
            if (!navigableAgendaIds.length || !delta) return;

            const currentIndex = navigableAgendaIds.indexOf(stateRef.current.currentAgendaId);
            const normalizedDelta = delta > 0 ? 1 : -1;
            const nextIndex = currentIndex === -1
                ? (normalizedDelta > 0 ? 0 : navigableAgendaIds.length - 1)
                : Math.min(
                    navigableAgendaIds.length - 1,
                    Math.max(0, currentIndex + normalizedDelta)
                );

            if (currentIndex === nextIndex) return;

            await setAgendaById(navigableAgendaIds[nextIndex]);
        },

        reorderAgendas: async (nextAgendaIds) => {
            if (!Array.isArray(nextAgendaIds) || !nextAgendaIds.length) {
                throw new Error('정렬할 안건 순서가 비어 있습니다.');
            }

            const currentAgendas = [...stateRef.current.agendas].sort((a, b) => a.order_index - b.order_index);
            if (currentAgendas.length !== nextAgendaIds.length) {
                throw new Error('안건 순서 정보가 현재 목록과 일치하지 않습니다.');
            }

            const agendaMap = new Map(currentAgendas.map((agenda) => [agenda.id, agenda]));
            const nextAgendas = nextAgendaIds.map((id, index) => {
                const agenda = agendaMap.get(id);
                if (!agenda) {
                    throw new Error(`존재하지 않는 안건 ID입니다: ${id}`);
                }

                return {
                    ...agenda,
                    order_index: index + 1
                };
            });

            const unchanged = nextAgendas.every((agenda) => {
                const currentAgenda = agendaMap.get(agenda.id);
                return currentAgenda?.order_index === agenda.order_index;
            });

            if (unchanged) return;

            setState(prev => ({
                ...prev,
                agendas: nextAgendas
            }));

            isReorderingAgendasRef.current = true;

            try {
                const tempOffset = nextAgendas.length + 1000;
                const changedAgendas = nextAgendas.filter((agenda) => {
                    const currentAgenda = agendaMap.get(agenda.id);
                    return currentAgenda?.order_index !== agenda.order_index;
                });

                for (const agenda of changedAgendas) {
                    const { error } = await updateAgendaOrderIndex(agenda.id, agenda.order_index + tempOffset);

                    if (error) throw error;
                }

                for (const agenda of changedAgendas) {
                    const { error } = await updateAgendaOrderIndex(agenda.id, agenda.order_index);

                    if (error) throw error;
                }
            } catch (error) {
                await refreshAgendasFromDb();
                throw error;
            } finally {
                isReorderingAgendasRef.current = false;
                await refreshAgendasFromDb();
            }
        },

        addMember: async (member) => {
            const payload = normalizeMemberPayload(member);

            if (!payload.unit || !payload.name) {
                throw new Error('동/호수와 성명은 필수입니다.');
            }

            const { data: maxIdResult, error: maxIdError } = await fetchMaxMemberId();

            if (maxIdError) throw maxIdError;

            const nextId = (maxIdResult?.[0]?.id || 0) + 1;
            const nextMember = { id: nextId, ...payload };

            const hasActiveField = Object.prototype.hasOwnProperty.call(stateRef.current.members?.[0] || {}, 'is_active');
            if (hasActiveField) {
                nextMember.is_active = member?.is_active !== false;
            }

            const { data, error } = await insertMember(nextMember);

            if (error) throw error;
            if (data) {
                setState((prev) => ({
                    ...prev,
                    members: upsertMemberInList(prev.members, data)
                }));

                // Record which meeting this member was added during (for join tracking)
                const contextMeetingId = member?.contextMeetingId || null;
                if (contextMeetingId) {
                    const currentVoteData = stateRef.current.voteData || {};
                    const memberJoinedMeetingId = currentVoteData.memberJoinedMeetingId || {};
                    const newVoteData = createStampedVoteData({
                        ...currentVoteData,
                        memberJoinedMeetingId: {
                            ...memberJoinedMeetingId,
                            [data.id]: contextMeetingId
                        }
                    });
                    setState(prev => ({ ...prev, voteData: newVoteData }));
                    const { error: vdError } = await updateSystemSettings({ vote_data: newVoteData });
                    if (!vdError) broadcastSystemSettingsSync({ vote_data: newVoteData });
                }
            }
            return data;
        },

        setMemberActive: async (memberId, isActive, meetingId = null) => {
            if (!memberId) {
                throw new Error('대상 조합원이 올바르지 않습니다.');
            }

            const currentVoteData = stateRef.current.voteData || {};

            if (meetingId) {
                // Meeting-specific inactive member management
                const currentByMeeting = currentVoteData.inactiveMemberIdsByMeeting || {};
                const meetingInactiveIds = new Set(getInactiveMemberIds(currentVoteData, meetingId));

                if (isActive) {
                    meetingInactiveIds.delete(memberId);
                } else {
                    meetingInactiveIds.add(memberId);
                }

                const newVoteData = createStampedVoteData({
                    ...currentVoteData,
                    inactiveMemberIdsByMeeting: {
                        ...currentByMeeting,
                        [meetingId]: Array.from(meetingInactiveIds).sort((a, b) => a - b)
                    }
                });

                setState(prev => ({ ...prev, voteData: newVoteData }));
                const { error } = await updateSystemSettings({ vote_data: newVoteData });
                if (error) throw error;
                broadcastSystemSettingsSync({ vote_data: newVoteData });
            } else {
                // Legacy global inactive member management
                const inactiveMemberIds = new Set(getInactiveMemberIds(currentVoteData));

                if (isActive) {
                    inactiveMemberIds.delete(memberId);
                } else {
                    inactiveMemberIds.add(memberId);
                }

                const newVoteData = createStampedVoteData({
                    ...currentVoteData,
                    inactiveMemberIds: Array.from(inactiveMemberIds).sort((a, b) => a - b)
                });

                setState(prev => ({ ...prev, voteData: newVoteData }));
                const { error } = await updateSystemSettings({ vote_data: newVoteData });
                if (error) throw error;
                broadcastSystemSettingsSync({ vote_data: newVoteData });
            }
        },

        setAgendaTypeLock: async (agendaId, isLocked) => {
            if (!agendaId) {
                throw new Error('잠금 대상 안건이 올바르지 않습니다.');
            }

            const currentVoteData = stateRef.current.voteData || {};
            const currentLocks = getAgendaTypeLocks(currentVoteData);
            const nextLocks = { ...currentLocks };

            if (isLocked) {
                nextLocks[agendaId] = true;
            } else {
                delete nextLocks[agendaId];
            }

            const newVoteData = createStampedVoteData({
                ...currentVoteData,
                agendaTypeLocks: nextLocks
            });

            setState(prev => ({ ...prev, voteData: newVoteData }));

            const { error } = await updateSystemSettings({ vote_data: newVoteData });

            if (error) throw error;
            broadcastSystemSettingsSync({ vote_data: newVoteData });
        },

        setAgendaOrderLock: async (isLocked) => {
            const currentVoteData = stateRef.current.voteData || {};
            const newVoteData = createStampedVoteData({
                ...currentVoteData,
                agendaOrderLocked: !!isLocked
            });

            setState(prev => ({ ...prev, voteData: newVoteData }));

            const { error } = await updateSystemSettings({ vote_data: newVoteData });

            if (error) throw error;
            broadcastSystemSettingsSync({ vote_data: newVoteData });
        },

        updateMember: async (member) => {
            if (!member?.id) {
                throw new Error('수정할 조합원 정보가 올바르지 않습니다.');
            }

            const updates = normalizeMemberPayload(member);

            if (!updates.unit || !updates.name) {
                throw new Error('동/호수와 성명은 비워둘 수 없습니다.');
            }

            if (Object.prototype.hasOwnProperty.call(member, 'is_active')) {
                updates.is_active = member.is_active;
            }

            const { data, error } = await updateMemberFields(member.id, updates);

            if (error) throw error;
            if (data) {
                setState((prev) => ({
                    ...prev,
                    members: upsertMemberInList(prev.members, data)
                }));
            }
        },

        deleteMember: async (id) => {
            if (!id) {
                throw new Error('삭제할 조합원이 선택되지 않았습니다.');
            }

            const currentVoteData = stateRef.current.voteData || {};
            const nextVoteData = createStampedVoteData({
                ...currentVoteData,
                inactiveMemberIds: getInactiveMemberIds(currentVoteData).filter((memberId) => memberId !== id)
            });

            const { error } = await deleteMemberById(id);

            if (error) throw error;

            const { error: settingsError } = await updateSystemSettings({ vote_data: nextVoteData });

            if (settingsError) throw settingsError;
            broadcastSystemSettingsSync({ vote_data: nextVoteData });

            setState((prev) => ({
                ...prev,
                members: prev.members.filter((member) => member.id !== id),
                voteData: nextVoteData
            }));
        },

        updateVoteData: async (field, value) => {
            const currentVoteData = stateRef.current.voteData;
            const newVoteData = createStampedVoteData({ ...currentVoteData, [field]: value });

            setState(prev => ({ ...prev, voteData: newVoteData }));

            const { error } = await updateSystemSettings({ vote_data: newVoteData });

            if (error) console.error("Update VoteData Error:", error);
            else {
                broadcastSystemSettingsSync({ vote_data: newVoteData });
            }
        },

        updatePresentationPage: async (delta) => {
            const currentVoteData = stateRef.current.voteData;
            const currentProjectorMode = stateRef.current.projectorMode;
            const currentProjectorData = stateRef.current.projectorData;
            const currentPage = parseInt(currentVoteData.presentationPage) || 1;
            const newPage = Math.max(1, currentPage + delta);

            if (currentPage === newPage) return;

            const newVoteData = createStampedVoteData({ ...currentVoteData, presentationPage: newPage });
            stateRef.current = {
                ...stateRef.current,
                projectorMode: currentProjectorMode,
                projectorData: currentProjectorData,
                voteData: newVoteData
            };
            setState(prev => ({
                ...prev,
                projectorMode: currentProjectorMode,
                projectorData: currentProjectorData,
                voteData: newVoteData
            }));
            broadcastSystemSettingsSync({
                projector_mode: currentProjectorMode,
                projector_data: currentProjectorData,
                vote_data: newVoteData
            });

            await updateSystemSettingsWithRetry(
                {
                    projector_mode: currentProjectorMode,
                    projector_data: currentProjectorData,
                    vote_data: newVoteData
                },
                'Update Presentation Page Error'
            );
        },

        setPresentationPage: async (page) => {
            const normalizedPage = Math.max(1, parseInt(page, 10) || 1);
            const currentVoteData = stateRef.current.voteData;
            const currentProjectorMode = stateRef.current.projectorMode;
            const currentProjectorData = stateRef.current.projectorData;

            if ((parseInt(currentVoteData.presentationPage, 10) || 1) === normalizedPage) return;

            const newVoteData = createStampedVoteData({ ...currentVoteData, presentationPage: normalizedPage });
            stateRef.current = {
                ...stateRef.current,
                projectorMode: currentProjectorMode,
                projectorData: currentProjectorData,
                voteData: newVoteData
            };
            setState(prev => ({
                ...prev,
                projectorMode: currentProjectorMode,
                projectorData: currentProjectorData,
                voteData: newVoteData
            }));
            broadcastSystemSettingsSync({
                projector_mode: currentProjectorMode,
                projector_data: currentProjectorData,
                vote_data: newVoteData
            });

            await updateSystemSettingsWithRetry(
                {
                    projector_mode: currentProjectorMode,
                    projector_data: currentProjectorData,
                    vote_data: newVoteData
                },
                'Set Presentation Page Error'
            );
        },

        setProjectorMode: async (mode, data = null) => {
            const currentVoteData = stateRef.current.voteData || {};
            const nextVoteData = createStampedVoteData((mode === 'RESULT' && data?.declaration !== undefined)
                ? {
                    ...currentVoteData,
                    customDeclaration: data.declaration || '',
                    resultDeclaration: data.declaration || '',
                    resultAgendaId: data.agendaId || null,
                    resultVotesYes: data.votesYes ?? 0,
                    resultVotesNo: data.votesNo ?? 0,
                    resultVotesAbstain: data.votesAbstain ?? 0,
                    resultTotalAttendance: data.totalAttendance ?? 0,
                    resultIsPassed: !!data.isPassed
                }
                : currentVoteData);

            stateRef.current = {
                ...stateRef.current,
                projectorMode: mode,
                projectorData: data,
                voteData: nextVoteData
            };

            setState(prev => ({
                ...prev,
                projectorMode: mode,
                projectorData: data,
                voteData: nextVoteData
            }));

            broadcastSystemSettingsSync({
                projector_mode: mode,
                projector_data: data,
                vote_data: nextVoteData
            });

            await updateSystemSettingsWithRetry(
                {
                    projector_mode: mode,
                    projector_data: data,
                    vote_data: nextVoteData
                },
                'Set Projector Mode Error'
            );
        },

        updateProjectorData: async (data) => {
            const currentVoteData = stateRef.current.voteData || {};
            const nextVoteData = createStampedVoteData({
                ...currentVoteData,
                customDeclaration: data?.declaration || '',
                resultDeclaration: data?.declaration || '',
                resultAgendaId: data?.agendaId || currentVoteData.resultAgendaId || null,
                resultVotesYes: data?.votesYes ?? currentVoteData.resultVotesYes ?? 0,
                resultVotesNo: data?.votesNo ?? currentVoteData.resultVotesNo ?? 0,
                resultVotesAbstain: data?.votesAbstain ?? currentVoteData.resultVotesAbstain ?? 0,
                resultTotalAttendance: data?.totalAttendance ?? currentVoteData.resultTotalAttendance ?? 0,
                resultIsPassed: data?.isPassed ?? currentVoteData.resultIsPassed ?? false
            });

            stateRef.current = {
                ...stateRef.current,
                projectorData: data,
                voteData: nextVoteData
            };

            setState(prev => ({
                ...prev,
                projectorData: data,
                voteData: nextVoteData
            }));

            const { error } = await updateSystemSettings({
                projector_data: data,
                vote_data: nextVoteData
            });

            if (error) {
                console.error('Update Projector Data Error:', error);
                return;
            }

            broadcastSystemSettingsSync({
                projector_data: data,
                vote_data: nextVoteData
            });
        },

        // Declaration Editing State Management (per-agenda, local only)
        setDeclarationEditMode: (agendaId, isEditing, isAutoCalc) => {
            setState(prev => ({
                ...prev,
                declarationEditState: {
                    ...prev.declarationEditState,
                    [agendaId]: { isEditing, isAutoCalc }
                }
            }));
        },

        getDeclarationEditState: (agendaId) => {
            const editState = stateRef.current.declarationEditState[agendaId];
            return editState || { isEditing: false, isAutoCalc: true };
        },

        resetHelper: async () => { }
    }), [broadcastAgendaRowsSync, broadcastSystemSettingsSync, createStampedVoteData, reconcileAgendaVoteCountsFromWrittenVotes, refreshAgendasFromDb, refreshAttendanceFromDb, refreshMailElectionVotesFromDb, setAgendaById]); // Actions are stable because they use stateRef to access current state values

    return (
        <StoreContext.Provider value={{ state, actions }}>
            {children}
        </StoreContext.Provider>
    );
}

// Hook to consume the store
export function useStore() {
    const context = useContext(StoreContext);
    if (!context) {
        throw new Error('useStore must be used within a StoreProvider');
    }
    return context;
}
