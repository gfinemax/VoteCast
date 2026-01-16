'use client';

import React from 'react';
import { useStore } from '@/lib/store';
import { Monitor, CheckCircle2 } from 'lucide-react';

export default function LiveMonitor() {
    const { state } = useStore();
    const { projectorMode, projectorData, agendas, currentAgendaId, voteData } = state;

    const currentAgenda = agendas.find(a => a.id === currentAgendaId);

    // Calculate result stats in real-time for preview
    const totalAttendance = (parseInt(voteData.writtenAttendance) || 0) + (parseInt(voteData.directAttendance) || 0) + (parseInt(voteData.proxyAttendance) || 0);
    const totalVotesCast = (parseInt(voteData.votesYes) || 0) + (parseInt(voteData.votesNo) || 0) + (parseInt(voteData.votesAbstain) || 0);
    const isPassed = totalAttendance > 0 && voteData.votesYes >= (totalAttendance / 2);

    // [WAITING SCREEN LOGIC]
    const liveTotalMembers = parseInt(voteData.totalMembers) || 0;
    const quorumCount = Math.ceil(liveTotalMembers / 2);
    const isTotalQuorumReached = totalAttendance >= quorumCount;

    // Election Logic
    const isElection = currentAgenda?.type === 'election';
    const directTarget = Math.ceil(liveTotalMembers * 0.2);
    const directAttendance = parseInt(voteData.directAttendance) || 0;
    const isDirectSatisfied = !isElection || (directAttendance >= directTarget);
    const isReadyToOpen = isTotalQuorumReached && isDirectSatisfied;

    // Helper to mirror the custom declaration logic from Projector
    const getDeclarationText = () => {
        // If we are in RESULT mode, we use the projectorData frozen at publish time
        // But for live preview before publish, we might want to show what will be published?
        // Actually, the Right Screen (RESULT) shows *what is currently on*, so it uses projectorData.

        if (!projectorData) return null;

        if (projectorData.customDeclaration && projectorData.customDeclaration.trim() !== '') {
            return (
                <p className="text-[6px] font-serif leading-relaxed text-slate-800 font-medium break-keep whitespace-pre-wrap">
                    {projectorData.customDeclaration}
                </p>
            );
        }

        return (
            <p className="text-[6px] font-serif leading-relaxed text-slate-800 font-medium break-keep">
                "<span className="font-bold underline decoration-slate-300 underline-offset-2 decoration-1">{projectorData.agendaTitle}</span>"은<br />
                전체 참석자 <span className="text-slate-900 font-bold">{(projectorData?.totalAttendance || 0).toLocaleString()}</span>명 중 과반수 찬성으로
            </p>
        );
    };

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

            {/* Triple Screen Preview Area - High Fidelity */}
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

                            {/* Declaration Box - Full Width */}
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
                                            "{currentAgenda?.title}"...
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
                                    <div className="text-[4px] font-black font-mono text-blue-700">{voteData.votesYes}</div>
                                </div>
                                <div className="flex flex-col items-center bg-red-50 rounded-[1px] p-[1px] border border-red-50">
                                    <div className="text-[2px] font-bold text-red-700">반</div>
                                    <div className="text-[4px] font-black font-mono text-red-800">{voteData.votesNo}</div>
                                </div>
                                <div className="flex flex-col items-center bg-slate-100 rounded-[1px] p-[1px] border border-slate-200">
                                    <div className="text-[2px] font-bold text-slate-600">무</div>
                                    <div className="text-[4px] font-black font-mono text-slate-700">{voteData.votesAbstain}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* overlays */}
                    <div className="absolute top-1 left-1 px-1 py-0.5 bg-black/60 text-[8px] text-slate-300 font-mono rounded z-10">SCREEN 1</div>
                    {projectorMode === 'RESULT' && <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-emerald-600/90 text-white text-[8px] font-bold rounded z-10">ON AIR</div>}
                </div>

                {/* 2. PPT SCREEN (Center) */}
                <div className={`relative aspect-video bg-black rounded overflow-hidden group border-2 transition-colors ${projectorMode === 'PPT' || projectorMode === 'IDLE' ? 'border-emerald-500' : 'border-slate-800'}`}>
                    {currentAgenda?.pptUrl ? (
                        <div className="w-full h-full bg-white flex items-center justify-center overflow-hidden">
                            {/* Mock Iframe Preview */}
                            <iframe
                                src={currentAgenda.pptUrl}
                                className="w-[400%] h-[400%] transform scale-25 origin-top-left pointer-events-none"
                                title="PPT Preview"
                            />
                        </div>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-center p-2 bg-slate-900 text-white">
                            <div className="text-[8px] text-slate-500 mb-1 tracking-widest uppercase">PPT VIEW</div>
                            <h1 className="text-[10px] font-bold line-clamp-2 px-2 leading-tight text-slate-100">{currentAgenda?.title}</h1>
                            <div className="text-[6px] text-slate-600 mt-1">No PPT URL Linked</div>
                        </div>
                    )}
                    <div className="absolute top-1 left-1 px-1 py-0.5 bg-black/60 text-[8px] text-slate-300 font-mono rounded z-10">SCREEN 2</div>
                    {(projectorMode === 'PPT' || projectorMode === 'IDLE') && <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-emerald-600/90 text-white text-[8px] font-bold rounded z-10">ON AIR</div>}
                </div>

                {/* 3. WAITING SCREEN (Right) */}
                <div className={`relative aspect-video bg-slate-900 rounded overflow-hidden group border-2 transition-colors ${projectorMode === 'WAITING' ? 'border-emerald-500' : 'border-slate-800'}`}>
                    {/* Background */}
                    <div className="absolute inset-0 overflow-hidden opacity-20">
                        <div className="absolute -top-[20%] -right-[10%] w-20 h-20 bg-blue-600 rounded-full blur-xl"></div>
                        <div className="absolute -bottom-[20%] -left-[10%] w-20 h-20 bg-emerald-600 rounded-full blur-xl"></div>
                    </div>

                    <div className="relative z-10 w-full h-full flex flex-col items-center p-2">
                        {/* Header */}
                        <div className="flex items-center gap-1 mb-1 opacity-50">
                            <div className="text-[3px] text-slate-300 tracking-wider">2026 GENERAL MEETING</div>
                        </div>
                        <div className="text-[5px] font-bold text-white mb-2">정기 총회 성원 보고</div>

                        {/* Counter */}
                        <div className="flex items-baseline gap-1 mb-2 scale-110">
                            <span className="text-[12px] font-black leading-none text-white tabular-nums drop-shadow">{totalAttendance}</span>
                            <span className="text-[4px] text-slate-500">명</span>
                        </div>

                        {/* Progress Bars Container */}
                        <div className="w-full bg-slate-800/50 rounded p-[2px] border border-white/5 flex flex-col gap-[2px]">
                            {/* Total Quorum */}
                            <div className="flex justify-between items-end text-[2px] text-slate-400 mb-[1px]">
                                <span>전체 성원</span>
                                <span>{totalAttendance}/{quorumCount}(과반)</span>
                            </div>
                            <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden relative">
                                <div className="absolute top-0 bottom-0 left-1/2 w-[0.5px] bg-white/30 z-20"></div>
                                <div className={`h-full ${isTotalQuorumReached ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-blue-600'}`} style={{ width: `${Math.min(100, (totalAttendance / (liveTotalMembers || 1)) * 100)}%` }}></div>
                            </div>

                            {/* Direct Quorum (If Election) */}
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

                        {/* Status Message */}
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

