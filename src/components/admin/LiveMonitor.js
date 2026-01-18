'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useStore } from '@/lib/store';
import { Monitor, CheckCircle2 } from 'lucide-react';

import dynamic from 'next/dynamic';

const PDFViewer = dynamic(() => import('@/components/PDFViewer'), { ssr: false });

export default function LiveMonitor() {
    const { state } = useStore();
    const { projectorMode, projectorData, agendas, currentAgendaId, voteData, attendance, members } = state;

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

    // Simple source calculation (no double buffer needed)
    const { finalSource, currentPage } = useMemo(() => {
        if (!currentAgenda) return { finalSource: null, currentPage: 1 };

        const individualSource = currentAgenda.presentation_source;
        let masterSource = null;
        if (agendas && currentAgenda) {
            const idx = agendas.findIndex(a => a.id === currentAgenda.id);
            if (idx >= 0) {
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

        return { finalSource: source, currentPage: parseInt(startPage) };
    }, [currentAgenda, voteData?.presentationPage, agendas]);

    // Calculate result stats (Snapshot support)
    const snapshot = currentAgenda?.vote_snapshot;
    const isConfirmed = !!snapshot;

    const totalAttendance = isConfirmed ? snapshot.stats.total : meetingStats.total;
    const votesYes = isConfirmed ? snapshot.votes.yes : (currentAgenda?.votes_yes || 0);
    const votesNo = isConfirmed ? snapshot.votes.no : (currentAgenda?.votes_no || 0);
    const votesAbstain = isConfirmed ? snapshot.votes.abstain : (currentAgenda?.votes_abstain || 0);

    // Pass Logic based on Vote Type
    const currentAgendaType = currentAgenda?.type || 'majority';
    const normalizeType = (type) => {
        if (type === 'general') return 'majority';
        if (type === 'special') return 'twoThirds';
        return type || 'majority';
    };
    const normalizedType = normalizeType(currentAgendaType);
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
    const liveTotalMembers = members.length;
    const quorumCount = Math.ceil(liveTotalMembers / 2);
    const isTotalQuorumReached = totalAttendance >= quorumCount;
    const isElection = currentAgenda?.type === 'election';
    const directTarget = Math.ceil(liveTotalMembers * 0.2);
    const directAttendance = meetingStats.direct;
    const isDirectSatisfied = !isElection || (directAttendance >= directTarget);
    const isReadyToOpen = isTotalQuorumReached && isDirectSatisfied;

    return (
        <div className="bg-slate-900 rounded-xl overflow-hidden shadow-2xl border-4 border-slate-800">
            {/* Header Status Bar */}
            <div className="bg-slate-950 px-4 py-2 flex justify-between items-center border-b border-slate-800">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                    <Monitor size={16} className="text-emerald-500" />
                    <span className="tracking-widest text-emerald-500">TRIPLE LIVE MONITOR</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="px-2 py-1 bg-slate-800 rounded text-[10px] text-slate-400 font-mono">
                        STATUS: <span className="text-white">{projectorMode}</span>
                    </div>
                </div>
            </div>

            {/* Triple Screen Preview Area */}
            <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1">

                {/* 1. RESULT SCREEN (Left) */}
                <div className={`relative aspect-video bg-white rounded overflow-hidden group border-2 transition-colors ${projectorMode === 'RESULT' ? 'border-emerald-500' : 'border-slate-800'}`}>
                    <div className="w-full h-full flex flex-col items-center bg-slate-50 relative overflow-hidden">
                        <div className="absolute inset-1 border border-slate-200 rounded pointer-events-none"></div>
                        <div className="w-full h-full flex flex-col items-center justify-between p-2 z-10">
                            {/* Header */}
                            <div className="flex flex-col items-center w-full mt-1">
                                <div className="bg-slate-900 text-white px-3 py-0.5 rounded-full text-[6px] font-bold shadow-sm mb-1 tracking-wide">
                                    투표 결과 보고
                                </div>
                                <h1 className="text-[11px] font-black text-slate-900 leading-tight text-center line-clamp-2 w-full px-1 break-keep">
                                    {currentAgenda?.title}
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
                    <div className="absolute top-1 left-1 px-1 py-0.5 bg-black/60 text-[8px] text-slate-300 font-mono rounded z-10">SCREEN 1</div>
                    {projectorMode === 'RESULT' && <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-emerald-600/90 text-white text-[8px] font-bold rounded z-10">ON AIR</div>}
                </div>

                {/* 2. PPT SCREEN (Center) */}
                <div className={`relative aspect-video bg-black rounded overflow-hidden group border-2 transition-colors ${projectorMode === 'PPT' || projectorMode === 'IDLE' ? 'border-emerald-500' : 'border-slate-800'}`}>
                    {finalSource ? (
                        <div className="w-full h-full bg-white relative overflow-hidden">
                            {/* PDFViewer for reliable display */}
                            <PDFViewer
                                url={finalSource}
                                pageNumber={currentPage}
                            />
                            {/* Clickblocker */}
                            <div className="absolute inset-0 bg-transparent z-20"></div>
                        </div>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-center p-2 bg-slate-900 text-white">
                            <div className="text-[8px] text-slate-500 mb-1 tracking-widest uppercase">PPT VIEW</div>
                            <h1 className="text-[10px] font-bold line-clamp-2 px-2 leading-tight text-slate-100">{currentAgenda?.title || '정기 총회'}</h1>
                            <div className="text-[6px] text-slate-600 mt-1">No PPT URL Linked</div>
                        </div>
                    )}
                    <div className="absolute top-1 left-1 px-1 py-0.5 bg-black/60 text-[8px] text-slate-300 font-mono rounded z-10">SCREEN 2</div>
                    {(projectorMode === 'PPT' || projectorMode === 'IDLE') && <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-emerald-600/90 text-white text-[8px] font-bold rounded z-10">ON AIR</div>}
                </div>


                {/* 3. WAITING SCREEN (Right) */}
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
                                <span><span className="font-bold text-white">전체 성원</span> (과반수)</span>
                                <div><span className="font-bold text-white">{totalAttendance}</span><span className="mx-0.5">/</span>{quorumCount}명</div>
                            </div>
                            <div className="w-full h-[2px] bg-slate-700 rounded-full overflow-hidden relative shadow-inner">
                                <div className="absolute top-0 bottom-0 left-1/2 w-[0.5px] bg-white/30 z-20 border-r border-black/20"></div>
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
            </div>
        </div>
    );
}
