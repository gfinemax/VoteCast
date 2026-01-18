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
                            <div className="flex flex-col items-center w-full mt-0.5">
                                <div className="bg-slate-900 text-white px-2 py-[1px] rounded-full text-[4px] font-bold shadow-sm mb-[2px] tracking-wide">
                                    투표 결과 보고
                                </div>
                                <h1 className="text-[5px] font-black text-slate-900 leading-tight text-center line-clamp-1 w-full px-1">
                                    {currentAgenda?.title}
                                </h1>
                            </div>

                            {/* Declaration Box */}
                            <div className="w-full flex-grow flex items-center justify-center px-0.5 py-[2px]">
                                <div className="w-full h-full bg-white border border-slate-800 p-[2px] rounded shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-[1px] bg-slate-100"></div>
                                    {currentAgenda?.declaration ? (
                                        <div className="text-[3px] font-sans leading-none text-slate-800 font-medium break-keep whitespace-pre-wrap">
                                            {currentAgenda.declaration.split(/(가결|부결)/g).map((part, i) => {
                                                if (part === '가결') return <span key={i} className="inline-block bg-emerald-600 text-white px-[2px] py-[0.5px] rounded mx-[1px] font-bold align-middle mb-[1px]">가결</span>;
                                                if (part === '부결') return <span key={i} className="inline-block bg-red-600 text-white px-[2px] py-[0.5px] rounded mx-[1px] font-bold align-middle mb-[1px]">부결</span>;
                                                return part;
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-[3px] font-serif leading-none text-slate-800">
                                            &quot;{currentAgenda?.title}&quot;...
                                            <div className={`mt-[2px] px-1 rounded text-white font-bold inline-block ${isPassed ? 'bg-emerald-600' : 'bg-red-600'}`}>
                                                {isPassed ? '가 결' : '부 결'}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-4 gap-[2px] w-full mb-[1px]">
                                <div className="flex flex-col items-center bg-slate-50 rounded-[1px] p-[1px] border border-slate-100">
                                    <div className="text-[2px] font-bold text-slate-500">총</div>
                                    <div className="text-[4px] font-black font-mono text-slate-800">{totalAttendance}</div>
                                </div>
                                <div className="flex flex-col items-center bg-blue-50 rounded-[1px] p-[1px] border border-blue-100">
                                    <div className="text-[2px] font-bold text-blue-600">찬</div>
                                    <div className="text-[4px] font-black font-mono text-blue-700">{votesYes}</div>
                                </div>
                                <div className="flex flex-col items-center bg-red-50 rounded-[1px] p-[1px] border border-red-50">
                                    <div className="text-[2px] font-bold text-red-700">반</div>
                                    <div className="text-[4px] font-black font-mono text-red-800">{votesNo}</div>
                                </div>
                                <div className="flex flex-col items-center bg-slate-100 rounded-[1px] p-[1px] border border-slate-200">
                                    <div className="text-[2px] font-bold text-slate-600">무</div>
                                    <div className="text-[4px] font-black font-mono text-slate-700">{votesAbstain}</div>
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

                    <div className="relative z-10 w-full h-full flex flex-col items-center p-2">
                        <div className="flex items-center gap-1 mb-1 opacity-50">
                            <div className="text-[3px] text-slate-300 tracking-wider">2026 GENERAL MEETING</div>
                        </div>
                        <div className="text-[5px] font-bold text-white mb-2">정기 총회 성원 보고</div>

                        <div className="flex items-baseline gap-1 mb-2 scale-110">
                            <span className="text-[12px] font-black leading-none text-white tabular-nums drop-shadow">{totalAttendance}</span>
                            <span className="text-[4px] text-slate-500">명</span>
                        </div>

                        <div className="w-full bg-slate-800/50 rounded p-[2px] border border-white/5 flex flex-col gap-[2px]">
                            <div className="flex justify-between items-end text-[2px] text-slate-400 mb-[1px]">
                                <span>전체 성원</span>
                                <span>{totalAttendance}/{quorumCount}(과반)</span>
                            </div>
                            <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden relative">
                                <div className="absolute top-0 bottom-0 left-1/2 w-[0.5px] bg-white/30 z-20"></div>
                                <div className={`h-full ${isTotalQuorumReached ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-blue-600'}`} style={{ width: `${Math.min(100, (totalAttendance / (liveTotalMembers || 1)) * 100)}%` }}></div>
                            </div>

                            {isElection && (
                                <>
                                    <div className="flex justify-between items-end text-[2px] text-emerald-100/80 mt-[1px]">
                                        <span>직접 참석</span>
                                        <span>{directAttendance}/{directTarget}(20%)</span>
                                    </div>
                                    <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden relative">
                                        <div className="absolute top-0 bottom-0 left-[20%] w-[0.5px] bg-emerald-500/50 z-20"></div>
                                        <div className={`h-full ${isDirectSatisfied ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-red-600'}`} style={{ width: `${Math.min(100, (directAttendance / (liveTotalMembers || 1)) * 100)}%` }}></div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="mt-auto mb-1">
                            {isReadyToOpen ? (
                                <div className="flex items-center gap-1 bg-emerald-900/80 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30 text-[3px] font-bold">
                                    <CheckCircle2 size={4} /> 성원 충족
                                </div>
                            ) : (
                                <div className="bg-slate-800/80 text-slate-400 px-2 py-0.5 rounded-full border border-white/5 text-[3px]">
                                    입장 대기중...
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="absolute top-1 left-1 px-1 py-0.5 bg-black/60 text-[8px] text-slate-300 font-mono rounded z-10">SCREEN 3</div>
                    {projectorMode === 'WAITING' && <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-emerald-600/90 text-white text-[8px] font-bold rounded z-10">ON AIR</div>}
                </div>
            </div>
        </div>
    );
}
