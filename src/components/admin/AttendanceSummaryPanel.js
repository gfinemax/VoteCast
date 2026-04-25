'use client';

import VoteTypeSelector from '@/components/admin/VoteTypeSelector';

export default function AttendanceSummaryPanel({
    isConfirmed,
    quorumTarget,
    effectiveTotalAttendance,
    fixedAttendanceLabel,
    isElection,
    totalOnsiteAttendance,
    proxyCount,
    fixedAttendanceCount,
    directCount,
    totalMembers,
    isSpecialVote,
    isQuorumSatisfied,
    isDirectSatisfied,
    currentAgendaType,
    isTypeLocked,
    onToggleLock,
    onTypeChange,
    directTarget
}) {
    return (
        <section className={`flex flex-col flex-1 ${isConfirmed ? "opacity-90 grayscale-[0.3]" : ""}`}>
            <div className="mb-2">
                <div className="flex justify-between items-center">
                    <h3 className="text-base font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                        01.성원집계
                        {isConfirmed && <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 rounded normal-case font-normal">고정됨</span>}
                    </h3>
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-xl relative overflow-hidden ring-1 ring-white/5 group flex flex-col gap-3 flex-1">
                <div className="flex items-center justify-between bg-emerald-950/40 border border-emerald-900/50 rounded-xl p-2.5 px-3 mb-2 transition-colors group-hover:bg-emerald-950/60 group-hover:border-emerald-800/60">
                    <div className="text-emerald-500/70 font-bold text-[11px] tracking-widest uppercase">성원합계(개최기준{quorumTarget}명)</div>
                    <div className="flex items-baseline gap-1 relative top-0.5">
                        <span className="text-3xl font-black text-emerald-400 leading-none tabular-nums tracking-tighter">{effectiveTotalAttendance.toLocaleString()}</span>
                        <span className="text-xs font-bold text-emerald-600/70 ml-0.5">명</span>
                    </div>
                </div>

                <div className="grid grid-cols-[1.1fr_auto_1.6fr] gap-1 mb-1.5 px-0.5 text-[10px] font-bold text-slate-500 text-center tracking-wide items-end">
                    <div>{fixedAttendanceLabel}</div>
                    <div className="w-3"></div>
                    <div className="flex flex-col items-center leading-tight">
                        <span>{isElection ? '현장 선거 가능' : '현장 참석'}</span>
                        <span className="text-[8px] opacity-70">{isElection ? `(총 현장 ${totalOnsiteAttendance}명 중 대리 ${proxyCount}명 제외)` : '(조합원+대리인)'}</span>
                    </div>
                </div>

                <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex-[1.1] flex flex-col items-center justify-center py-2 bg-slate-800/80 border border-slate-700 rounded-xl shadow-inner text-slate-300 transition-colors group-hover:border-slate-600">
                        <span className="font-mono font-black text-2xl tabular-nums leading-none tracking-tight mt-0.5">{fixedAttendanceCount}</span>
                    </div>

                    <div className="text-slate-600 font-black text-lg px-2">+</div>

                    <div className="flex-[1.6] flex items-stretch border border-blue-900/50 bg-blue-900/20 rounded-xl overflow-hidden shadow-inner relative transition-colors group-hover:border-blue-800/60">
                        <div className="flex-1 flex flex-col items-center justify-center py-2 relative">
                            <span className="text-[9px] font-bold text-blue-400/50 absolute top-0.5">조합원</span>
                            <span className="font-mono font-black text-blue-400 text-2xl tabular-nums leading-none mt-3">{directCount}</span>
                        </div>
                        <div className="w-px bg-blue-900/40"></div>
                        <div className={`flex-1 flex flex-col items-center justify-center py-2 relative ${isElection ? 'bg-amber-950/30' : ''}`}>
                            <span className={`text-[9px] font-bold absolute top-0.5 ${isElection ? 'text-amber-300/80' : 'text-blue-400/50'}`}>{isElection ? '대리인 제외' : '대리인'}</span>
                            <span className={`font-mono font-black text-2xl tabular-nums leading-none mt-3 ${isElection ? 'text-amber-300' : 'text-blue-400'}`}>{proxyCount}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800 transition-colors group-hover:bg-slate-950/70 mt-1">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-slate-400">전체 조합원 수</label>
                        <div className="flex items-center gap-1">
                            <span className="font-mono text-lg font-bold text-slate-200">{totalMembers}</span>
                            <span className="text-xs text-slate-500">명</span>
                        </div>
                    </div>

                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-2 relative">
                        <div className="absolute top-0 bottom-0 w-0.5 flex flex-col bg-slate-400/50 z-10" style={{ left: isSpecialVote ? '66.66%' : '50%' }}></div>
                        <div
                            className={`h-full transition-all duration-500 ${isQuorumSatisfied ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500'}`}
                            style={{ width: `${Math.min(100, (effectiveTotalAttendance / (totalMembers || 1)) * 100)}%` }}
                        ></div>
                    </div>

                    <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-500">
                            개회 기준: <span className="text-slate-300 font-bold">{quorumTarget}명</span>
                            {isElection && <span className="text-emerald-500/70 ml-1">중에 현장참석 {directTarget}명(20%)</span>}
                        </span>
                        <span className={`font-bold ${isQuorumSatisfied ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isQuorumSatisfied
                                ? '조건 충족'
                                : `미달 ${!isDirectSatisfied ? '(직접참석 부족)' : `(${Math.max(0, quorumTarget - effectiveTotalAttendance)}명 부족)`}`}
                        </span>
                    </div>
                </div>

                <VoteTypeSelector
                    currentAgendaType={currentAgendaType}
                    isConfirmed={isConfirmed}
                    isTypeLocked={isTypeLocked}
                    onToggleLock={onToggleLock}
                    onTypeChange={onTypeChange}
                />
            </div>
        </section>
    );
}
