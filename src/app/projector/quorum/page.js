'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { CheckCircle2 } from 'lucide-react';

export default function QuorumProjectorPage() {
    const { state } = useStore();
    const { agendas, currentAgendaId, attendance, members } = state;
    const [scale, setScale] = useState(1);

    const currentAgenda = useMemo(() => agendas.find(a => a.id === currentAgendaId), [agendas, currentAgendaId]);

    const meetingId = useMemo(() => {
        if (!currentAgenda) return null;
        if (currentAgenda.type === 'folder') return currentAgenda.id;
        const currentIndex = agendas.findIndex(a => a.id === currentAgendaId);
        for (let i = currentIndex - 1; i >= 0; i--) {
            if (agendas[i].type === 'folder') return agendas[i].id;
        }
        return null;
    }, [agendas, currentAgendaId, currentAgenda]);

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

    const direct = meetingStats.direct;
    const written = meetingStats.written;
    const proxy = meetingStats.proxy;
    const liveTotalMembers = members.length;
    const liveTotalAttendance = meetingStats.total;
    const quorumCount = Math.ceil(liveTotalMembers / 2);
    const isTotalQuorumReached = liveTotalAttendance >= quorumCount;
    const isElection = currentAgenda?.type === 'election';
    const directTarget = Math.ceil(liveTotalMembers * 0.2);
    const isDirectSatisfied = !isElection || (direct >= directTarget);
    const directPercent = liveTotalMembers > 0 ? (direct / liveTotalMembers) * 100 : 0;
    const isReadyToOpen = isTotalQuorumReached && isDirectSatisfied;

    return (
        <div className="flex items-center justify-center w-screen h-screen bg-black overflow-hidden font-sans">
            <div style={containerStyle} className="bg-slate-900 text-white relative shadow-2xl flex flex-col items-center justify-center p-20 overflow-hidden shrink-0">
                <div className="absolute inset-0 overflow-hidden opacity-10">
                    <div className="absolute -top-[20%] -right-[10%] w-[1000px] h-[1000px] bg-blue-600 rounded-full blur-[150px]"></div>
                    <div className="absolute -bottom-[20%] -left-[10%] w-[800px] h-[800px] bg-emerald-600 rounded-full blur-[150px]"></div>
                </div>
                <div className="relative z-10 flex flex-col items-center w-full max-w-5xl">
                    <div className="flex items-center gap-4 mb-10 text-slate-400">
                        <span className="uppercase tracking-[0.3em] font-bold">2026 Regular General Meeting</span>
                        <div className="w-20 h-px bg-slate-600"></div>
                        <span className="font-serif italic">Dedicated Quorum Monitor</span>
                    </div>
                    <h1 className="text-6xl font-black mb-16 tracking-tight text-center">정기 총회 성원 현황</h1>
                    <div className="flex flex-col items-center mb-16 scale-125">
                        <div className="text-2xl font-medium text-slate-400 mb-4">현재 집계 인원</div>
                        <div className="relative flex items-baseline justify-center mb-2">
                            <span className="text-[12rem] font-black leading-none tracking-tighter text-white tabular-nums drop-shadow-2xl">
                                {liveTotalAttendance.toLocaleString()}
                            </span>
                            <span className="absolute left-full bottom-8 ml-4 text-4xl text-slate-500 font-light whitespace-nowrap">명</span>
                        </div>
                        <div className="flex items-center text-lg text-slate-400 font-medium">
                            <span className="flex items-center text-emerald-500/80">조합원참석 <b className="text-emerald-400 ml-2 font-mono">{direct}</b></span>
                            <span className="mx-4 text-slate-700">|</span>
                            <span className="flex items-center text-blue-500/80">대리인참석 <b className="text-blue-400 ml-2 font-mono">{proxy}</b></span>
                            <span className="mx-4 text-slate-700">|</span>
                            <span className="flex items-center text-orange-500/80">서면 <b className="text-orange-400 ml-2 font-mono">{written}</b></span>
                        </div>
                    </div>
                    <div className="w-full bg-slate-800/50 rounded-3xl p-10 backdrop-blur-sm border border-white/10 shadow-2xl space-y-8">
                        <div>
                            <div className="flex justify-between items-end mb-4">
                                <div className="text-xl text-slate-400"><span className="font-bold text-white">전체 성원</span> (과반수 기준)</div>
                                <div className="text-right"><span className="text-2xl font-bold text-white tabular-nums">{liveTotalAttendance}</span><span className="text-slate-500 mx-2">/</span><span className="text-xl text-slate-400">{quorumCount}명</span></div>
                            </div>
                            <div className="w-full h-8 bg-slate-700 rounded-full overflow-hidden relative shadow-inner">
                                <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/30 z-20 border-r border-black/20"></div>
                                <div className={`h-full transition-all duration-1000 ease-out ${isTotalQuorumReached ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-gradient-to-r from-blue-900 to-blue-500'}`} style={{ width: `${Math.min(100, (liveTotalAttendance / (liveTotalMembers || 1)) * 100)}%` }}></div>
                            </div>
                        </div>
                        {isElection && (
                            <div className="pt-6 border-t border-white/5">
                                <div className="flex justify-between items-end mb-4">
                                    <div className="text-xl text-emerald-100/80"><span className="font-bold text-emerald-400">직접 참석</span> (조합원 20% 필수)</div>
                                    <div className="text-right flex items-baseline gap-2"><span className={`text-2xl font-bold tabular-nums ${isDirectSatisfied ? 'text-emerald-400' : 'text-red-400'}`}>{directPercent.toFixed(1)}%</span><span className="text-slate-500">/</span><span className="text-xl text-slate-400">20% ({directTarget}명)</span></div>
                                </div>
                                <div className="w-full h-6 bg-slate-700/50 rounded-full overflow-hidden relative shadow-inner">
                                    <div className="absolute top-0 bottom-0 left-[20%] w-0.5 bg-emerald-500/50 z-20 border-r border-black/10"></div>
                                    <div className={`h-full transition-all duration-1000 ease-out ${isDirectSatisfied ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-gradient-to-r from-red-900 to-red-600'}`} style={{ width: `${Math.min(100, (direct / (liveTotalMembers || 1)) * 100)}%` }}></div>
                                </div>
                            </div>
                        )}
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
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
