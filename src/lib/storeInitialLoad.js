'use client';

import { useEffect } from 'react';
import { normalizeAttendanceRecord } from './storeNormalizers';
import { normalizeAgendaRecord } from './storeSelectors';
import { isAbortError, queryWithRetry } from './storeSupabase';
import {
    fetchAgendas,
    fetchAttendance,
    fetchMailElectionVotes,
    fetchMembers
} from './votecastRepository';

const INITIAL_DATA_CACHE_KEY = 'votecast_initial_data_cache';

const getDefaultMeetingId = (agendas = []) => {
    if (agendas.length === 0) return null;

    const firstFolder = agendas.find((agenda) => agenda.type === 'folder');
    return firstFolder ? firstFolder.id : null;
};

const readCachedInitialData = () => {
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.localStorage.getItem(INITIAL_DATA_CACHE_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;

        return {
            agendas: Array.isArray(parsed.agendas) ? parsed.agendas : [],
            members: Array.isArray(parsed.members) ? parsed.members : [],
            attendance: Array.isArray(parsed.attendance) ? parsed.attendance : [],
            mailElectionVotes: Array.isArray(parsed.mailElectionVotes) ? parsed.mailElectionVotes : [],
            savedAt: parsed.savedAt || null
        };
    } catch (error) {
        console.warn('Failed to read cached initial data:', error);
        return null;
    }
};

const writeCachedInitialData = ({ agendas, members, attendance, mailElectionVotes }) => {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(INITIAL_DATA_CACHE_KEY, JSON.stringify({
            agendas,
            members,
            attendance,
            mailElectionVotes,
            savedAt: new Date().toISOString()
        }));
    } catch (error) {
        console.warn('Failed to write cached initial data:', error);
    }
};

export const useInitialStoreData = ({
    stateRef,
    setState,
    setIsInitialized,
    reconcileAgendaVoteCountsFromWrittenVotes,
    refreshSystemSettingsFromDb
}) => {
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [
                    agendas,
                    members,
                    attendance,
                    mailElectionVotes
                ] = await Promise.all([
                    queryWithRetry(fetchAgendas, 'Failed to load initial agendas', { retries: 0 }),
                    queryWithRetry(fetchMembers, 'Failed to load initial members', { retries: 0 }),
                    queryWithRetry(fetchAttendance, 'Failed to load initial attendance', { retries: 0 }),
                    queryWithRetry(fetchMailElectionVotes, 'Failed to load initial mail election votes', { retries: 0, suppressCodes: ['42P01'] })
                ]);
                const hasCriticalLoadFailure = !agendas || !members || !attendance;
                const cachedData = hasCriticalLoadFailure ? readCachedInitialData() : null;

                const resolvedAgendas = agendas || cachedData?.agendas || [];
                const resolvedMembers = members || cachedData?.members || [];
                const resolvedAttendance = attendance || cachedData?.attendance || [];
                const resolvedMailElectionVotes = mailElectionVotes || cachedData?.mailElectionVotes || [];

                let nextAgendas = resolvedAgendas.map((agenda) => normalizeAgendaRecord(agenda, {
                    mailElectionVotes: resolvedMailElectionVotes
                }));

                if (!hasCriticalLoadFailure) {
                    writeCachedInitialData({
                        agendas: resolvedAgendas,
                        members: resolvedMembers,
                        attendance: resolvedAttendance,
                        mailElectionVotes: resolvedMailElectionVotes
                    });
                }

                if (!hasCriticalLoadFailure) {
                    const didReconcile = await reconcileAgendaVoteCountsFromWrittenVotes(nextAgendas, {
                        attendanceRows: resolvedAttendance,
                        membersRows: resolvedMembers,
                        voteData: stateRef.current.voteData
                    });
                    if (didReconcile) {
                        const refreshedAgendas = await queryWithRetry(fetchAgendas, 'Failed to refresh reconciled agendas');
                        nextAgendas = (refreshedAgendas || nextAgendas).map((agenda) => normalizeAgendaRecord(agenda, {
                            mailElectionVotes: resolvedMailElectionVotes
                        }));
                    }
                }

                const defaultMeetingId = getDefaultMeetingId(nextAgendas);
                const dataConnectionError = hasCriticalLoadFailure
                    ? cachedData
                        ? 'Supabase 데이터 응답이 지연되어 마지막 저장 데이터를 표시 중입니다.'
                        : 'Supabase 데이터 응답을 받지 못했습니다. 프로젝트 상태와 API 키를 확인해주세요.'
                    : null;

                setState((prev) => ({
                    ...prev,
                    agendas: nextAgendas,
                    members: resolvedMembers,
                    attendance: resolvedAttendance.map(normalizeAttendanceRecord),
                    mailElectionVotes: resolvedMailElectionVotes,
                    dataConnectionError,
                    lastDataSyncAt: hasCriticalLoadFailure ? cachedData?.savedAt || null : new Date().toISOString()
                }));

                if (!hasCriticalLoadFailure) {
                    await refreshSystemSettingsFromDb({ defaultMeetingId, allowLegacyVersion: true });
                } else {
                    setState((prev) => ({
                        ...prev,
                        currentMeetingId: defaultMeetingId ?? prev.currentMeetingId,
                        activeMeetingId: defaultMeetingId ?? prev.activeMeetingId
                    }));
                }

                setIsInitialized(true);
            } catch (error) {
                if (isAbortError(error)) return;
                console.error('Error fetching initial data:', error);
                const cachedData = readCachedInitialData();

                if (cachedData) {
                    const nextAgendas = cachedData.agendas.map((agenda) => normalizeAgendaRecord(agenda, {
                        mailElectionVotes: cachedData.mailElectionVotes
                    }));
                    const defaultMeetingId = getDefaultMeetingId(nextAgendas);

                    setState((prev) => ({
                        ...prev,
                        agendas: nextAgendas,
                        members: cachedData.members,
                        attendance: cachedData.attendance.map(normalizeAttendanceRecord),
                        mailElectionVotes: cachedData.mailElectionVotes,
                        currentMeetingId: defaultMeetingId ?? prev.currentMeetingId,
                        activeMeetingId: defaultMeetingId ?? prev.activeMeetingId,
                        dataConnectionError: 'Supabase 데이터 로딩에 실패하여 마지막 저장 데이터를 표시 중입니다.',
                        lastDataSyncAt: cachedData.savedAt || null
                    }));
                    setIsInitialized(true);
                    return;
                }

                setState((prev) => ({
                    ...prev,
                    dataConnectionError: 'Supabase 데이터 로딩에 실패했습니다. 프로젝트 상태와 API 키를 확인해주세요.'
                }));
                setIsInitialized(true);
            }
        };

        fetchData();
    }, [
        reconcileAgendaVoteCountsFromWrittenVotes,
        refreshSystemSettingsFromDb,
        setIsInitialized,
        setState,
        stateRef
    ]);
};
