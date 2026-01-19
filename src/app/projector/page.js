'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, Settings } from 'lucide-react';
import dynamic from 'next/dynamic';

const PDFViewer = dynamic(() => import('@/components/PDFViewer'), { ssr: false });

export default function ProjectorPage() {
    const { state } = useStore();
    const { projectorMode, agendas, currentAgendaId, voteData, attendance, members } = state;
    const [resultTimestamp, setResultTimestamp] = useState(null);

    // Update timestamp when mode changes to RESULT
    useEffect(() => {
        if (projectorMode === 'RESULT') {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });
            setResultTimestamp(`${timeStr}:00`);
        } else {
            setResultTimestamp(null);
        }
    }, [projectorMode]);

    // Broadcast Presence
    useEffect(() => {
        const channel = supabase.channel('room_presence', {
            config: {
                presence: {
                    key: 'projector',
                },
            },
        });

        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await channel.track({ type: 'projector', online_at: new Date().toISOString() });
            }
        });

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Listen for Remote Close Command
    useEffect(() => {
        const channel = supabase.channel('projector_control');
        channel
            .on('broadcast', { event: 'close_projector' }, () => {
                console.log('[Projector] Received Close Command');
                window.close();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

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

        <div className="flex flex-col w-screen h-screen bg-black overflow-hidden font-sans text-slate-900 relative">

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
                        <div className="flex flex-col items-center justify-center p-[5vh] text-center bg-slate-900 w-full h-full">
                            <div className="mb-[3vh] p-[2vh] bg-slate-800 rounded-full">
                                <Settings size="8vh" className="animate-spin-slow opacity-50" />
                            </div>
                            <h1 className="text-[min(6vw,8vh)] font-black mb-[3vh] tracking-tight leading-tight max-w-[80vw] break-keep">{currentAgenda?.title || '정기 총회'}</h1>
                            <p className="text-[min(2.5vw,3vh)] text-slate-400 font-light">
                                {projectorMode === 'PPT' ? '안건 설명 자료가 없습니다.' : '잠시만 기다려 주십시오.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>



            {/* 1.5 LAYER: ADJUSTING (Z-index 25) */}
            <div className={`absolute inset-0 transition-opacity duration-300 ${projectorMode === 'ADJUSTING' ? 'opacity-100 z-25' : 'opacity-0 z-0 pointer-events-none'}`}>
                <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center text-white overflow-hidden relative">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 to-slate-950"></div>

                    {/* Content */}
                    <div className="relative z-10 flex flex-col items-center animate-in fade-in duration-700">
                        <Settings
                            size={120}
                            strokeWidth={0.8}
                            className="text-slate-400 mb-8 animate-[spin_8s_linear_infinite] drop-shadow-2xl"
                        />
                        <h1 className="text-4xl font-bold text-slate-200 tracking-tight mb-4">결과 데이터 정정 중입니다...</h1>
                        <p className="text-xl text-slate-500 font-light tracking-wide">잠시만 기다려주세요.</p>
                    </div>

                    {/* Footer Gradient Line */}
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"></div>
                </div>
            </div>


            {/* 2. LAYER: WAITING (Viewport Adaptive) */}
            <div className={`absolute inset-0 transition-opacity duration-300 ${projectorMode === 'WAITING' ? 'opacity-100 z-20' : 'opacity-0 z-0 pointer-events-none'}`}>
                <div className="w-full h-full flex flex-col bg-slate-900 text-white relative items-center justify-center p-[4vh]">
                    <div className="absolute inset-0 overflow-hidden opacity-10 font-sans pointer-events-none">
                        <div className="absolute -top-[20%] -right-[10%] w-[50vw] h-[50vw] bg-blue-600 rounded-full blur-[10vw]"></div>
                        <div className="absolute -bottom-[20%] -left-[10%] w-[40vw] h-[40vw] bg-emerald-600 rounded-full blur-[10vw]"></div>
                    </div>
                    <div className="relative z-10 flex flex-col items-center w-full max-w-[90vw]">
                        <div className="flex items-center gap-[1vw] mb-[2vh] text-slate-400">
                            <span className="uppercase tracking-[0.3em] font-bold text-[min(1.2vw,1.5vh)]">2026 Regular General Meeting</span>
                            <div className="w-[5vw] h-px bg-slate-600"></div>
                            <span className="font-serif italic font-sans text-[min(1.2vw,1.5vh)]">Live Status</span>
                        </div>
                        <h1 className="text-[min(4vw,6vh)] font-black mb-[4vh] tracking-tight text-center">정기 총회 성원 현황</h1>

                        <div className="flex flex-col items-center mb-[4vh] scale-100">
                            <div className="text-[min(1.5vw,2vh)] font-medium text-slate-400 mb-[1vh]">현재 집계 인원</div>
                            <div className="relative flex items-baseline justify-center mb-0">
                                <span className="text-[min(12vw,18vh)] font-black leading-none tracking-tighter text-white tabular-nums drop-shadow-2xl">
                                    {waitingStats.liveTotalAttendance.toLocaleString()}
                                </span>
                                <span className="absolute left-full bottom-[2vh] ml-[1vw] text-[min(2.5vw,3vh)] text-slate-500 font-light whitespace-nowrap">명</span>
                            </div>
                            <div className="flex items-center text-[min(1.5vw,2vh)] text-slate-400 font-medium font-mono mt-[2vh]">
                                <span className="text-emerald-400">참석 {meetingStats.direct}</span>
                                <span className="mx-[1vw] text-slate-700">|</span>
                                <span className="text-blue-400">대리 {meetingStats.proxy}</span>
                                <span className="mx-[1vw] text-slate-700">|</span>
                                <span className="text-orange-400">서면 {meetingStats.written}</span>
                            </div>
                        </div>

                        <div className="w-[70%] bg-slate-800/50 rounded-3xl p-[2.5vh] backdrop-blur-sm border border-white/10 shadow-2xl space-y-[2.5vh]">
                            <div>
                                <div className="flex justify-between items-end mb-[1vh]">
                                    <div className="text-[min(1.5vw,2vh)] text-slate-400"><span className="font-bold text-white">전체 성원</span> (과반수 기준)</div>
                                    <div className="text-right">
                                        <span className="text-[min(1.8vw,2.5vh)] font-bold text-white tabular-nums">{waitingStats.liveTotalAttendance}</span>
                                        <span className="text-slate-500 mx-[0.5vw]">/</span>
                                        <span className="text-[min(1.5vw,2vh)] text-slate-400">{waitingStats.quorumCount}명</span>
                                    </div>
                                </div>
                                <div className="w-full h-[2vh] bg-slate-700 rounded-full overflow-hidden relative shadow-inner">
                                    <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/30 z-20 border-r border-black/20"></div>
                                    <div className={`h-full transition-all duration-1000 ease-out ${waitingStats.isTotalQuorumReached ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-gradient-to-r from-blue-900 to-blue-500'}`} style={{ width: `${Math.min(100, (waitingStats.liveTotalAttendance / (waitingStats.liveTotalMembers || 1)) * 100)}%` }}></div>
                                </div>
                            </div>
                            {waitingStats.isElection && (
                                <div className="pt-[2.5vh] border-t border-white/5">
                                    <div className="flex justify-between items-end mb-[1vh]">
                                        <div className="text-[min(1.5vw,2vh)] text-emerald-100/80"><span className="font-bold text-emerald-400">직접 참석</span> (조합원 20% 필수)</div>
                                        <div className="text-right flex items-baseline gap-[0.5vw]">
                                            <span className={`text-[min(1.8vw,2.5vh)] font-bold tabular-nums ${waitingStats.isDirectSatisfied ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {waitingStats.directPercent.toFixed(1)}%
                                            </span>
                                            <span className="text-slate-500">/</span>
                                            <span className="text-[min(1.5vw,2vh)] text-slate-400">20% ({waitingStats.directTarget}명)</span>
                                        </div>
                                    </div>
                                    <div className="w-full h-[1.5vh] bg-slate-700/50 rounded-full overflow-hidden relative shadow-inner">
                                        <div className="absolute top-0 bottom-0 left-[20%] w-0.5 bg-emerald-500/50 z-20 border-r border-black/10"></div>
                                        <div className={`h-full transition-all duration-1000 ease-out ${waitingStats.isDirectSatisfied ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-gradient-to-r from-red-900 to-red-600'}`} style={{ width: `${Math.min(100, (meetingStats.direct / (waitingStats.liveTotalMembers || 1)) * 100)}%` }}></div>
                                    </div>
                                </div>
                            )}
                            <div className="text-center pt-[0.5vh]">
                                {waitingStats.isReadyToOpen && waitingStats.liveTotalMembers > 0 ? (
                                    <div className="inline-flex items-center gap-[1.5vw] bg-emerald-950/90 text-emerald-400 px-[3vw] py-[1.5vh] rounded-full border border-emerald-500/50 shadow-[0_0_50px_rgba(16,185,129,0.3)] backdrop-blur-md">
                                        <CheckCircle2 size="3vh" className="animate-bounce" />
                                        <span className="text-[min(2vw,2.5vh)] font-bold tracking-tight">성원이 충족되었습니다. 잠시 후 개회하겠습니다.</span>
                                    </div>
                                ) : (
                                    <div className="inline-flex flex-col gap-4 items-center">
                                        <div className="inline-flex items-center justify-center gap-[1vw] bg-slate-800/80 text-slate-300 px-[3vw] py-[1.2vh] rounded-full border border-white/10 shadow-lg backdrop-blur-sm">
                                            <div className="w-[1.2vh] h-[1.2vh] bg-red-500 rounded-full animate-pulse"></div>
                                            <span className="text-[min(1.5vw,2vh)] font-medium">조합원님의 입장을 기다리고 있습니다...</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. LAYER: RESULT (Viewport Adaptive) */}
            <div className={`absolute inset-0 transition-opacity duration-300 ${projectorMode === 'RESULT' ? 'opacity-100 z-30' : 'opacity-0 z-0 pointer-events-none'}`}>
                <div className="w-full h-full flex flex-col bg-slate-50 text-slate-900 relative p-[2vh]">
                    <div className="absolute inset-[2vh] border-4 border-slate-700 pointer-events-none z-10 rounded-xl opacity-10"></div>

                    {/* Header: Adjusted to be half-way between previous positions */}
                    <div className="flex-none h-[25%] flex flex-col items-center justify-end pb-[2vh] z-20">
                        <div className="bg-slate-900 text-white px-[3vw] py-[0.9vh] rounded-full text-[min(2.25vw,3vh)] font-bold shadow-md mb-[2vh] tracking-wide">투표 결과 보고</div>
                        <h1 className="text-[min(5vw,7vh)] font-black text-slate-900 leading-tight text-center break-keep drop-shadow-sm px-8">{resultStats.agendaTitle}</h1>
                    </div>

                    <div className="w-full h-px bg-slate-200 opacity-50 my-[1vh]"></div>

                    {/* Main Declaration Box: Flex-Grow (Fills remaining space) */}
                    <div className="flex-1 min-h-0 w-full max-w-[80vw] mx-auto z-20 flex flex-col justify-center py-[1vh]">
                        <div className="w-full min-h-[40%] h-auto bg-white border-2 border-slate-800 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] flex flex-col items-center justify-center text-center relative overflow-hidden p-[3vh]">
                            <div className="absolute top-0 left-0 w-full h-[1vh] bg-slate-100"></div>

                            <div className="flex-1 min-h-0 flex flex-col items-center justify-center w-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                                {resultStats.customDeclaration ? (
                                    <div className="text-[min(3vw,4vh)] font-serif leading-relaxed text-slate-800 font-medium break-keep whitespace-pre-wrap px-[2vw]">
                                        {resultStats.customDeclaration.split(/(가결|부결)/g).map((part, i) => {
                                            if (part === '가결') return <span key={i} className="inline-block mx-3 px-[1.5vw] py-[0.5vh] bg-emerald-600 text-white rounded-lg font-sans font-black tracking-widest border-2 border-emerald-700 shadow-lg align-middle text-[min(3.5vw,5vh)] uppercase">가 결</span>;
                                            if (part === '부결') return <span key={i} className="inline-block mx-2 px-[1.2vw] py-0 bg-red-600 text-white rounded font-sans font-black tracking-wide border border-red-700 shadow align-middle text-[min(3.5vw,5vh)]">부 결</span>;
                                            return part;
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-[min(3vw,4vh)] font-serif leading-relaxed text-slate-800 font-medium break-keep">
                                        &quot;<span className="font-extrabold underline decoration-slate-300 underline-offset-8 decoration-4">{resultStats.agendaTitle}</span>&quot;은<br />
                                        전체 참석자 <span className="text-slate-900 font-black">{resultStats.totalAttendance.toLocaleString()}</span>명 중 {resultStats.isSpecialVote ? '3분의 2' : '과반수'} 찬성으로
                                    </p>
                                )}

                                {(!resultStats.customDeclaration || !resultStats.customDeclaration.includes('선포')) && (
                                    <div className="flex items-center gap-[3vw] mt-[3vh]">
                                        <div className={`px-[2.5vw] py-[0.8vh] rounded-xl shadow-lg border-2 ${resultStats.isPassed ? 'bg-emerald-600 border-emerald-700' : 'bg-red-600 border-red-700'}`}>
                                            <span className="text-[min(4vw,5.5vh)] font-black text-white tracking-[0.5em]">{resultStats.isPassed ? '가 결' : '부 결'}</span>
                                        </div>
                                        <span className="text-[min(3.5vw,4.5vh)] font-serif font-black text-slate-900">되었음을 선포합니다.</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Stats Grid: Fixed Height relative to viewport (approx 15-20%) */}
                    <div className="flex-none h-[18vh] w-full max-w-[80vw] mx-auto z-20 grid grid-cols-4 gap-[1.5vw] my-[1.5vh]">
                        <div className="flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-slate-100 shadow-sm">
                            <div className="text-[min(1.4vw,1.8vh)] font-bold text-slate-500 mb-[0.5vh]">총 참석</div>
                            <div className="text-[min(5vw,7.5vh)] font-black font-mono tracking-tight text-slate-800 mb-[0.2vh]">{resultStats.totalAttendance.toLocaleString()}</div>
                        </div>
                        <div className="flex flex-col items-center justify-center bg-blue-50 rounded-xl border border-blue-100 shadow-md transform scale-105 z-10">
                            <div className="flex items-center gap-2 mb-[0.5vh]"><div className="text-[min(1.4vw,1.8vh)] font-bold text-blue-600">찬성</div><CheckCircle2 size="2vh" className="text-blue-500" /></div>
                            <div className="text-[min(5vw,7.5vh)] font-black font-mono tracking-tight text-blue-700 mb-[0.2vh]">{resultStats.votesYes.toLocaleString()}</div>
                        </div>
                        <div className="flex flex-col items-center justify-center bg-red-50 rounded-xl border border-red-50 shadow-sm">
                            <div className="text-[min(1.4vw,1.8vh)] font-bold text-red-700 mb-[0.5vh]">반대</div>
                            <div className="text-[min(5vw,7.5vh)] font-black font-mono tracking-tight text-red-800 mb-[0.2vh]">{resultStats.votesNo.toLocaleString()}</div>
                        </div>
                        <div className="flex flex-col items-center justify-center bg-slate-100 rounded-xl border border-slate-200 shadow-sm">
                            <div className="text-[min(1.4vw,1.8vh)] font-bold text-slate-600 mb-[0.5vh]">기권/무효</div>
                            <div className="text-[min(5vw,7.5vh)] font-black font-mono tracking-tight text-slate-700 mb-[0.2vh]">{resultStats.votesAbstain.toLocaleString()}</div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex-none h-[5vh] flex items-center justify-center px-12 z-20">
                        <p className="text-slate-400 font-serif text-[min(1.2vw,1.8vh)] tracking-wider">
                            2026년도 정기총회 | {resultTimestamp ? `집계시간 ${resultTimestamp}` : '집계 완료'}
                        </p>
                    </div>

                </div>
            </div>
        </div>
    );
}
