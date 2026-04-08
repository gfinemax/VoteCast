'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useStore } from '@/lib/store';
import { getAttendanceQuorumTarget, getKeyboardNavigableAgendaIds, normalizeAgendaType } from '@/lib/store';
import { Monitor, CheckCircle2, Play, Settings } from 'lucide-react';
import AlertModal from '@/components/ui/AlertModal';
import { useProjector } from '@/components/admin/ProjectorContext';

import dynamic from 'next/dynamic';

const PDFViewer = dynamic(() => import('@/components/PDFViewer'), { ssr: false });
const EMPTY_INACTIVE_MEMBER_IDS = [];

const getAgendaPresentation = (agenda, agendas, pageOverride) => {
    if (!agenda) return { finalSource: null, currentPage: 1 };

    const individualSource = agenda.presentation_source;
    let masterSource = null;

    const agendaIndex = agendas.findIndex((item) => item.id === agenda.id);
    if (agendaIndex >= 0) {
        for (let i = agendaIndex; i >= 0; i -= 1) {
            if (agendas[i].type === 'folder') {
                masterSource = agendas[i].presentation_source;
                break;
            }
        }
    }

    return {
        finalSource: individualSource || masterSource,
        currentPage: Math.max(1, parseInt(pageOverride, 10) || agenda.start_page || 1)
    };
};

