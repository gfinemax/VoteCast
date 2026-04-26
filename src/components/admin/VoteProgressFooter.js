'use client';

import { useEffect, useCallback } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export default function VoteProgressFooter({
    currentNavIndex,
    navigableAgendas,
    progressPercent,
    onPrevious,
    onNext,
    onApply,
    onToggleAutoCalc,
    isAutoCalc
}) {
    const handleKeyDown = useCallback((e) => {
        if (e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;

        const activeElement = document.activeElement;
        const isInputFocused =
            ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement?.tagName) ||
            activeElement?.isContentEditable;

        if (e.key === ' ' || e.code === 'Space') {
            // Space: 입력 적용 / 확인 — input 안에서는 동작하지 않음
            if (isInputFocused) return;
            e.preventDefault();
            onApply?.();
        } else if (e.key === 'a' || e.key === 'A') {
            if (isInputFocused) return;
            e.preventDefault();
            onToggleAutoCalc?.((prev) => !prev);
        } else if (e.key === 'ArrowUp') {
            if (isInputFocused) return;
            e.preventDefault();
            onPrevious?.();
        } else if (e.key === 'ArrowDown') {
            if (isInputFocused) return;
            e.preventDefault();
            onNext?.();
        }
    }, [onApply, onToggleAutoCalc, onPrevious, onNext]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return (
        <div className="mt-6 mb-2 border-t border-slate-200 pt-4 flex items-center justify-between gap-3 text-slate-500">
            {/* Left: Shortcut hints in a single compact row */}
            <div className="flex items-center gap-2 text-xs font-medium flex-shrink-0">
                <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-lg">
                    <span className="font-bold border border-slate-300 shadow-sm rounded px-1 py-0.5 bg-white text-[10px] leading-none">Space</span>
                    <span className="text-slate-500 whitespace-nowrap">입력 / 확인</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-lg">
                    <span className="font-bold border border-slate-300 shadow-sm rounded px-1 py-0.5 bg-white text-[10px] leading-none">A</span>
                    <span className="text-slate-500 whitespace-nowrap">자동계산 토글</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-lg">
                    <span className="font-bold border border-slate-300 shadow-sm rounded px-1 py-0.5 bg-white text-[10px] leading-none">&uarr; &darr;</span>
                    <span className="text-slate-500 whitespace-nowrap">안건 이동</span>
                </div>
                <div className="hidden lg:flex items-center gap-1.5 ml-1 text-[11px] text-slate-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                    <span className="whitespace-nowrap">서버 동기화 상태 양호</span>
                </div>
            </div>

            {/* Right: Agenda navigation in a single row */}
            <div className="flex items-center gap-2 flex-shrink-0">
                <button
                    onClick={onPrevious}
                    className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl font-bold flex items-center gap-1.5 transition-colors shadow-sm text-sm"
                >
                    <ArrowLeft size={14} /> 이전 안건
                </button>

                <div className="hidden sm:flex flex-col items-center justify-center px-3 w-36">
                    <div className="text-[11px] font-bold text-slate-500 mb-1 whitespace-nowrap">{currentNavIndex + 1} / {navigableAgendas.length} 안건 진행중</div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                </div>

                <button
                    onClick={onNext}
                    className="px-4 py-2 bg-slate-800 text-white hover:bg-slate-700 rounded-xl font-bold flex items-center gap-1.5 transition-colors shadow-sm text-sm"
                >
                    다음 안건 <ArrowRight size={14} />
                </button>
            </div>
        </div>
    );
}
