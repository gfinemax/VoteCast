'use client';

import { useState, useEffect } from 'react';

// Initial Mock Data
const INITIAL_DATA = {
    agendas: [
        { id: 1, title: '제1호 안건: 조합 규약 변경의 건', type: 'general' },
        { id: 2, title: '제2호 안건: 시공사 선정 추인의 건', type: 'general' },
        { id: 3, title: '제3호 안건: 사업비 예산(안) 승인의 건', type: 'special' },
    ],
    members: Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        unit: `101-${101 + i}`,
        name: ['김철수', '이영희', '박민수', '최지우', '정우성'][i % 5],
        isCheckedIn: false,
        checkInTime: null
    })),
    voteData: { // Current vote status for admin input
        writtenAttendance: 300,
        votesYes: 0,
        votesNo: 0,
        votesAbstain: 0,
    },
    currentAgendaId: 1,

    // Projector State
    projectorMode: 'IDLE', // 'IDLE' | 'PPT' | 'RESULT'
    projectorData: null,   // Data to display when in RESULT mode
};

const STORE_KEY = 'votecast_store_v1';

export function useStore() {
    // Initialize state from localStorage or default
    const [state, setState] = useState(() => {
        if (typeof window === 'undefined') return INITIAL_DATA;
        const saved = localStorage.getItem(STORE_KEY);
        return saved ? JSON.parse(saved) : INITIAL_DATA;
    });

    // Sync with other tabs
    useEffect(() => {
        const handleStorageChange = (e) => {
            if (e.key === STORE_KEY && e.newValue) {
                setState(JSON.parse(e.newValue));
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    // Save to localStorage whenever state changes
    const saveState = (newState) => {
        const nextState = { ...state, ...newState };
        setState(nextState);
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORE_KEY, JSON.stringify(nextState));
            // Dispatch event for same-tab updates (storage event only fires for other tabs)
            window.dispatchEvent(new Event('storage-local'));
        }
    };

    // Actions
    const actions = {
        // Check-in Actions
        checkInMember: (id) => {
            saveState({
                members: state.members.map(m =>
                    m.id === id ? { ...m, isCheckedIn: true, checkInTime: new Date().toISOString() } : m
                )
            });
        },

        // Admin Actions
        setAgenda: (id) => saveState({ currentAgendaId: id }),

        updateVoteData: (field, value) => {
            saveState({
                voteData: { ...state.voteData, [field]: value }
            });
        },

        setProjectorMode: (mode, data = null) => {
            saveState({
                projectorMode: mode,
                projectorData: data || state.projectorData
            });
        },

        resetHelper: () => saveState(INITIAL_DATA)
    };

    return { state, actions };
}
