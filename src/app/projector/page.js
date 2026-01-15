'use client';

import React from 'react';
import { useStore } from '@/lib/store';
import { CheckCircle2, Settings } from 'lucide-react';

export default function ProjectorPage() {
    const { state } = useStore();
    const { projectorMode, projectorData, agendas, currentAgendaId } = state;

    // Find info about current agenda for Idle/PPT mode
    const currentAgenda = agendas.find(a => a.id === currentAgendaId);

    if (projectorMode === 'IDLE' || projectorMode === 'PPT') {
        return (
            <div className="flex flex-col h-screen bg-slate-900 text-white items-center justify-center p-20 text-center">
                <div className="mb-8 p-4 bg-slate-800 rounded-full">
                    <Settings size={48} className="animate-spin-slow opacity-50" />
                </div>
                <h1 className="text-6xl font-black mb-6 tracking-tight">{currentAgenda?.title}</h1>
                <p className="text-2xl text-slate-400 font-light">
                    {projectorMode === 'PPT' ? '안건 설명 중입니다.' : '잠시만 기다려 주십시오.'}
                </p>

                {/* Mock PPT Slide Visual */}
                {projectorMode === 'PPT' && (
                    <div className="mt-12 w-full max-w-4xl aspect-video bg-white rounded-lg opacity-10 border-4 border-dashed border-white flex items-center justify-center">
                        <span className="text-4xl font-bold text-slate-500">PPT SLIDE AREA</span>
                    </div>
                )}
            </div>
        );
    }

    // Result Mode
    if (projectorMode === 'RESULT' && projectorData) {
        return (
            <div className="flex flex-col h-screen bg-white text-slate-900 overflow-hidden relative">
                {/* Live Indicator */}
                <div className="absolute top-8 left-8 flex items-center gap-2 z-20">
                    <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                    <span className="font-bold text-red-600 tracking-widest text-sm">LIVE</span>
                </div>

                <div className="absolute inset-8 border-4 border-double border-slate-900 pointer-events-none z-10"></div>

                <div className="flex-1 flex flex-col items-center justify-center p-8 z-0">
                    <span className="text-slate-900 font-serif font-bold tracking-widest text-xl mb-8">OFFICIAL VOTE RESULT</span>

                    <div className="w-full max-w-6xl space-y-12 text-center animate-in fade-in zoom-in duration-500">
                        <h1 className="text-5xl md:text-7xl font-black text-slate-900 leading-tight font-sans break-keep mb-12">
                            {projectorData.agendaTitle}
                        </h1>

                        <div className="grid grid-cols-3 gap-12 text-slate-800">
                            {/* Total Attendance */}
                            <div className="flex flex-col items-center justify-center p-8 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                                <div className="text-3xl font-bold text-slate-500 mb-4">총 참석</div>
                                <div className="text-7xl font-black font-mono tracking-tight text-slate-800">{projectorData.totalAttendance.toLocaleString()}</div>
                                <div className="text-lg text-slate-400 mt-2">명</div>
                            </div>

                            {/* Yes Votes */}
                            <div className="flex flex-col items-center justify-center p-8 bg-blue-50 rounded-2xl border border-blue-100 shadow-sm relative overflow-hidden">
                                <div className="absolute top-4 right-4 text-blue-200 opacity-50">
                                    <CheckCircle2 size={80} />
                                </div>
                                <div className="text-3xl font-bold text-blue-600 mb-2 relative z-10">찬성</div>
                                <div className="text-7xl font-black font-mono tracking-tight text-blue-700 relative z-10">{projectorData.votesYes.toLocaleString()}</div>
                                <div className="text-lg text-blue-500 mt-2 relative z-10">표</div>
                            </div>

                            {/* No & Abstain Column */}
                            <div className="flex flex-col gap-6">
                                {/* No Votes */}
                                <div className="flex-1 flex flex-col items-center justify-center p-4 bg-red-50 rounded-2xl border border-red-100">
                                    <div className="text-xl font-bold text-red-600 mb-1">반대</div>
                                    <div className="text-5xl font-black text-red-800 font-mono">{projectorData.votesNo.toLocaleString()}</div>
                                </div>
                                {/* Abstain */}
                                <div className="flex-1 flex flex-col items-center justify-center p-4 bg-slate-100 rounded-2xl border border-slate-200">
                                    <div className="text-xl font-bold text-slate-600 mb-1">기권/무효</div>
                                    <div className="text-5xl font-black text-slate-700 font-mono">{projectorData.votesAbstain.toLocaleString()}</div>
                                </div>
                            </div>
                        </div>

                        <div className="w-full h-px bg-slate-200 my-8"></div>

                        {/* Declaration Box */}
                        <div className="relative bg-white p-12 rounded-3xl border-2 border-slate-800 shadow-2xl">
                            {/* Stamp */}
                            <div className={`absolute -right-6 -top-10 w-48 h-48 border-8 rounded-full flex items-center justify-center opacity-90 transform rotate-12 mix-blend-multiply ${projectorData.isPassed ? 'border-emerald-600 text-emerald-600' : 'border-red-600 text-red-600'}`}>
                                <span className="text-5xl font-black uppercase tracking-widest">{projectorData.isPassed ? 'PASSED' : 'REJECTED'}</span>
                            </div>

                            <p className="text-3xl md:text-5xl font-serif leading-relaxed text-slate-900 font-bold break-keep">
                                "<span className="underline decoration-slate-400 decoration-4 underline-offset-8">{projectorData.agendaTitle}</span>"은<br />
                                전체 참석자 <span className="text-blue-800">{projectorData.totalAttendance.toLocaleString()}</span>명 중 과반수 찬성으로<br />
                                <span className={`inline-block mt-6 px-8 py-3 text-white rounded-xl ${projectorData.isPassed ? 'bg-emerald-600' : 'bg-red-600'}`}>
                                    {projectorData.isPassed ? '가결' : '부결'}
                                </span> 되었음을 선포합니다.
                            </p>
                        </div>

                        <div className="text-slate-400 text-sm font-serif mt-8">
                            2026년도 정기 총회 | {projectorData.timestamp} 집계 완료
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}
