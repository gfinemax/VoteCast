'use client';

import { useEffect } from 'react';
import {
    WINDOW_AGENDAS_SYNC_CHANNEL,
    WINDOW_AGENDAS_SYNC_STORAGE_KEY,
    WINDOW_SYNC_CHANNEL,
    WINDOW_SYNC_STORAGE_KEY
} from './storeState';
import { isAbortError, serializeSupabaseError } from './storeSupabase';

export const createSystemSettingsSnapshot = (currentState = {}, overrides = {}) => {
    const hasOwn = (key) => Object.prototype.hasOwnProperty.call(overrides, key);

    return {
        current_agenda_id: hasOwn('current_agenda_id') ? overrides.current_agenda_id : currentState.currentAgendaId,
        active_meeting_id: hasOwn('active_meeting_id') ? overrides.active_meeting_id : currentState.activeMeetingId,
        projector_mode: hasOwn('projector_mode') ? overrides.projector_mode : currentState.projectorMode,
        vote_data: hasOwn('vote_data') ? overrides.vote_data : currentState.voteData,
        master_presentation_source: hasOwn('master_presentation_source') ? overrides.master_presentation_source : currentState.masterPresentationSource,
        projector_data: hasOwn('projector_data') ? overrides.projector_data : currentState.projectorData
    };
};

const writeAndClearLocalStorage = (key, message, errorLabel) => {
    try {
        window.localStorage.setItem(key, JSON.stringify(message));
        window.localStorage.removeItem(key);
    } catch (error) {
        console.error(errorLabel, error);
    }
};

const safelySendChannelMessage = (channel, message, errorLabel) => {
    try {
        const result = channel?.send(message);
        if (result && typeof result.catch === 'function') {
            result.catch((error) => {
                if (isAbortError(error)) return;
                console.warn(errorLabel, serializeSupabaseError(error));
            });
        }
    } catch (error) {
        if (isAbortError(error)) return;
        console.warn(errorLabel, serializeSupabaseError(error));
    }
};

export const broadcastSystemSettingsMessage = ({
    overrides = {},
    windowSyncIdRef,
    stateRef,
    broadcastChannelRef,
    systemSettingsChannelRef
} = {}) => {
    if (typeof window === 'undefined') return;

    const message = {
        senderId: windowSyncIdRef.current,
        sentAt: Date.now(),
        settings: createSystemSettingsSnapshot(stateRef.current, overrides)
    };

    try {
        broadcastChannelRef.current?.postMessage(message);
    } catch (error) {
        console.error('Failed to post BroadcastChannel sync message:', error);
    }

    writeAndClearLocalStorage(
        WINDOW_SYNC_STORAGE_KEY,
        message,
        'Failed to write localStorage sync message:'
    );

    safelySendChannelMessage(
        systemSettingsChannelRef.current,
        {
            type: 'broadcast',
            event: 'system_settings_sync',
            payload: message
        },
        'Failed to send Supabase system settings sync message:'
    );
};

export const broadcastAgendaRowsMessage = ({
    rows = [],
    windowSyncIdRef,
    agendaBroadcastChannelRef
} = {}) => {
    if (typeof window === 'undefined') return;

    const message = {
        senderId: windowSyncIdRef.current,
        sentAt: Date.now(),
        agendas: rows
    };

    try {
        agendaBroadcastChannelRef.current?.postMessage(message);
    } catch (error) {
        console.error('Failed to post agenda BroadcastChannel sync message:', error);
    }

    writeAndClearLocalStorage(
        WINDOW_AGENDAS_SYNC_STORAGE_KEY,
        message,
        'Failed to write agenda localStorage sync message:'
    );
};

export const useSystemSettingsWindowSync = ({
    windowSyncIdRef,
    lastAppliedSystemSyncVersionRef,
    broadcastChannelRef,
    applySystemSettingsToState
}) => {
    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const applyIncomingWindowSync = (message) => {
            if (!message?.settings) return;
            if (message.senderId === windowSyncIdRef.current) return;
            if ((message.sentAt || 0) < lastAppliedSystemSyncVersionRef.current) return;

            applySystemSettingsToState(message.settings, {
                preserveCurrentMeetingId: true,
                projectorData: message.settings.projector_data ?? null
            });
        };

        if ('BroadcastChannel' in window) {
            const channel = new BroadcastChannel(WINDOW_SYNC_CHANNEL);
            broadcastChannelRef.current = channel;
            channel.onmessage = (event) => applyIncomingWindowSync(event.data);
        }

        const handleStorage = (event) => {
            if (event.key !== WINDOW_SYNC_STORAGE_KEY || !event.newValue) return;

            try {
                applyIncomingWindowSync(JSON.parse(event.newValue));
            } catch (error) {
                console.error('Failed to parse localStorage sync message:', error);
            }
        };

        window.addEventListener('storage', handleStorage);

        return () => {
            window.removeEventListener('storage', handleStorage);
            if (broadcastChannelRef.current) {
                broadcastChannelRef.current.close();
                broadcastChannelRef.current = null;
            }
        };
    }, [applySystemSettingsToState, broadcastChannelRef, lastAppliedSystemSyncVersionRef, windowSyncIdRef]);
};

export const useAgendaRowsWindowSync = ({
    windowSyncIdRef,
    lastAgendaSyncMessageAtRef,
    agendaBroadcastChannelRef,
    applyAgendaRowsToState
}) => {
    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const applyIncomingAgendaSync = (message) => {
            if (!Array.isArray(message?.agendas)) return;
            if (message.senderId === windowSyncIdRef.current) return;
            if ((message.sentAt || 0) < lastAgendaSyncMessageAtRef.current) return;

            lastAgendaSyncMessageAtRef.current = message.sentAt || lastAgendaSyncMessageAtRef.current;

            applyAgendaRowsToState(message.agendas);
        };

        if ('BroadcastChannel' in window) {
            const channel = new BroadcastChannel(WINDOW_AGENDAS_SYNC_CHANNEL);
            agendaBroadcastChannelRef.current = channel;
            channel.onmessage = (event) => applyIncomingAgendaSync(event.data);
        }

        const handleStorage = (event) => {
            if (event.key !== WINDOW_AGENDAS_SYNC_STORAGE_KEY || !event.newValue) return;

            try {
                applyIncomingAgendaSync(JSON.parse(event.newValue));
            } catch (error) {
                console.error('Failed to parse agenda localStorage sync message:', error);
            }
        };

        window.addEventListener('storage', handleStorage);

        return () => {
            window.removeEventListener('storage', handleStorage);
            if (agendaBroadcastChannelRef.current) {
                agendaBroadcastChannelRef.current.close();
                agendaBroadcastChannelRef.current = null;
            }
        };
    }, [agendaBroadcastChannelRef, applyAgendaRowsToState, lastAgendaSyncMessageAtRef, windowSyncIdRef]);
};
