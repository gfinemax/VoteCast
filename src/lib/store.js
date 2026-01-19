'use client';

import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { supabase } from '@/lib/supabase';

// Initial Empty Data (will be populated from DB)
const INITIAL_DATA = {
    agendas: [],
    members: [],
    attendance: [],
    currentMeetingId: null, // Legacy/UI: Selected Folder(General Meeting) for Admin View
    activeMeetingId: null,  // New: GLOBALLY Active Meeting for Admission (controlled by Admin)
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
    masterPresentationSource: null, // Global Master PPT
    projectorConnected: false, // New: Projector Online Status
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
                const { data: settings } = await supabase.from('system_settings').select('*').eq('id', 1).single();
                const { data: agendas } = await supabase.from('agendas').select('*').order('order_index', { ascending: true });
                const { data: members } = await supabase.from('members').select('*').order('id', { ascending: true });
                const { data: attendance } = await supabase.from('attendance').select('*');

                // Determine default meeting ID (First folder or first agenda)
                let defaultMeetingId = null;
                if (agendas && agendas.length > 0) {
                    const firstFolder = agendas.find(a => a.type === 'folder');
                    defaultMeetingId = firstFolder ? firstFolder.id : null;
                }

                if (settings) {
                    setState(prev => ({
                        ...prev,
                        agendas: agendas || [],
                        members: members || [],
                        attendance: attendance || [],
                        voteData: { ...INITIAL_DATA.voteData, ...(settings.vote_data || {}) },
                        currentAgendaId: settings.current_agenda_id || 1,
                        currentMeetingId: defaultMeetingId, // Store Local Admin View Context
                        activeMeetingId: settings.active_meeting_id || null, // Global Admission Context
                        projectorMode: settings.projector_mode || 'IDLE',
                        projectorData: null,
                        masterPresentationSource: settings.master_presentation_source // Sync Master PPT
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
                        activeMeetingId: payload.new.active_meeting_id, // Sync Active Meeting
                        projectorMode: payload.new.projector_mode,
                        masterPresentationSource: payload.new.master_presentation_source
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
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance' }, (payload) => {
                console.log('[Realtime] Attendance INSERT:', payload.new);
                setState(prev => {
                    // Remove potential optimistic record (deduplicate by composite key)
                    const cleanList = prev.attendance.filter(a =>
                        !(a.member_id === payload.new.member_id && a.meeting_id === payload.new.meeting_id)
                    );
                    return {
                        ...prev,
                        attendance: [...cleanList, payload.new]
                    };
                });
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'attendance' }, (payload) => {
                console.log('[Realtime] Attendance DELETE:', payload.old);
                setState(prev => ({
                    ...prev,
                    attendance: prev.attendance.filter(a => a.id !== payload.old.id)
                }));
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'attendance' }, (payload) => {
                console.log('[Realtime] Attendance UPDATE:', payload.new);
                setState(prev => ({
                    ...prev,
                    attendance: prev.attendance.map(a => a.id === payload.new.id ? payload.new : a)
                }));
            })
            .subscribe((status) => {
                console.log('[Realtime] Subscription Status:', status);
            });

        // New: Presence Channel for Projector Detection
        const presenceChannel = supabase.channel('room_presence', {
            config: {
                presence: {
                    key: 'admin',
                },
            },
        });

        presenceChannel
            .on('presence', { event: 'sync' }, () => {
                const newState = presenceChannel.presenceState();
                // Check if any presence entry has type: 'projector'
                const isConnected = Object.values(newState).some(users =>
                    users.some(user => user.type === 'projector')
                );

                setState(prev => {
                    if (prev.projectorConnected === isConnected) return prev;
                    return { ...prev, projectorConnected: isConnected };
                });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            supabase.removeChannel(presenceChannel);
        };
    }, []);

    // Ref for latest state in async actions
    const stateRef = useRef(state);
    useEffect(() => { stateRef.current = state; }, [state]);

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
            const { error } = await supabase.from('system_settings')
                .update({ active_meeting_id: id })
                .eq('id', 1);
            if (error) console.error("Failed to set active meeting:", error);
        },

        checkInMember: async (memberId, type = 'direct', proxyName = null, votes = null) => {
            // USE ACTIVE MEETING ID (Global)
            const meetingId = stateRef.current.activeMeetingId;
            if (!meetingId) {
                console.error("No active meeting open for admission.");
                return; // Block check-in if no meeting is active
            }

            // Optimistic Update (Attendance Only)
            const tempId = Date.now();
            const newRecord = {
                id: tempId,
                member_id: memberId,
                meeting_id: meetingId,
                type,
                proxy_name: proxyName,
                created_at: new Date().toISOString()
            };

            setState(prev => ({
                ...prev,
                attendance: [...prev.attendance, newRecord]
            }));

            // Use RPC for Transactional Check-in (with Votes)
            // Even if no votes, RPC handles attendance insert safely.
            const { error } = await supabase.rpc('check_in_member', {
                p_member_id: memberId,
                p_meeting_id: meetingId,
                p_type: type,
                p_proxy_name: proxyName,
                p_votes: votes // Can be null
            });

            if (error) {
                // If RPC fails (e.g., function not found), try fallback only if NO votes
                if (error.code === '42883' && !votes) { // undefined_function
                    console.warn("RPC 'check_in_member' not found. Falling back to simple insert.");
                    const { error: fallbackError } = await supabase.from('attendance').insert({
                        member_id: memberId,
                        meeting_id: meetingId,
                        type,
                        proxy_name: proxyName
                    });
                    if (fallbackError) {
                        console.error("Fallback Check-in Failed:", fallbackError);
                        // Rollback
                        setState(prev => ({
                            ...prev,
                            attendance: prev.attendance.filter(a => a.id !== tempId)
                        }));
                    }
                } else {
                    console.error("Check-in Transaction Failed:", error);
                    // Rollback
                    setState(prev => ({
                        ...prev,
                        attendance: prev.attendance.filter(a => a.id !== tempId)
                    }));
                }
            }
        },

        cancelCheckInMember: async (memberId) => {
            // Cancel from the ACTIVE meeting context
            const meetingId = stateRef.current.activeMeetingId;
            if (!meetingId) return;

            // Optimistic Update
            setState(prev => ({
                ...prev,
                attendance: prev.attendance.filter(a => !(a.member_id === memberId && a.meeting_id === meetingId))
            }));

            // Use RPC to Cancel (and reverse votes)
            const { error } = await supabase.rpc('cancel_check_in_member', {
                p_member_id: memberId,
                p_meeting_id: meetingId
            });

            if (error) {
                // Fallback for simple delete if RPC missing
                if (error.code === '42883') {
                    console.warn("RPC 'cancel_check_in_member' not found. Falling back to simple delete.");
                    const { error: fallbackError } = await supabase.from('attendance')
                        .delete()
                        .eq('member_id', memberId)
                        .eq('meeting_id', meetingId);
                    if (fallbackError) console.error("Fallback Cancel Check-in Failed:", fallbackError);
                } else {
                    console.error("Cancel Check-in Failed:", error);
                }
            }
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
                // Fetch all items that need shifting, ORDER BY DESC to avoid unique constraint collisions (shift last items first)
                const { data: allAgendas } = await supabase
                    .from('agendas')
                    .select('id, order_index')
                    .gte('order_index', newOrderIndex)
                    .order('order_index', { ascending: false });

                if (allAgendas && allAgendas.length > 0) {
                    for (const item of allAgendas) {
                        const { error: moveError } = await supabase.from('agendas').update({ order_index: item.order_index + 1 }).eq('id', item.id);
                        if (moveError) console.error("Failed to shift agenda:", item.id, moveError);
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

            // Generate Manual ID (DB missing sequence)
            const { data: maxIdResult } = await supabase.from('agendas').select('id').order('id', { ascending: false }).limit(1);
            const nextId = (maxIdResult?.[0]?.id || 0) + 1;

            // Insert into DB (Let DB handle ID)
            const { data: insertedData, error } = await supabase.from('agendas').insert({
                ...newAgenda,
                id: nextId,
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
                console.error("Failed to add agenda:", JSON.stringify(error, null, 2));
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
                customDeclaration: defaultDecl,
                presentationPage: targetAgenda.start_page || 1
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

        updatePresentationPage: async (delta) => {
            const currentVoteData = stateRef.current.voteData;
            const currentPage = parseInt(currentVoteData.presentationPage) || 1;
            const newPage = Math.max(1, currentPage + delta);

            if (currentPage === newPage) return;

            const newVoteData = { ...currentVoteData, presentationPage: newPage };
            setState(prev => ({ ...prev, voteData: newVoteData }));

            await supabase.from('system_settings')
                .update({ vote_data: newVoteData })
                .eq('id', 1);
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
    }), []); // Actions are stable because they use stateRef to access current state values

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
