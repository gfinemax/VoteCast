'use client';

import { Lock, Unlock } from 'lucide-react';

const VOTE_TYPE_OPTIONS = [
    {
        value: 'majority',
        label: '일반',
        activeClass: 'bg-blue-600 text-white font-black shadow-[0_0_15px_rgba(37,99,235,0.4)] border-blue-500'
    },
    {
        value: 'election',
        label: '선거',
        activeClass: 'bg-emerald-600 text-white font-black shadow-[0_0_15px_rgba(5,150,105,0.4)] border-emerald-500'
    },
    {
        value: 'twoThirds',
        label: '해산/규약',
        activeClass: 'bg-violet-600 text-white font-black shadow-[0_0_15px_rgba(124,58,237,0.4)] border-violet-500'
    }
];

export default function VoteTypeSelector({
    currentAgendaType,
    isConfirmed,
    isTypeLocked,
    onToggleLock,
    onTypeChange
}) {
    return (
        <div className="flex items-center justify-end pt-3 border-t border-slate-800/80 mt-1">
            <div className="flex items-center gap-2">
                <div className="flex items-center rounded-lg border border-slate-700 bg-slate-950/50 p-1 shadow-inner">
                    <button
                        type="button"
                        onClick={onToggleLock}
                        disabled={isConfirmed}
                        title={isTypeLocked ? '투표 유형 잠금 해제' : '투표 유형 잠금'}
                        className={`flex h-7 w-8 items-center justify-center rounded-md transition-all ${
                            isTypeLocked
                                ? 'bg-amber-500/20 text-amber-400 shadow-sm'
                                : 'bg-transparent text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                        } disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                        {isTypeLocked ? <Lock size={12} /> : <Unlock size={12} />}
                    </button>

                    <div className="mx-1.5 h-3 w-px bg-slate-700"></div>

                    <div className="flex items-center">
                        {VOTE_TYPE_OPTIONS.map((option) => {
                            const isActive = currentAgendaType === option.value;
                            return (
                                <button
                                    key={option.value}
                                    onClick={() => onTypeChange(option.value)}
                                    disabled={isConfirmed || isTypeLocked}
                                    className={`rounded-md px-3.5 py-1 text-[11px] whitespace-nowrap transition-all border ${
                                        isActive
                                            ? option.activeClass
                                            : 'border-transparent bg-transparent text-slate-500 hover:bg-slate-800 hover:text-slate-300 font-medium'
                                    } disabled:cursor-not-allowed disabled:opacity-45`}
                                >
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
