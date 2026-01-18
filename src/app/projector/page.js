'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useStore } from '@/lib/store';
import { CheckCircle2, Settings } from 'lucide-react';
import dynamic from 'next/dynamic';

const PDFViewer = dynamic(() => import('@/components/PDFViewer'), { ssr: false });

export default function ProjectorPage() {
    const { state } = useStore();
    const { projectorMode, agendas, currentAgendaId, voteData, attendance, members } = state;
    const [scale, setScale] = useState(1);

    // Find info about current agenda
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

    // 2. Derive Attendance Data
    const meetingStats = useMemo(() => {
        if (!meetingId) return { direct: 0, proxy: 0, written: 0, total: 0 };
        const relevantRecords = attendance.filter(a => a.meeting_id === meetingId);
        const direct = relevantRecords.filter(a => a.type === 'direct').length;
        const proxy = relevantRecords.filter(a => a.type === 'proxy').length;
        const written = relevantRecords.filter(a => a.type === 'written').length;
        return {
            direct,
            proxy,
            written,
            total: direct + proxy + written
        };
    }, [attendance, meetingId]);

    // Stats for WAITING layer
    const waitingStats = useMemo(() => {
        const liveTotalMembers = members.length;
        const liveTotalAttendance = meetingStats.total;
        const quorumCount = Math.ceil(liveTotalMembers / 2);
        const isTotalQuorumReached = liveTotalAttendance >= quorumCount;

        const normalizeType = (type) => {
            if (type === 'general') return 'majority';
            if (type === 'special') return 'twoThirds';
            return type || 'majority';
        };
        const currentAgendaType = normalizeType(currentAgenda?.type);
        const isElection = currentAgendaType === 'election';
        const directTarget = Math.ceil(liveTotalMembers * 0.2);
        const isDirectSatisfied = !isElection || (meetingStats.direct >= directTarget);
        const directPercent = liveTotalMembers > 0 ? (meetingStats.direct / liveTotalMembers) * 100 : 0;
        const isReadyToOpen = isTotalQuorumReached && isDirectSatisfied;

        return {
            liveTotalMembers,
            liveTotalAttendance,
            quorumCount,
            isTotalQuorumReached,
            isElection,
            directTarget,
            isDirectSatisfied,
            directPercent,
            isReadyToOpen
        };
    }, [members.length, meetingStats, currentAgenda]);

    // Stats for RESULT layer
    const resultStats = useMemo(() => {
        // CHECK SNAPSHOT
        const snapshot = currentAgenda?.vote_snapshot;
        const isConfirmed = !!snapshot;

        const totalAttendance = isConfirmed ? snapshot.stats.total : meetingStats.total;
        const votesYes = isConfirmed ? snapshot.votes.yes : (currentAgenda?.votes_yes || 0);
        const votesNo = isConfirmed ? snapshot.votes.no : (currentAgenda?.votes_no || 0);
        const votesAbstain = isConfirmed ? snapshot.votes.abstain : (currentAgenda?.votes_abstain || 0);
        const customDeclaration = isConfirmed ? snapshot.declaration : (currentAgenda?.declaration || '');

        const normalizeType = (type) => {
            if (type === 'general') return 'majority';
            if (type === 'special') return 'twoThirds';
            return type || 'majority';
        };
        const currentAgendaType = normalizeType(currentAgenda?.type);
        const isSpecialVote = currentAgendaType === 'twoThirds';

        const agendaTitle = currentAgenda?.title || '안건';

        // Result Logic
        let isPassed = false;
        if (isConfirmed && snapshot.result) {
            isPassed = snapshot.result === 'PASSED';
        } else {
            // Realtime Limit
            const passThreshold = isSpecialVote ? Math.ceil(totalAttendance * (2 / 3)) : (totalAttendance / 2);
            // Fix logic to match Admin: Special is >=, Majority is >
            if (isSpecialVote) {
                isPassed = votesYes >= passThreshold;
            } else {
                isPassed = votesYes > passThreshold;
            }
        }

        return {
            totalAttendance,
            votesYes,
            votesNo,
            votesAbstain,
            isPassed,
            agendaTitle,
            customDeclaration,
            isSpecialVote
        };
    }, [currentAgenda, meetingStats]);


    // Auto-Scaling Logic (1920x1080 Base)
    useEffect(() => {
        const handleResize = () => {
            const scaleX = window.innerWidth / 1920;
            const scaleY = window.innerHeight / 1080;
            setScale(Math.min(scaleX, scaleY) * 0.98);
        };
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const containerStyle = {
        width: '1920px',
        height: '1080px',
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
    };

    // 2. Prepare Source (PDF only mostly)
    const { finalSource, currentPage } = useMemo(() => {
        if (!currentAgenda) return { finalSource: null, currentPage: 1 };

        const individualSource = currentAgenda.presentation_source;
        let masterSource = null;

        if (agendas && currentAgenda) {
            const idx = agendas.findIndex(a => a.id === currentAgenda.id);
            if (idx >= 0) {
                // Look backwards for parent folder
                for (let i = idx; i >= 0; i--) {
                    if (agendas[i].type === 'folder') {
                        masterSource = agendas[i].presentation_source;
                        break;
                    }
                }
            }
        }

        const startPage = voteData?.presentationPage || currentAgenda.start_page || 1;
        let source = individualSource || masterSource;

        // Clean source URL (remove existing query params or hash if any, though usually clean)
        // Adjust this if your DB stores params. Assuming clean URL or Supabase URL.

        return { finalSource: source, currentPage: parseInt(startPage) };
    }, [currentAgenda, voteData?.presentationPage, agendas]);

    return (

        <div className="flex items-center justify-center w-screen h-screen bg-black overflow-hidden font-sans text-slate-900">
            <div style={containerStyle} className="bg-white relative flex flex-col overflow-hidden shrink-0">

                {/* 1. LAYER: IDLE or PPT (Z-index 10) */}
                <div className={`absolute inset-0 transition-opacity duration-300 ${(projectorMode === 'IDLE' || projectorMode === 'PPT') ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                    <div className="w-full h-full flex flex-col bg-white text-white items-center justify-center relative">
                        {finalSource ? (
                            <div className="w-full h-full overflow-hidden relative bg-white">
                                <PDFViewer
                                    url={finalSource}
                                    pageNumber={currentPage}
                                />
                            </div>


                        ) : (
                            <div className="flex flex-col items-center justify-center p-20 text-center bg-slate-900">
                                <div className="mb-10 p-6 bg-slate-800 rounded-full">
                                    <Settings size={80} className="animate-spin-slow opacity-50" />
                                </div>
                                <h1 className="text-7xl font-black mb-10 tracking-tight leading-tight max-w-6xl break-keep">{currentAgenda?.title || '정기 총회'}</h1>
                                <p className="text-3xl text-slate-400 font-light">
                                    {projectorMode === 'PPT' ? '안건 설명 자료가 없습니다.' : '잠시만 기다려 주십시오.'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>


                {/* 2. LAYER: WAITING (Z-index 20) */}
                {/* REMOVED scale-105 to ensure visual stability */}
                <div className={`absolute inset-0 transition-opacity duration-300 ${projectorMode === 'WAITING' ? 'opacity-100 z-20' : 'opacity-0 z-0 pointer-events-none'}`}>
                    <div className="w-full h-full flex flex-col bg-slate-900 text-white relative items-center justify-center p-20">
                        <div className="absolute inset-0 overflow-hidden opacity-10 font-sans">
                            <div className="absolute -top-[20%] -right-[10%] w-[1000px] h-[1000px] bg-blue-600 rounded-full blur-[150px]"></div>
                            <div className="absolute -bottom-[20%] -left-[10%] w-[800px] h-[800px] bg-emerald-600 rounded-full blur-[150px]"></div>
                        </div>
                        <div className="relative z-10 flex flex-col items-center w-full max-w-5xl">
                            <div className="flex items-center gap-4 mb-10 text-slate-400">
                                <span className="uppercase tracking-[0.3em] font-bold">2026 Regular General Meeting</span>
                                <div className="w-20 h-px bg-slate-600"></div>
                                <span className="font-serif italic font-sans">Live Status</span>
                            </div>
                            <h1 className="text-6xl font-black mb-16 tracking-tight text-center">정기 총회 성원 현황</h1>
                            <div className="flex flex-col items-center mb-16 scale-125">
                                <div className="text-2xl font-medium text-slate-400 mb-4">현재 집계 인원</div>
                                <div className="relative flex items-baseline justify-center mb-2">
                                    <span className="text-[12rem] font-black leading-none tracking-tighter text-white tabular-nums drop-shadow-2xl">
                                        {waitingStats.liveTotalAttendance.toLocaleString()}
                                    </span>
                                    <span className="absolute left-full bottom-8 ml-4 text-4xl text-slate-500 font-light whitespace-nowrap">명</span>
                                </div>
                                <div className="flex items-center text-lg text-slate-400 font-medium font-mono">
                                    <span className="text-emerald-400">참석 {meetingStats.direct}</span>
                                    <span className="mx-4 text-slate-700">|</span>
                                    <span className="text-blue-400">대리 {meetingStats.proxy}</span>
                                    <span className="mx-4 text-slate-700">|</span>
                                    <span className="text-orange-400">서면 {meetingStats.written}</span>
                                </div>
                            </div>
                            <div className="w-full bg-slate-800/50 rounded-3xl p-10 backdrop-blur-sm border border-white/10 shadow-2xl space-y-8">
                                <div>
                                    <div className="flex justify-between items-end mb-4">
                                        <div className="text-xl text-slate-400"><span className="font-bold text-white">전체 성원</span> (과반수 기준)</div>
                                        <div className="text-right">
                                            <span className="text-2xl font-bold text-white tabular-nums">{waitingStats.liveTotalAttendance}</span>
                                            <span className="text-slate-500 mx-2">/</span>
                                            <span className="text-xl text-slate-400">{waitingStats.quorumCount}명</span>
                                        </div>
                                    </div>
                                    <div className="w-full h-8 bg-slate-700 rounded-full overflow-hidden relative shadow-inner">
                                        <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/30 z-20 border-r border-black/20"></div>
                                        <div className={`h-full transition-all duration-1000 ease-out ${waitingStats.isTotalQuorumReached ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-gradient-to-r from-blue-900 to-blue-500'}`} style={{ width: `${Math.min(100, (waitingStats.liveTotalAttendance / (waitingStats.liveTotalMembers || 1)) * 100)}%` }}></div>
                                    </div>
                                </div>
                                {waitingStats.isElection && (
                                    <div className="pt-6 border-t border-white/5">
                                        <div className="flex justify-between items-end mb-4">
                                            <div className="text-xl text-emerald-100/80"><span className="font-bold text-emerald-400">직접 참석</span> (조합원 20% 필수)</div>
                                            <div className="text-right flex items-baseline gap-2">
                                                <span className={`text-2xl font-bold tabular-nums ${waitingStats.isDirectSatisfied ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {waitingStats.directPercent.toFixed(1)}%
                                                </span>
                                                <span className="text-slate-500">/</span>
                                                <span className="text-xl text-slate-400">20% ({waitingStats.directTarget}명)</span>
                                            </div>
                                        </div>
                                        <div className="w-full h-6 bg-slate-700/50 rounded-full overflow-hidden relative shadow-inner">
                                            <div className="absolute top-0 bottom-0 left-[20%] w-0.5 bg-emerald-500/50 z-20 border-r border-black/10"></div>
                                            <div className={`h-full transition-all duration-1000 ease-out ${waitingStats.isDirectSatisfied ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-gradient-to-r from-red-900 to-red-600'}`} style={{ width: `${Math.min(100, (meetingStats.direct / (waitingStats.liveTotalMembers || 1)) * 100)}%` }}></div>
                                        </div>
                                    </div>
                                )}
                                <div className="text-center pt-2">
                                    {waitingStats.isReadyToOpen && waitingStats.liveTotalMembers > 0 ? (
                                        <div className="inline-flex items-center gap-3 bg-emerald-950/90 text-emerald-400 px-10 py-4 rounded-full border border-emerald-500/50 shadow-[0_0_50px_rgba(16,185,129,0.3)] backdrop-blur-md">
                                            <CheckCircle2 size={32} className="animate-bounce" />
                                            <span className="text-4xl font-bold tracking-tight">성원이 충족되었습니다. 잠시 후 개회하겠습니다.</span>
                                        </div>
                                    ) : (
                                        <div className="inline-flex flex-col gap-4 items-center">
                                            <div className="inline-flex items-center justify-center gap-3 bg-slate-800/80 text-slate-300 px-8 py-3 rounded-full border border-white/10 shadow-lg backdrop-blur-sm">
                                                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                                                <span className="text-2xl font-medium">조합원님의 입장을 기다리고 있습니다...</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. LAYER: RESULT (Z-index 30) */}
                {/* REMOVED scale-110 to ensure visual stability */}
                <div className={`absolute inset-0 transition-opacity duration-300 ${projectorMode === 'RESULT' ? 'opacity-100 z-30' : 'opacity-0 z-0 pointer-events-none'}`}>
                    <div className="w-full h-full flex flex-col bg-slate-50 text-slate-900 relative">
                        <div className="absolute inset-8 border-4 border-slate-700 pointer-events-none z-10 rounded-xl opacity-10"></div>
                        <div className="flex-1 flex flex-col items-center py-16 px-24 z-20 h-full justify-between pb-24">
                            <div className="flex flex-col items-center justify-center w-full mt-4">
                                <div className="bg-slate-900 text-white px-12 py-3 rounded-full text-3xl font-bold shadow-md mb-6 tracking-wide">투표 결과 보고</div>
                                <h1 className="text-7xl font-black text-slate-900 leading-tight text-center break-keep drop-shadow-sm">{resultStats.agendaTitle}</h1>
                            </div>
                            <div className="w-full h-px bg-slate-200 opacity-50"></div>
                            <div className="w-full max-w-7xl flex-grow flex items-center justify-center py-4">
                                <div className="w-full bg-white border-2 border-slate-800 p-12 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] flex flex-col items-center justify-center gap-8 text-center relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-2 bg-slate-100"></div>
                                    {resultStats.customDeclaration ? (
                                        <div className="text-5xl font-serif leading-relaxed text-slate-800 font-medium break-keep whitespace-pre-wrap">
                                            {resultStats.customDeclaration.split(/(가결|부결)/g).map((part, i) => {
                                                if (part === '가결') return <span key={i} className="inline-block mx-2 px-10 py-2 bg-emerald-600 text-white rounded-lg font-sans font-bold tracking-widest border border-emerald-700 shadow-sm align-middle text-6xl uppercase">가결</span>;
                                                if (part === '부결') return <span key={i} className="inline-block mx-2 px-10 py-2 bg-red-600 text-white rounded-lg font-sans font-bold tracking-widest border border-red-700 shadow-sm align-middle text-6xl uppercase">부결</span>;
                                                return part;
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-5xl font-serif leading-relaxed text-slate-800 font-medium break-keep">
                                            &quot;<span className="font-bold underline decoration-slate-300 underline-offset-8 decoration-4">{resultStats.agendaTitle}</span>&quot;은<br />
                                            전체 참석자 <span className="text-slate-900 font-bold">{resultStats.totalAttendance.toLocaleString()}</span>명 중 {resultStats.isSpecialVote ? '3분의 2' : '과반수'} 찬성으로
                                        </p>
                                    )}
                                    {(!resultStats.customDeclaration || !resultStats.customDeclaration.includes('선포')) && (
                                        <div className="flex items-center gap-6 mt-2">
                                            <div className={`px-10 py-3 rounded-lg shadow-md ${resultStats.isPassed ? 'bg-emerald-600' : 'bg-red-600'}`}><span className="text-5xl font-black text-white tracking-widest">{resultStats.isPassed ? '가 결' : '부 결'}</span></div>
                                            <span className="text-5xl font-serif font-bold text-slate-800">되었음을 선포합니다.</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="w-full max-w-7xl grid grid-cols-4 gap-6 h-48">
                                <div className="flex flex-col items-center justify-center bg-slate-50 rounded-2xl p-4 border border-slate-100 shadow-sm">
                                    <div className="text-lg font-bold text-slate-500 mb-2">총 참석</div>
                                    <div className="text-6xl font-black font-mono tracking-tight text-slate-800 mb-1">{resultStats.totalAttendance.toLocaleString()}</div>
                                    <div className="text-lg text-slate-400">명</div>
                                </div>
                                <div className="flex flex-col items-center justify-center bg-blue-50 rounded-2xl p-4 border border-blue-100 shadow-md transform scale-105 z-10">
                                    <div className="flex items-center gap-2 mb-2"><div className="text-lg font-bold text-blue-600">찬성</div><CheckCircle2 size={24} className="text-blue-500" /></div>
                                    <div className="text-6xl font-black font-mono tracking-tight text-blue-700 mb-1">{resultStats.votesYes.toLocaleString()}</div>
                                    <div className="text-lg text-blue-500">표</div>
                                </div>
                                <div className="flex flex-col items-center justify-center bg-red-50 rounded-2xl p-4 border border-red-50 shadow-sm">
                                    <div className="text-lg font-bold text-red-700 mb-2">반대</div>
                                    <div className="text-6xl font-black font-mono tracking-tight text-red-800 mb-1">{resultStats.votesNo.toLocaleString()}</div>
                                    <div className="text-lg text-red-500/50">표</div>
                                </div>
                                <div className="flex flex-col items-center justify-center bg-slate-100 rounded-2xl p-4 border border-slate-200 shadow-sm">
                                    <div className="text-lg font-bold text-slate-600 mb-2">기권/무효</div>
                                    <div className="text-6xl font-black font-mono tracking-tight text-slate-700 mb-1">{resultStats.votesAbstain.toLocaleString()}</div>
                                    <div className="text-lg text-slate-400">표</div>
                                </div>
                            </div>
                        </div>
                        <div className="absolute bottom-8 w-full text-center">
                            <p className="text-slate-400 font-serif text-lg tracking-wider">2026년도 정기 총회 | 집계 완료</p>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
