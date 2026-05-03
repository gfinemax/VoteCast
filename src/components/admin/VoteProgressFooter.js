'use client';

import { useEffect, useCallback } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { isEditableKeyTarget } from '@/components/admin/keyboardScope';
import {
    APP_DEV_NICKNAME,
    APP_DISPLAY_VERSION,
    APP_NAME,
    APP_RELEASE_LABEL
} from '@/lib/appVersion';

export default function VoteProgressFooter({
    currentNavIndex,
    navigableAgendas,
    agendaProgressSummary,
    progressPercent,
    onPrevious,
    onNext,
    onApply,
    onToggleAutoCalc,
    isAutoCalc
}) {
    const handleKeyDown = useCallback((e) => {
        if (e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;

        const isInputFocused = isEditableKeyTarget(e.target || document.activeElement);

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

    const officialTotal = agendaProgressSummary?.totalOfficialAgendas || navigableAgendas.length;
    const officialCurrent = officialTotal > 0
        ? (agendaProgressSummary?.currentOfficialIndex ?? currentNavIndex) + 1
        : 0;
    const electionVoteProgress = agendaProgressSummary?.electionVoteProgress || null;

    return (
        <div
            className="fixed bottom-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 text-slate-500 shadow-[0_-16px_36px_-28px_rgba(15,23,42,0.65)] backdrop-blur"
            style={{ left: 'var(--votecast-sidebar-width, 20rem)' }}
        >
            <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-3">
                {/* Left: App development version */}
                <div className="flex min-w-0 flex-1 items-center text-xs font-medium">
                    <div className="flex min-w-0 items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-slate-500">
                        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400"></span>
                        <span className="hidden sm:inline font-bold text-slate-700 whitespace-nowrap">{APP_NAME}</span>
                        <span className="font-semibold text-slate-600 whitespace-nowrap">{APP_RELEASE_LABEL}</span>
                        <span className="font-bold text-blue-600 whitespace-nowrap">{APP_DISPLAY_VERSION}</span>
                        <span className="text-slate-300">·</span>
                        <span className="truncate font-semibold text-slate-500">{APP_DEV_NICKNAME}</span>
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
                        <div className="text-[11px] font-bold text-slate-500 mb-1 whitespace-nowrap">{officialCurrent} / {officialTotal} 공식 안건</div>
                        {electionVoteProgress && (
                            <div className="text-[10px] font-bold text-orange-600 -mt-0.5 mb-1 whitespace-nowrap">
                                선거 투표 {electionVoteProgress.current} / {electionVoteProgress.total}
                            </div>
                        )}
                        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                        </div>
                    </div>

                    <button
                        onClick={onNext}
                        className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl font-bold flex items-center gap-1.5 transition-colors shadow-sm text-sm"
                    >
                        다음 안건 <ArrowRight size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}
