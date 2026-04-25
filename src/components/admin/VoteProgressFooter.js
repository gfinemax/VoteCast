'use client';

import { ArrowLeft, ArrowRight } from 'lucide-react';

export default function VoteProgressFooter({
    currentNavIndex,
    navigableAgendas,
    progressPercent,
    onPrevious,
    onNext
}) {
    return (
        <div className="mt-8 mb-4 border-t border-slate-200 pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-500">
            <div className="flex flex-col sm:flex-row items-center gap-4 text-sm font-medium">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
                    <span className="font-bold border border-slate-300 shadow-sm rounded px-1.5 py-0.5 bg-white text-xs">Space</span>
                    <span>입력 / 확인</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
                    <span className="font-bold border border-slate-300 shadow-sm rounded px-1.5 py-0.5 bg-white text-xs">A</span>
                    <span>자동계산 토글</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
                    <span className="font-bold border border-slate-300 shadow-sm rounded px-1.5 py-0.5 bg-white text-xs">&uarr; &darr;</span>
                    <span>안건 이동</span>
                </div>
                <div className="hidden lg:flex items-center gap-2 ml-2 text-xs text-slate-400">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                    서버 동기화 상태 양호
                </div>
            </div>

            <div className="flex items-center gap-3">
                <button
                    onClick={onPrevious}
                    className="px-5 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-sm"
                >
                    <ArrowLeft size={16} /> 이전 안건
                </button>

                <div className="hidden sm:flex flex-col items-center justify-center px-4 w-40">
                    <div className="text-xs font-bold text-slate-500 mb-1.5">{currentNavIndex + 1} / {navigableAgendas.length} 안건 진행중</div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                </div>

                <button
                    onClick={onNext}
                    className="px-5 py-2.5 bg-slate-800 text-white hover:bg-slate-700 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-sm"
                >
                    다음 안건 <ArrowRight size={16} />
                </button>
            </div>
        </div>
    );
}
