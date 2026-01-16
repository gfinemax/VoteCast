'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { CheckCircle2, Settings } from 'lucide-react';

export default function ProjectorPage() {
    const { state } = useStore();
    const { projectorMode, projectorData, agendas, currentAgendaId } = state;
    const [scale, setScale] = useState(1);

    // Find info about current agenda for Idle/PPT mode
    const currentAgenda = agendas.find(a => a.id === currentAgendaId);

    // Auto-Scaling Logic (1920x1080 Base)
    useEffect(() => {
        const handleResize = () => {
            const scaleX = window.innerWidth / 1920;
            const scaleY = window.innerHeight / 1080;
            setScale(Math.min(scaleX, scaleY));
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

    // Helper: Generate Declaration Text
    const getDeclarationText = () => {
        if (!projectorData) return null;

        // 1. If Custom Text exists, use it BUT we still need to render the Result Button separately if needed.
        // The user request implies they want to edit the text "part". 
        // Let's assume the custom text REPLACES the "sentences" before the result.

        if (projectorData.customDeclaration && projectorData.customDeclaration.trim() !== '') {
            return (
                <p className="text-5xl font-serif leading-relaxed text-slate-800 font-medium break-keep whitespace-pre-wrap">
                    {projectorData.customDeclaration}
                </p>
            );
        }

        // 2. Default Auto-Generation
        return (
            <p className="text-5xl font-serif leading-relaxed text-slate-800 font-medium break-keep">
                "<span className="font-bold underline decoration-slate-300 underline-offset-8 decoration-4">{projectorData.agendaTitle}</span>"은<br />
                전체 참석자 <span className="text-slate-900 font-bold">{projectorData.totalAttendance.toLocaleString()}</span>명 중 과반수 찬성으로
            </p>
        );
    };


    return (
        <div className="flex items-center justify-center w-screen h-screen bg-black overflow-hidden font-sans">
            <div style={containerStyle} className="bg-white relative shadow-2xl flex flex-col overflow-hidden shrink-0">

                {/* --- MODE: IDLE or PPT --- */}
                {(projectorMode === 'IDLE' || projectorMode === 'PPT') && (
                    <div className="w-full h-full flex flex-col bg-slate-900 text-white items-center justify-center p-20 text-center relative">
                        <div className="mb-10 p-6 bg-slate-800 rounded-full">
                            <Settings size={80} className="animate-spin-slow opacity-50" />
                        </div>
                        <h1 className="text-7xl font-black mb-10 tracking-tight leading-tight max-w-6xl break-keep">{currentAgenda?.title}</h1>
                        <p className="text-3xl text-slate-400 font-light">
                            {projectorMode === 'PPT' ? '안건 설명 중입니다.' : '잠시만 기다려 주십시오.'}
                        </p>

                        {projectorMode === 'PPT' && (
                            <div className="mt-14 w-full max-w-5xl aspect-video bg-white/5 rounded-2xl border-4 border-dashed border-white/20 flex items-center justify-center relative">
                                <span className="text-5xl font-bold text-white/30">PPT SLIDE AREA</span>
                                <div className="absolute bottom-4 right-6 text-xl text-white/40 font-mono">1920 x 1080</div>
                            </div>
                        )}
                    </div>
                )}

                {/* --- MODE: WAITING (Check-in Status Board) --- */}
                {projectorMode === 'WAITING' && (
                    <div className="w-full h-full flex flex-col bg-slate-900 text-white relative items-center justify-center p-20">
                        {(() => {
                            // Derive Live Data
                            const { voteData } = state;
                            const direct = parseInt(voteData.directAttendance) || 0;
                            const written = parseInt(voteData.writtenAttendance) || 0;
                            const proxy = parseInt(voteData.proxyAttendance) || 0;

                            const liveTotalMembers = voteData.totalMembers || 0;
                            const liveTotalAttendance = direct + written + proxy;

                            const quorumCount = Math.ceil(liveTotalMembers / 2);
                            const isTotalQuorumReached = liveTotalAttendance >= quorumCount;

                            // **FIX**: Election Mode determined by currentAgenda.type (per-agenda source of truth)
                            const normalizeType = (type) => {
                                if (type === 'general') return 'majority';
                                if (type === 'special') return 'twoThirds';
                                return type || 'majority';
                            };
                            const currentAgendaType = normalizeType(currentAgenda?.type);
                            const isElection = currentAgendaType === 'election';

                            const directTarget = Math.ceil(liveTotalMembers * 0.2);
                            const isDirectSatisfied = !isElection || (direct >= directTarget);
                            const directPercent = liveTotalMembers > 0 ? (direct / liveTotalMembers) * 100 : 0;

                            // Final Status -> Must meet Total Quorum AND Direct Requirement
                            const isReadyToOpen = isTotalQuorumReached && isDirectSatisfied;

                            return (
                                <>
                                    {/* Background Decoration */}
                                    <div className="absolute inset-0 overflow-hidden opacity-10">
                                        <div className="absolute -top-[20%] -right-[10%] w-[1000px] h-[1000px] bg-blue-600 rounded-full blur-[150px]"></div>
                                        <div className="absolute -bottom-[20%] -left-[10%] w-[800px] h-[800px] bg-emerald-600 rounded-full blur-[150px]"></div>
                                    </div>

                                    <div className="relative z-10 flex flex-col items-center w-full max-w-5xl">
                                        <div className="flex items-center gap-4 mb-10 text-slate-400">
                                            <span className="uppercase tracking-[0.3em] font-bold">2026 Regular General Meeting</span>
                                            <div className="w-20 h-px bg-slate-600"></div>
                                            <span className="font-serif italic">Live Status</span>
                                        </div>

                                        <h1 className="text-6xl font-black mb-16 tracking-tight text-center">정기 총회 성원 보고</h1>

                                        {/* Main Counter */}
                                        <div className="flex flex-col items-center mb-16 scale-125">
                                            <div className="text-2xl font-medium text-slate-400 mb-4">현재 참석 인원</div>
                                            <div className="flex items-baseline gap-4 mb-2">
                                                <span className="text-[12rem] font-black leading-none tracking-tighter text-white tabular-nums drop-shadow-2xl">
                                                    {liveTotalAttendance.toLocaleString()}
                                                </span>
                                                <span className="text-4xl text-slate-500 font-light">명</span>
                                            </div>

                                            {/* Breakdown Row (Minimal) */}
                                            <div className="flex items-center text-lg text-slate-400 font-medium">
                                                <span className="flex items-center text-slate-500">
                                                    서면 <b className="text-slate-300 ml-2 font-mono">{written}</b>
                                                </span>
                                                <span className="mx-4 text-slate-700">|</span>
                                                <span className="flex items-center text-emerald-500/80">
                                                    조합원참석 <b className="text-emerald-400 ml-2 font-mono">{direct}</b>
                                                </span>
                                                <span className="mx-4 text-slate-700">|</span>
                                                <span className="flex items-center text-yellow-500/80">
                                                    대리인참석 <b className="text-yellow-400 ml-2 font-mono">{proxy}</b>
                                                </span>
                                            </div>
                                        </div>

                                        {/* Progress & Quorum Container */}
                                        <div className="w-full bg-slate-800/50 rounded-3xl p-10 backdrop-blur-sm border border-white/10 shadow-2xl space-y-8">

                                            {/* 1. Main Quorum (Total) */}
                                            <div>
                                                <div className="flex justify-between items-end mb-4">
                                                    <div className="text-xl text-slate-400">
                                                        <span className="font-bold text-white">전체 성원</span> (과반수 기준)
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-2xl font-bold text-white tabular-nums">{liveTotalAttendance}</span>
                                                        <span className="text-slate-500 mx-2">/</span>
                                                        <span className="text-xl text-slate-400">{quorumCount}명</span>
                                                    </div>
                                                </div>
                                                <div className="w-full h-8 bg-slate-700 rounded-full overflow-hidden relative shadow-inner">
                                                    <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/30 z-20 border-r border-black/20"></div>
                                                    <div
                                                        className={`h-full transition-all duration-1000 ease-out ${isTotalQuorumReached ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-gradient-to-r from-blue-900 to-blue-500'}`}
                                                        style={{ width: `${Math.min(100, (liveTotalAttendance / (liveTotalMembers || 1)) * 100)}%` }}
                                                    ></div>
                                                </div>
                                            </div>

                                            {/* 2. Direct Attendance (Election Only) */}
                                            {isElection && (
                                                <div className="pt-6 border-t border-white/5">
                                                    <div className="flex justify-between items-end mb-4">
                                                        <div className="text-xl text-emerald-100/80">
                                                            <span className="font-bold text-emerald-400">직접 참석</span> (조합원 20% 필수)
                                                        </div>
                                                        <div className="text-right flex items-baseline gap-2">
                                                            <span className={`text-2xl font-bold tabular-nums ${isDirectSatisfied ? 'text-emerald-400' : 'text-red-400'}`}>
                                                                {directPercent.toFixed(1)}%
                                                            </span>
                                                            <span className="text-slate-500">/</span>
                                                            <span className="text-xl text-slate-400">20% ({directTarget}명)</span>
                                                        </div>
                                                    </div>
                                                    <div className="w-full h-6 bg-slate-700/50 rounded-full overflow-hidden relative shadow-inner">
                                                        {/* 20% Marker */}
                                                        <div className="absolute top-0 bottom-0 left-[20%] w-0.5 bg-emerald-500/50 z-20 border-r border-black/10"></div>

                                                        <div
                                                            className={`h-full transition-all duration-1000 ease-out ${isDirectSatisfied ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-gradient-to-r from-red-900 to-red-600'}`}
                                                            style={{ width: `${Math.min(100, (direct / (liveTotalMembers || 1)) * 100)}%` }}
                                                        ></div>
                                                    </div>
                                                    {!isDirectSatisfied && (
                                                        <div className="text-right mt-2 text-red-500/80 text-sm font-medium animate-pulse">
                                                            * 직접 참석 인원이 <b>{Math.max(0, directTarget - direct)}명</b> 부족합니다.
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Status Message */}
                                            <div className="text-center pt-2">
                                                {isReadyToOpen && liveTotalMembers > 0 ? (
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
                                                        {isTotalQuorumReached && !isDirectSatisfied && (
                                                            <div className="flex items-center gap-2 text-orange-300 font-bold text-xl bg-orange-950/90 px-6 py-2 rounded-full border border-orange-500/50 shadow-lg animate-pulse">
                                                                <span className="text-2xl mr-1">!</span>
                                                                전체 성원은 충족되었으나, 직접 참석 비율이 부족합니다
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                )}

                {/* --- MODE: RESULT --- */}
                {projectorMode === 'RESULT' && (
                    (() => {
                        // Derive all data from synced state (voteData + currentAgenda)
                        const { voteData } = state;
                        const totalAttendance = (parseInt(voteData.directAttendance) || 0) +
                            (parseInt(voteData.proxyAttendance) || 0) +
                            (parseInt(voteData.writtenAttendance) || 0);
                        const votesYes = parseInt(voteData.votesYes) || 0;
                        const votesNo = parseInt(voteData.votesNo) || 0;
                        const votesAbstain = parseInt(voteData.votesAbstain) || 0;

                        // Pass threshold (simplified - majority)
                        const passThreshold = Math.ceil(totalAttendance / 2);
                        const isPassed = votesYes >= passThreshold;

                        const agendaTitle = currentAgenda?.title || '안건';
                        // Use per-agenda declaration
                        const customDeclaration = currentAgenda?.declaration || '';

                        return (
                            <div className="w-full h-full flex flex-col bg-slate-50 text-slate-900 relative">

                                {/* Border Frame */}
                                <div className="absolute inset-8 border-4 border-slate-700 pointer-events-none z-10 rounded-xl opacity-10"></div>

                                <div className="flex-1 flex flex-col items-center py-16 px-24 z-20 h-full justify-between pb-24">

                                    {/* [HEADER ZONE] */}
                                    <div className="flex flex-col items-center justify-center w-full mt-4">

                                        {/* Badge - Increased size approx 1.5x */}
                                        <div className="bg-slate-900 text-white px-12 py-3 rounded-full text-3xl font-bold shadow-md mb-6 tracking-wide">
                                            투표 결과 보고
                                        </div>

                                        {/* Title */}
                                        <h1 className="text-7xl font-black text-slate-900 leading-tight text-center break-keep drop-shadow-sm">
                                            {agendaTitle}
                                        </h1>
                                    </div>

                                    {/* Divider */}
                                    <div className="w-full h-px bg-slate-200 opacity-50"></div>

                                    {/* [DECLARATION ZONE] - Middle */}
                                    <div className="w-full max-w-7xl flex-grow flex items-center justify-center py-4">
                                        {/* Box Style Container */}
                                        <div className="w-full bg-white border-2 border-slate-800 p-12 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] flex flex-col items-center justify-center gap-8 text-center relative overflow-hidden">
                                            <div className="absolute top-0 left-0 w-full h-2 bg-slate-100"></div>

                                            {/* Declaration Text */}
                                            {customDeclaration && customDeclaration.trim() !== '' ? (
                                                <p className="text-5xl font-serif leading-relaxed text-slate-800 font-medium break-keep whitespace-pre-wrap">
                                                    {customDeclaration.split(/(가결|부결)/g).map((part, i) => {
                                                        if (part === '가결') return (
                                                            <span key={i} className="inline-block mx-2 px-10 py-2 bg-emerald-600 text-white rounded-lg font-sans font-bold tracking-widest border border-emerald-700 shadow-sm align-middle text-6xl">
                                                                가결
                                                            </span>
                                                        );
                                                        if (part === '부결') return (
                                                            <span key={i} className="inline-block mx-2 px-10 py-2 bg-red-600 text-white rounded-lg font-sans font-bold tracking-widest border border-red-700 shadow-sm align-middle text-6xl">
                                                                부결
                                                            </span>
                                                        );
                                                        return part;
                                                    })}
                                                </p>
                                            ) : (
                                                <p className="text-5xl font-serif leading-relaxed text-slate-800 font-medium break-keep">
                                                    "<span className="font-bold underline decoration-slate-300 underline-offset-8 decoration-4">{agendaTitle}</span>"은<br />
                                                    전체 참석자 <span className="text-slate-900 font-bold">{totalAttendance.toLocaleString()}</span>명 중 과반수 찬성으로
                                                </p>
                                            )}

                                            {(!customDeclaration || !customDeclaration.includes('선포')) && (
                                                <div className="flex items-center gap-6 mt-2">
                                                    {/* Result Button */}
                                                    <div className={`px-10 py-3 rounded-lg shadow-md ${isPassed ? 'bg-emerald-600' : 'bg-red-600'}`}>
                                                        <span className="text-5xl font-black text-white tracking-widest">
                                                            {isPassed ? '가 결' : '부 결'}
                                                        </span>
                                                    </div>
                                                    <span className="text-5xl font-serif font-bold text-slate-800">되었음을 선포합니다.</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* [GRID ZONE] - Bottom (4 Columns) */}
                                    <div className="w-full max-w-7xl grid grid-cols-4 gap-6 h-48">
                                        {/* Total Attendance */}
                                        <div className="flex flex-col items-center justify-center bg-slate-50 rounded-2xl p-4 border border-slate-100 shadow-sm">
                                            <div className="text-lg font-bold text-slate-500 mb-2">총 참석</div>
                                            <div className="text-6xl font-black font-mono tracking-tight text-slate-800 mb-1">{totalAttendance.toLocaleString()}</div>
                                            <div className="text-lg text-slate-400">명</div>
                                        </div>

                                        {/* Yes Votes */}
                                        <div className="flex flex-col items-center justify-center bg-blue-50 rounded-2xl p-4 border border-blue-100 shadow-md transform scale-105 z-10">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="text-lg font-bold text-blue-600">찬성</div>
                                                <CheckCircle2 size={24} className="text-blue-500" />
                                            </div>
                                            <div className="text-6xl font-black font-mono tracking-tight text-blue-700 mb-1">{votesYes.toLocaleString()}</div>
                                            <div className="text-lg text-blue-500">표</div>
                                        </div>

                                        {/* No Votes */}
                                        <div className="flex flex-col items-center justify-center bg-red-50 rounded-2xl p-4 border border-red-50 shadow-sm">
                                            <div className="text-lg font-bold text-red-700 mb-2">반대</div>
                                            <div className="text-6xl font-black font-mono tracking-tight text-red-800 mb-1">{votesNo.toLocaleString()}</div>
                                            <div className="text-lg text-red-500/50">표</div>
                                        </div>

                                        {/* Abstain */}
                                        <div className="flex flex-col items-center justify-center bg-slate-100 rounded-2xl p-4 border border-slate-200 shadow-sm">
                                            <div className="text-lg font-bold text-slate-600 mb-2">기권/무효</div>
                                            <div className="text-6xl font-black font-mono tracking-tight text-slate-700 mb-1">{votesAbstain.toLocaleString()}</div>
                                            <div className="text-lg text-slate-400">표</div>
                                        </div>
                                    </div>

                                </div>

                                {/* [FOOTER] */}
                                <div className="absolute bottom-8 w-full text-center">
                                    <p className="text-slate-400 font-serif text-lg tracking-wider">
                                        2026년도 정기 총회 | <span className="font-mono">{new Date().toLocaleTimeString()}</span> 집계 완료
                                    </p>
                                </div>
                            </div>
                        );
                    })()
                )}
            </div>
        </div>
    );
}
