'use client';

import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { supabase } from '@/lib/supabase';

// Initial Empty Data (will be populated from DB)
const INITIAL_DATA = {
    agendas: [],
    members: [],
    voteData: {
        totalMembers: 0,
        directAttendance: 0,
        proxyAttendance: 0,
        writtenAttendance: 0,
        voteType: 'majority',
        votesYes: 0,
        votesNo: 0,
        votesAbstain: 0,
        customDeclaration: '',
    },
    currentAgendaId: 1,
    projectorMode: 'IDLE',
    projectorData: null,
};

// Create Context
const StoreContext = createContext(null);

// Provider Component
export function StoreProvider({ children }) {
    const [state, setState] = useState(INITIAL_DATA);
    const [isInitialized, setIsInitialized] = useState(false);

    // Initial Fetch
    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data: settings } = await supabase
                    .from('system_settings')
                    .select('*')
                    .eq('id', 1)
                    .single();

                const { data: agendas } = await supabase
                    .from('agendas')
                    .select('*')
                    .order('order_index', { ascending: true });

                const { data: members } = await supabase
                    .from('members')
                    .select('*')
                    .order('id', { ascending: true });

                if (settings) {
                    setState(prev => ({
                        ...prev,
                        agendas: agendas || [],
                        members: members || [],
                        voteData: { ...INITIAL_DATA.voteData, ...(settings.vote_data || {}) },
                        currentAgendaId: settings.current_agenda_id || 1,
                        projectorMode: settings.projector_mode || 'IDLE',
                        projectorData: null
                    }));
                }
                setIsInitialized(true);
            } catch (error) {
                console.error("Error fetching initial data:", error);
            }
        };

        fetchData();
    }, []);

    // Realtime Subscriptions
    useEffect(() => {
        const channel = supabase.channel('room_common')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'system_settings' }, (payload) => {
                if (payload.new && payload.new.id === 1) {
                    setState(prev => ({
                        ...prev,
                        voteData: { ...INITIAL_DATA.voteData, ...(payload.new.vote_data || {}) },
                        currentAgendaId: payload.new.current_agenda_id,
                        projectorMode: payload.new.projector_mode
                    }));
                }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'agendas' }, async () => {
                const { data } = await supabase.from('agendas').select('*').order('order_index');
                if (data) setState(prev => ({ ...prev, agendas: data }));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, async () => {
                const { data } = await supabase.from('members').select('*').order('id');
                if (data) setState(prev => ({ ...prev, members: data }));
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Ref for latest state in async actions
    const stateRef = useRef(state);
    useEffect(() => { stateRef.current = state; }, [state]);

    // Actions
    const actions = {
        checkInMember: async (id, type = 'direct') => {
            setState(prev => ({
                ...prev,
                members: prev.members.map(m => m.id === id ? { ...m, is_checked_in: true, check_in_type: type } : m)
            }));
            await supabase.from('members')
                .update({ is_checked_in: true, check_in_type: type, check_in_time: new Date().toISOString() })
                .eq('id', id);
        },

        cancelCheckInMember: async (id) => {
            setState(prev => ({
                ...prev,
                members: prev.members.map(m => m.id === id ? { ...m, is_checked_in: false, check_in_type: null } : m)
            }));
            await supabase.from('members')
                .update({ is_checked_in: false, check_in_type: null, check_in_time: null })
                .eq('id', id);
        },

        addAgenda: async (newAgenda, insertAfterOrderIndex = null) => {
            // Optimistic ID (temp) - ensuring it doesn't collide with real IDs (usually small integers)
            const tempId = Date.now();

            let autoType = newAgenda.type || 'majority';
            if (newAgenda.title && newAgenda.title.includes('선출')) {
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
                // Fetch all items that need shifting
                const { data: allAgendas } = await supabase.from('agendas').select('id, order_index').gte('order_index', newOrderIndex);
                if (allAgendas && allAgendas.length > 0) {
                    for (const item of allAgendas) {
                        await supabase.from('agendas').update({ order_index: item.order_index + 1 }).eq('id', item.id);
                    }
                }
            } else {
                // Append Mode
                const { data: maxOrder } = await supabase.from('agendas').select('order_index').order('order_index', { ascending: false }).limit(1);
                newOrderIndex = (maxOrder?.[0]?.order_index || 0) + 1;

                // Optimistic Append
                setState(prev => ({
                    ...prev,
                    agendas: [...prev.agendas, { ...newAgenda, type: autoType, id: tempId, order_index: newOrderIndex }]
                }));
            }

            // Insert into DB (Let DB handle ID)
            const { data: insertedData, error } = await supabase.from('agendas').insert({
                ...newAgenda,
                type: autoType,
                order_index: newOrderIndex
            }).select().single();

            if (insertedData) {
                // Replace temp ID with real ID in local state to prevent "flash" or ref issues
                setState(prev => ({
                    ...prev,
                    agendas: prev.agendas.map(a => a.id === tempId ? insertedData : a)
                }));
            } else if (error) {
                console.error("Failed to add agenda:", error);
                // Rollback optimistic update
                setState(prev => ({
                    ...prev,
                    agendas: prev.agendas.filter(a => a.id !== tempId)
                }));
            }
        },

        updateAgenda: async (updatedAgenda) => {
            setState(prev => ({
                ...prev,
                agendas: prev.agendas.map(a => a.id === updatedAgenda.id ? { ...a, ...updatedAgenda } : a)
            }));

            const { id, ...fields } = updatedAgenda;
            const { error } = await supabase.from('agendas').update(fields).eq('id', id);
            if (error) {
                console.error("FAILED to update Agenda:", error);
            }
        },

        deleteAgenda: async (id) => {
            setState(prev => ({ ...prev, agendas: prev.agendas.filter(a => a.id !== id) }));
            await supabase.from('agendas').delete().eq('id', id);
        },

        setAgenda: async (id) => {
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
            const total = (vData.writtenAttendance || 0) + (vData.directAttendance || 0) + (vData.proxyAttendance || 0);
            const criterion = newType === 'twoThirds' ? "3분의 2 이상" : "과반수 이상";
            const votesYes = vData.votesYes || 0;
            const votesNo = vData.votesNo || 0;
            const votesAbstain = vData.votesAbstain || 0;

            const defaultDecl = total > 0 ? `"${targetAgenda.title}" 서면결의 포함 찬성(${votesYes})표, 반대(${votesNo})표, 기권(${votesAbstain})표로
전체 참석자(${total.toLocaleString()})명중 ${criterion} 찬성으로
"${targetAgenda.title}"은 가결되었음을 선포합니다.` : "";

            const newVoteData = {
                ...vData,
                voteType: newType,
                customDeclaration: defaultDecl
            };

            console.log('[setAgenda] Setting currentAgendaId to:', id);

            // Optimistic Update - THIS NOW UPDATES THE SHARED STATE
            setState(prev => ({
                ...prev,
                currentAgendaId: id,
                voteData: newVoteData
            }));

            const { error } = await supabase.from('system_settings').update({
                current_agenda_id: id,
                vote_data: newVoteData
            }).eq('id', 1);

            if (error) console.error("Set Agenda Error:", error);
        },

        updateVoteData: async (field, value) => {
            const currentVoteData = stateRef.current.voteData;
            const newVoteData = { ...currentVoteData, [field]: value };

            setState(prev => ({ ...prev, voteData: newVoteData }));

            const { error } = await supabase.from('system_settings')
                .update({ vote_data: newVoteData })
                .eq('id', 1);

            if (error) console.error("Update VoteData Error:", error);
        },

        setProjectorMode: async (mode, data = null) => {
            // Save both mode AND data to state
            setState(prev => ({
                ...prev,
                projectorMode: mode,
                projectorData: data  // This was missing!
            }));

            await supabase.from('system_settings')
                .update({ projector_mode: mode })
                .eq('id', 1);
        },

        resetHelper: async () => { }
    };

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