export default function LiveMonitor({ mode = 'admin' }) {
    const { state, actions } = useStore();
    const { projectorMode, agendas, currentAgendaId, voteData, attendance, members, projectorConnectedCount } = state;
    const inactiveMemberIds = Array.isArray(voteData?.inactiveMemberIds) ? voteData.inactiveMemberIds : EMPTY_INACTIVE_MEMBER_IDS;
    const activeMemberIdSet = useMemo(() => {
        const inactiveMemberIdSet = new Set(inactiveMemberIds);
        return new Set(
            members
                .filter(member => member.is_active !== false && !inactiveMemberIdSet.has(member.id))
                .map(member => member.id)
        );
    }, [inactiveMemberIds, members]);
    const activeMembers = useMemo(() => {
        return members.filter(member => activeMemberIdSet.has(member.id));
    }, [activeMemberIdSet, members]);
    const [showProjectorAlert, setShowProjectorAlert] = useState(false);
    const [showRestrictionAlert, setShowRestrictionAlert] = useState(false);
    const [previewAgendaId, setPreviewAgendaId] = useState(null);
    const [previewPage, setPreviewPage] = useState(null);
    const [isPreviewFocused, setIsPreviewFocused] = useState(false);
    const previewScreenRef = useRef(null);

    // Projector Window Logic (Global)
    const {
        isProjectorOpen,
        projectorWindowCount,
        openProjectorWindow,
        closeProjectorWindows
    } = useProjector();
    const projectorOpenCount = Math.max(projectorConnectedCount || 0, projectorWindowCount || 0);
    const hasProjectorWindow = isProjectorOpen || projectorOpenCount > 0;

    // Help Message Logic
    const handleProjectorAction = React.useCallback((actionFn) => {
        if (!hasProjectorWindow) {
            setShowProjectorAlert(true);
            return;
        }
        actionFn();
    }, [hasProjectorWindow]);

    const handleCommissionCheck = (callback) => {
        // Explicitly check mode string
        if (mode === 'commission') {
            setShowRestrictionAlert(true);
            return;
        }
        handleProjectorAction(callback);
    };

    // Debug Mode
    useEffect(() => {
        console.log('[LiveMonitor] Current Mode:', mode, 'ProjectorMode:', projectorMode);
    }, [mode, projectorMode]);

    const currentAgenda = useMemo(() => agendas.find(a => a.id === currentAgendaId), [agendas, currentAgendaId]);

    // 1. Identify Context (Meeting/Folder) for Stats
    const meetingId = useMemo(() => {
        if (!currentAgenda) return null;
        if (currentAgenda.type === 'folder') return currentAgenda.id;
        const currentIndex = agendas.findIndex(a => a.id === currentAgendaId);
        for (let i = currentIndex - 1; i >= 0; i--) {
            if (agendas[i].type === 'folder') return agendas[i].id;
        }
        return null;
    }, [agendas, currentAgendaId, currentAgenda]);

    // 2. Derive Attendance Data (Scoped to Meeting) - LIVE from table
    const meetingStats = useMemo(() => {
        if (!meetingId) return { direct: 0, proxy: 0, written: 0, total: 0 };
        const relevantRecords = attendance.filter(
            (a) => a.meeting_id === meetingId && activeMemberIdSet.has(a.member_id)
        );
        const direct = relevantRecords.filter(a => a.type === 'direct').length;
        const proxy = relevantRecords.filter(a => a.type === 'proxy').length;
        const written = relevantRecords.filter(a => a.type === 'written').length;
        return {
            direct,
            proxy,
            written,
            total: direct + proxy + written
        };
    }, [activeMemberIdSet, attendance, meetingId]);

    const { currentPage } = useMemo(
        () => getAgendaPresentation(currentAgenda, agendas, voteData?.presentationPage),
        [agendas, currentAgenda, voteData?.presentationPage]
    );

    const navigableAgendaIds = useMemo(() => getKeyboardNavigableAgendaIds(agendas), [agendas]);
    const hasPreparedPreview = previewAgendaId !== null
        && ((previewAgendaId !== currentAgendaId) || ((parseInt(previewPage, 10) || currentPage || 1) !== currentPage));
    const previewSelectionActive = isPreviewFocused || hasPreparedPreview;
    const effectivePreviewAgendaId = previewSelectionActive ? (previewAgendaId ?? currentAgendaId) : currentAgendaId;
    const effectivePreviewPage = previewSelectionActive
        ? Math.max(1, parseInt(previewPage, 10) || currentPage || 1)
        : currentPage;

    useEffect(() => {
        const handlePointerDown = (event) => {
            if (previewScreenRef.current?.contains(event.target)) return;
            setIsPreviewFocused(false);
        };

        document.addEventListener('pointerdown', handlePointerDown);
        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, []);

    const previewAgenda = useMemo(() => {
        return agendas.find((agenda) => agenda.id === effectivePreviewAgendaId) || currentAgenda;
    }, [agendas, currentAgenda, effectivePreviewAgendaId]);

    const previewPresentation = useMemo(
        () => getAgendaPresentation(previewAgenda, agendas, effectivePreviewPage),
        [agendas, effectivePreviewPage, previewAgenda]
    );

    const focusPreviewScreen = React.useCallback(() => {
        if (!hasPreparedPreview) {
            setPreviewAgendaId(currentAgendaId || null);
            setPreviewPage(currentPage || 1);
        }
        setIsPreviewFocused(true);
    }, [currentAgendaId, currentPage, hasPreparedPreview]);

    const resetPreviewToLive = React.useCallback(() => {
        setPreviewAgendaId(null);
        setPreviewPage(null);
        setIsPreviewFocused(false);
    }, []);

    const movePreviewAgenda = React.useCallback((delta) => {
        if (!navigableAgendaIds.length || !delta) return;

        const baseAgendaId = previewAgendaId ?? currentAgendaId;
        const currentIndex = navigableAgendaIds.indexOf(baseAgendaId);
        const normalizedDelta = delta > 0 ? 1 : -1;
        const nextIndex = currentIndex === -1
            ? (normalizedDelta > 0 ? 0 : navigableAgendaIds.length - 1)
            : Math.min(
                navigableAgendaIds.length - 1,
                Math.max(0, currentIndex + normalizedDelta)
            );

        const nextAgendaId = navigableAgendaIds[nextIndex];
        if (!nextAgendaId || nextAgendaId === baseAgendaId) return;

        const nextAgenda = agendas.find((agenda) => agenda.id === nextAgendaId);
        setPreviewAgendaId(nextAgendaId);
        setPreviewPage(nextAgenda?.start_page || 1);
        setIsPreviewFocused(true);
    }, [agendas, currentAgendaId, navigableAgendaIds, previewAgendaId]);

    const movePreviewPage = React.useCallback((delta) => {
        if (!delta) return;

        const basePage = parseInt(previewPage, 10) || currentPage || 1;
        setPreviewPage(Math.max(1, basePage + delta));
        setPreviewAgendaId(previewAgendaId ?? currentAgendaId ?? null);
        setIsPreviewFocused(true);
    }, [currentAgendaId, currentPage, previewAgendaId, previewPage]);

    const applyPreviewToProjector = React.useCallback(async () => {
        const targetAgendaId = previewAgenda?.id ?? currentAgendaId;
        const targetPage = previewPresentation.currentPage;

        if (!targetAgendaId) return;

        if (targetAgendaId !== currentAgendaId) {
            await actions.setAgenda(targetAgendaId);
        }

        await actions.setPresentationPage(targetPage);
        await actions.setProjectorMode('PPT', { agendaTitle: previewAgenda?.title });
        resetPreviewToLive();
    }, [actions, currentAgendaId, previewAgenda, previewPresentation.currentPage, resetPreviewToLive]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;

            const activeElement = document.activeElement;
            if (
                ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement?.tagName) ||
                activeElement?.isContentEditable
            ) {
                return;
            }

            if (isPreviewFocused) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    movePreviewAgenda(1);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    movePreviewAgenda(-1);
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    movePreviewPage(1);
                } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    movePreviewPage(-1);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    resetPreviewToLive();
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (mode === 'commission') {
                        setShowRestrictionAlert(true);
                        return;
                    }
                    handleProjectorAction(applyPreviewToProjector);
                }
                return;
            }

            if (projectorMode !== 'PPT' && projectorMode !== 'IDLE') return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                actions.moveAgendaSelection(1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                actions.moveAgendaSelection(-1);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                actions.updatePresentationPage(1);
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                actions.updatePresentationPage(-1);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        actions,
        applyPreviewToProjector,
        currentAgendaId,
        currentPage,
        handleProjectorAction,
        isPreviewFocused,
        mode,
        previewAgenda,
        previewAgendaId,
        previewPage,
        projectorMode,
        movePreviewAgenda,
        movePreviewPage,
        resetPreviewToLive
    ]);

    // Calculate result stats (Snapshot support)
    const snapshot = currentAgenda?.vote_snapshot;
    const isConfirmed = !!snapshot;

    const totalAttendance = isConfirmed ? snapshot.stats.total : meetingStats.total;
    const votesYes = isConfirmed ? snapshot.votes.yes : (currentAgenda?.votes_yes || 0);
    const votesNo = isConfirmed ? snapshot.votes.no : (currentAgenda?.votes_no || 0);
    const votesAbstain = isConfirmed ? snapshot.votes.abstain : (currentAgenda?.votes_abstain || 0);

    // Pass Logic based on Vote Type
    const currentAgendaType = currentAgenda?.type || 'majority';
    const normalizedType = normalizeAgendaType(currentAgendaType);
    const isSpecialVote = normalizedType === 'twoThirds';

    let isPassed = false;
    if (isConfirmed && snapshot.result) {
        isPassed = snapshot.result === 'PASSED';
    } else {
        const passThreshold = isSpecialVote ? Math.ceil(totalAttendance * (2 / 3)) : (totalAttendance / 2);
        if (isSpecialVote) {
            isPassed = votesYes >= passThreshold;
        } else {
            isPassed = votesYes > passThreshold;
        }
    }

    // [WAITING SCREEN LOGIC]
    const liveTotalMembers = activeMembers.length;
    const quorumCount = getAttendanceQuorumTarget(normalizedType, liveTotalMembers);
    const isTotalQuorumReached = totalAttendance >= quorumCount;
    const isElection = normalizedType === 'election';
    const directTarget = Math.ceil(liveTotalMembers * 0.2);
    const directAttendance = meetingStats.direct;
    const isDirectSatisfied = !isElection || (directAttendance >= directTarget);
    const isReadyToOpen = isTotalQuorumReached && isDirectSatisfied;
    const quorumLabel = isSpecialVote ? '3분의 2' : '과반수';
    const quorumLinePosition = isSpecialVote ? '66.66%' : '50%';
    const isPptOnAir = projectorMode === 'PPT' || projectorMode === 'IDLE';
    const centerScreenBorder = isPreviewFocused
        ? 'border-amber-400'
        : hasPreparedPreview
            ? 'border-amber-500'
            : isPptOnAir
                ? 'border-emerald-500'
                : 'border-slate-800';
    const projectorStatusLabel = {
        RESULT: `투표 결과 송출 중${currentAgenda?.title ? ` · ${currentAgenda.title}` : ''}`,
        WAITING: '성원 현황 송출 중',
        ADJUSTING: '결과 정정 안내 송출 중',
        PPT: `안건 설명 송출 중${currentAgenda?.title ? ` · ${currentAgenda.title}` : ''}`,
        IDLE: `자료 대기 화면${currentAgenda?.title ? ` · ${currentAgenda.title}` : ''}`
    }[projectorMode] || '송출 대기';

    return (
        <div className="bg-slate-900 rounded-xl overflow-hidden shadow-2xl border-4 border-slate-800">
            {/* Header Status Bar */}
            <div className="bg-slate-950 px-4 py-2 flex justify-between items-center border-b border-slate-800">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                    <Monitor size={16} className="text-emerald-500" />
                    <span className="tracking-widest text-emerald-500">TRIPLE LIVE MONITOR</span>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={openProjectorWindow}
                        className={`flex items-center gap-2 px-3 py-1 rounded font-semibold text-xs transition-all border ${hasProjectorWindow
                            ? 'bg-emerald-900/50 text-emerald-400 border-emerald-500/50 hover:bg-emerald-800/60 hover:text-emerald-300'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white'
                            }`}
                    >
                        <Monitor size={12} />
                        <span>{hasProjectorWindow ? `송출창 추가 열기 (${projectorOpenCount})` : '송출창 열기'}</span>
                        {hasProjectorWindow && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>}
                    </button>
                    {hasProjectorWindow && (
                        <button
                            onClick={closeProjectorWindows}
                            className="flex items-center gap-2 px-3 py-1 rounded font-semibold text-xs transition-all border bg-red-950/50 text-red-300 border-red-500/40 hover:bg-red-900/60 hover:text-red-200 hover:border-red-400/60"
                        >
                            <Monitor size={12} />
                            <span>송출창 전체 닫기</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Triple Screen Preview Area */}
            <div className="grid grid-cols-3 gap-3 bg-slate-950 p-3">

                {/* 1. RESULT SCREEN (Left) */}
                <div className="flex flex-col gap-2">
                    <div className={`relative aspect-video bg-white rounded overflow-hidden group border-2 transition-colors ${projectorMode === 'RESULT' ? 'border-emerald-500' : 'border-slate-800'}`}>
                        <div className="w-full h-full flex flex-col items-center bg-slate-50 relative overflow-hidden">
                            <div className="absolute inset-1 border border-slate-200 rounded pointer-events-none"></div>
                            <div className="w-full h-full flex flex-col items-center justify-between p-2 z-10">
                                {/* Header */}
                                <div className="flex flex-col items-center w-full mt-1">
                                    <div className="bg-slate-900 text-white px-3 py-0.5 rounded-full text-[6px] font-bold shadow-sm mb-1 tracking-wide">
                                        {projectorMode === 'ADJUSTING' ? '잠시 대기' : '투표 결과 보고'}
                                    </div>
                                    <h1 className="text-[11px] font-black text-slate-900 leading-tight text-center line-clamp-2 w-full px-1 break-keep">
                                        {projectorMode === 'ADJUSTING' ? '결과 데이터 정정 중...' : currentAgenda?.title}
                                    </h1>
                                </div>

                                {/* Declaration Box */}
                                <div className="w-full flex-grow flex items-center justify-center px-1 py-1">
                                    <div className="w-full h-full bg-white border border-slate-800 p-1 rounded shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-full h-[2px] bg-slate-100"></div>
                                        {currentAgenda?.declaration ? (
                                            <div className="text-[5px] font-sans leading-relaxed text-slate-800 font-medium break-keep whitespace-pre-wrap">
                                                {currentAgenda.declaration.split(/(가결|부결)/g).map((part, i) => {
                                                    if (part === '가결') return <span key={i} className="inline-block bg-emerald-600 text-white px-1 py-0.5 rounded mx-0.5 font-bold align-middle text-[6px]">가결</span>;
                                                    if (part === '부결') return <span key={i} className="inline-block bg-red-600 text-white px-1 py-0.5 rounded mx-0.5 font-bold align-middle text-[6px]">부결</span>;
                                                    return part;
                                                })}
                                            </div>
                                        ) : (
                                            <div className="text-[5px] font-serif leading-relaxed text-slate-800">
                                                &quot;<span className="font-bold underline decoration-slate-300 underline-offset-2 decoration-2">{currentAgenda?.title}</span>&quot;...
                                                <div className={`mt-1 px-2 py-0.5 rounded text-white font-bold inline-block text-[6px] ${isPassed ? 'bg-emerald-600' : 'bg-red-600'}`}>
                                                    {isPassed ? '가 결' : '부 결'}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Stats Grid */}
                                <div className="grid grid-cols-4 gap-1 w-full mb-0.5">
                                    <div className="flex flex-col items-center bg-slate-50 rounded p-0.5 border border-slate-100">
                                        <div className="text-[6px] font-bold text-slate-500">총</div>
                                        <div className="text-[8px] font-black font-mono text-slate-800 tracking-tight">{totalAttendance}</div>
                                    </div>
                                    <div className="flex flex-col items-center bg-blue-50 rounded p-0.5 border border-blue-100">
                                        <div className="text-[6px] font-bold text-blue-600">찬</div>
                                        <div className="text-[8px] font-black font-mono text-blue-700 tracking-tight">{votesYes}</div>
                                    </div>
                                    <div className="flex flex-col items-center bg-red-50 rounded p-0.5 border border-red-50">
                                        <div className="text-[6px] font-bold text-red-700">반</div>
                                        <div className="text-[8px] font-black font-mono text-red-800 tracking-tight">{votesNo}</div>
                                    </div>
                                    <div className="flex flex-col items-center bg-slate-100 rounded p-0.5 border border-slate-200">
                                        <div className="text-[6px] font-bold text-slate-600">무</div>
                                        <div className="text-[8px] font-black font-mono text-slate-700 tracking-tight">{votesAbstain}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Maintenance/Adjusting Overlay */}
                        {projectorMode === 'ADJUSTING' && (
                            <div className="absolute inset-0 bg-slate-950 z-20 flex flex-col items-center justify-center text-white">
                                <Settings size={24} className="animate-spin text-slate-400 mb-2" />
                                <div className="text-[8px] font-bold text-slate-300">결과 데이터 정정 중입니다...</div>
                                <div className="text-[6px] text-slate-500 mt-0.5">화면 송출이 일시 중단되었습니다.</div>
                            </div>
                        )}

                        <div className="absolute top-1 left-1 px-1 py-0.5 bg-black/60 text-[8px] text-slate-300 font-mono rounded z-10">SCREEN 1</div>
                        {projectorMode === 'RESULT' && <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-emerald-600/90 text-white text-[8px] font-bold rounded z-10">ON AIR</div>}
                        {projectorMode === 'ADJUSTING' && <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-amber-600/90 text-white text-[8px] font-bold rounded z-10">WAIT</div>}
                    </div>
                    {/* Button */}
                    <button
                        onClick={() => handleProjectorAction(() => {
                            // Toggle Logic Check
                            console.log('[VoteResult] Clicked. Current:', projectorMode);
                            if (projectorMode === 'RESULT') {
                                actions.setProjectorMode('ADJUSTING', { agendaTitle: currentAgenda?.title });
                            } else {
                                // If IDLE, PPT, WAITING, or ADJUSTING -> Go to RESULT
                                actions.setProjectorMode('RESULT', { agendaTitle: currentAgenda?.title });
                            }
                        })}
                        className={`w-full py-2 px-3 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition-all ${projectorMode === 'RESULT'
                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                            : projectorMode === 'ADJUSTING'
                                ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/30' // Adjusting State
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                            }`}
                    >
                        {projectorMode === 'ADJUSTING' ? <Settings size={14} className="animate-spin" /> : <Play size={14} />}
                        <span>{projectorMode === 'ADJUSTING' ? '화면 켜기 (대기중)' : '투표 결과'}</span>
                        {projectorMode === 'RESULT' && <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>}
                    </button>
                </div>

                {/* 2. PPT SCREEN (Center) */}
                <div className="flex flex-col gap-2">
                    <div
                        ref={previewScreenRef}
                        onClick={focusPreviewScreen}
                        className={`relative aspect-video bg-black rounded overflow-hidden group border-2 transition-colors cursor-pointer ${centerScreenBorder}`}
                    >
                        {previewPresentation.finalSource ? (
                            <div className="w-full h-full bg-white relative overflow-hidden">
                                <PDFViewer
                                    url={previewPresentation.finalSource}
                                    pageNumber={previewPresentation.currentPage}
                                />
                                <div className="absolute inset-0 bg-transparent z-20" />
                            </div>
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-center p-2 bg-slate-900 text-white">
                                <div className="text-[8px] text-slate-500 mb-1 tracking-widest uppercase">PPT VIEW</div>
                                <h1 className="text-[10px] font-bold line-clamp-2 px-2 leading-tight text-slate-100">{previewAgenda?.title || '정기 총회'}</h1>
                                <div className="text-[6px] text-slate-600 mt-1">No PPT URL Linked</div>
                            </div>
                        )}
                        <div className="absolute top-1 left-1 px-1 py-0.5 bg-black/60 text-[8px] text-slate-300 font-mono rounded z-10">SCREEN 2</div>
                        {hasPreparedPreview || isPreviewFocused ? (
                            <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-amber-500/90 text-slate-950 text-[8px] font-bold rounded z-10">
                                PREVIEW
                            </div>
                        ) : isPptOnAir ? (
                            <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-emerald-600/90 text-white text-[8px] font-bold rounded z-10">
                                ON AIR
                            </div>
                        ) : null}
                        <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 via-black/25 to-transparent px-2 py-2">
                            <div className="flex items-center justify-between gap-2 text-[8px] font-semibold">
                                <span className={hasPreparedPreview || isPreviewFocused ? 'text-amber-300' : 'text-slate-300'}>
                                    {hasPreparedPreview
                                        ? `준비 화면 · ${previewAgenda?.title || '안건'} · ${previewPresentation.currentPage}p`
                                        : isPreviewFocused
                                            ? `탐색 준비 · ${previewAgenda?.title || '안건'} · ${previewPresentation.currentPage}p`
                                            : `현재 자료 · ${currentAgenda?.title || '안건'} · ${currentPage}p`}
                                </span>
                                <span className={isPreviewFocused ? 'text-amber-200' : 'text-slate-400'}>
                                    {isPreviewFocused ? 'CONTROL READY' : 'CLICK TO CONTROL'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-[10px] text-slate-400">
                        <div className="flex items-center justify-between gap-3">
                            <span className="truncate">실제 송출: {projectorStatusLabel}</span>
                            <span className={`font-semibold ${hasPreparedPreview ? 'text-amber-300' : isPreviewFocused ? 'text-amber-200' : 'text-slate-500'}`}>
                                {hasPreparedPreview ? 'PREVIEW READY' : isPreviewFocused ? 'PREVIEW ACTIVE' : 'LIVE SYNC'}
                            </span>
                        </div>
                        <div className="mt-1 text-slate-500">
                            클릭 후 `↑↓` 안건, `←→` 페이지, `Enter` 송출, `Esc` 동기화
                        </div>
                    </div>
                    {/* Button */}
                    <button
                        onClick={() => handleCommissionCheck(() =>
                            hasPreparedPreview ? applyPreviewToProjector() : actions.setProjectorMode('PPT', { agendaTitle: currentAgenda?.title })
                        )}
                        className={`w-full py-2 px-3 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition-all ${mode === 'commission'
                            ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed border border-slate-800' // Restricted Style
                            : (hasPreparedPreview
                                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400'
                                : (projectorMode === 'PPT' || projectorMode === 'IDLE'
                                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'))
                            }`}
                    >
                        <Monitor size={14} />
                        <span>{hasPreparedPreview ? '준비 화면 송출' : '안건 설명'}</span>
                        {mode !== 'commission' && hasPreparedPreview && <span className="w-2 h-2 bg-slate-950 rounded-full animate-pulse"></span>}
                        {mode !== 'commission' && !hasPreparedPreview && (projectorMode === 'PPT' || projectorMode === 'IDLE') && <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>}
                    </button>
                    {hasPreparedPreview && (
                        <button
                            onClick={resetPreviewToLive}
                            className="w-full py-2 px-3 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition-all bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                        >
                            <Settings size={14} />
                            <span>현재 송출과 동기화</span>
                        </button>
                    )}
                </div>


                {/* 3. WAITING SCREEN (Right) */}
                <div className="flex flex-col gap-2">
                    <div className={`relative aspect-video bg-slate-900 rounded overflow-hidden group border-2 transition-colors ${projectorMode === 'WAITING' ? 'border-emerald-500' : 'border-slate-800'}`}>
                        <div className="absolute inset-0 overflow-hidden opacity-20">
                            <div className="absolute -top-[20%] -right-[10%] w-20 h-20 bg-blue-600 rounded-full blur-xl"></div>
                            <div className="absolute -bottom-[20%] -left-[10%] w-20 h-20 bg-emerald-600 rounded-full blur-xl"></div>
                        </div>

                        <div className="relative z-10 w-full h-full flex flex-col items-center justify-between px-4 py-1.5">
                            <div className="flex flex-col items-center gap-0.5 mt-0.5">
                                <div className="flex items-center gap-1 opacity-50">
                                    <div className="text-[3px] text-slate-300 tracking-wider">2026 GENERAL MEETING</div>
                                </div>
                                <div className="text-[8px] font-bold text-white leading-none">정기 총회 성원 현황</div>
                            </div>

                            <div className="flex flex-col items-center flex-grow justify-center">
                                <div className="text-[5px] font-medium text-slate-400 mb-0.5">현재 집계 인원</div>
                                <div className="relative flex items-baseline justify-center mb-0.5">
                                    <span className="text-[28px] font-black leading-none tracking-tighter text-white tabular-nums drop-shadow-sm">
                                        {totalAttendance}
                                    </span>
                                    <span className="absolute left-full bottom-1 ml-0.5 text-[6px] text-slate-500 font-light whitespace-nowrap">명</span>
                                </div>
                                <div className="flex items-center text-[4px] text-slate-400 font-medium font-mono gap-1">
                                    <span className="text-emerald-400">참석 {meetingStats.direct}</span>
                                    <span className="text-slate-700">|</span>
                                    <span className="text-blue-400">대리 {meetingStats.proxy}</span>
                                    <span className="text-slate-700">|</span>
                                    <span className="text-orange-400">서면 {meetingStats.written}</span>
                                </div>
                            </div>

                            <div className="w-full bg-slate-800/50 rounded p-1 px-3 border border-white/5 flex flex-col gap-0.5 mb-0.5">
                                <div className="flex justify-between items-end text-[4px] text-slate-400 mb-[1px]">
                                    <span><span className="font-bold text-white">전체 성원</span> ({quorumLabel})</span>
                                    <div><span className="font-bold text-white">{totalAttendance}</span><span className="mx-0.5">/</span>{quorumCount}명</div>
                                </div>
                                <div className="w-full h-[2px] bg-slate-700 rounded-full overflow-hidden relative shadow-inner">
                                    <div className="absolute top-0 bottom-0 w-[0.5px] bg-white/30 z-20 border-r border-black/20" style={{ left: quorumLinePosition }}></div>
                                    <div className={`h-full transition-all duration-1000 ease-out ${isTotalQuorumReached ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-gradient-to-r from-blue-900 to-blue-500'}`} style={{ width: `${Math.min(100, (totalAttendance / (liveTotalMembers || 1)) * 100)}%` }}></div>
                                </div>

                                {isElection && (
                                    <>
                                        <div className="flex justify-between items-end text-[4px] text-emerald-100/80 mt-[1px]">
                                            <span><span className="font-bold text-emerald-400">직접 참석</span> (20%)</span>
                                            <div><span className={isDirectSatisfied ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{directAttendance}</span><span className="text-slate-500 mx-0.5">/</span>{directTarget}명</div>
                                        </div>
                                        <div className="w-full h-[2px] bg-slate-700 rounded-full overflow-hidden relative shadow-inner">
                                            <div className="absolute top-0 bottom-0 left-[20%] w-[0.5px] bg-emerald-500/50 z-20 border-r border-black/10"></div>
                                            <div className={`h-full transition-all duration-1000 ease-out ${isDirectSatisfied ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-gradient-to-r from-red-900 to-red-600'}`} style={{ width: `${Math.min(100, (directAttendance / (liveTotalMembers || 1)) * 100)}%` }}></div>
                                        </div>
                                    </>
                                )}

                                <div className="text-center mt-0.5">
                                    {isReadyToOpen ? (
                                        <div className="inline-flex items-center gap-1 bg-emerald-950/90 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/50 text-[5px] font-bold shadow-[0_0_10px_rgba(16,185,129,0.3)] backdrop-blur-md whitespace-nowrap">
                                            <CheckCircle2 size={5} className="animate-bounce" />
                                            <span>성원이 충족되었습니다. 잠시 후 개회하겠습니다.</span>
                                        </div>
                                    ) : (
                                        <div className="inline-flex flex-col gap-0.5 items-center">
                                            <div className="inline-flex items-center justify-center gap-1 bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded-full border border-white/10 shadow-lg backdrop-blur-sm text-[5px] whitespace-nowrap">
                                                <div className="w-1 h-1 bg-red-500 rounded-full animate-pulse"></div>
                                                <span className="font-medium">조합원님의 입장을 기다리고 있습니다...</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="absolute top-1 left-1 px-1 py-0.5 bg-black/60 text-[8px] text-slate-300 font-mono rounded z-10">SCREEN 3</div>
                        {projectorMode === 'WAITING' && <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-emerald-600/90 text-white text-[8px] font-bold rounded z-10">ON AIR</div>}
                    </div>
                    {/* Button */}
                    <button
                        onClick={() => handleCommissionCheck(() =>
                            actions.setProjectorMode('WAITING', {})
                        )}
                        className={`w-full py-2 px-3 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition-all ${mode === 'commission'
                            ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed border border-slate-800' // Restricted Style
                            : (projectorMode === 'WAITING'
                                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white')
                            }`}
                    >
                        <Settings size={14} />
                        <span>성원현황</span>
                        {mode !== 'commission' && projectorMode === 'WAITING' && <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>}
                    </button>
                </div>
            </div>

            {/* Alert Modal */}
            < AlertModal
                isOpen={showProjectorAlert}
                onClose={() => setShowProjectorAlert(false)
                }
                title="송출창 연결 확인"
                message={`송출창(프로젝터 화면)이 연결되지 않았습니다.\n\n우측 상단의 '송출창' 버튼을 눌러\n프로젝터 화면을 먼저 띄워주세요.`}
            />

            {/* Restricted Alert Modal */}
            <AlertModal
                isOpen={showRestrictionAlert}
                onClose={() => setShowRestrictionAlert(false)}
                title="🚫 권한 제한 알림"
                message={`선거관리위원회(심사) 계정은 '투표 결과' 송출만 가능합니다.\n\n성원 현황 및 안건 설명은 총회 관리자(Admin) 권한입니다.`}
            />
        </div>
    );
}
