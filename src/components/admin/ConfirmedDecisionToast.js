'use client';

import { Lock, X } from 'lucide-react';

export default function ConfirmedDecisionToast({ onDismiss }) {
    return (
        <div className="pointer-events-none fixed right-4 top-24 z-40">
            <div className="pointer-events-auto flex max-w-[min(92vw,560px)] items-start gap-3 rounded-2xl border border-blue-200 bg-white/95 px-4 py-3 text-blue-700 shadow-[0_20px_50px_-20px_rgba(37,99,235,0.45)] backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="mt-0.5 rounded-full bg-blue-50 p-2 text-blue-600">
                    <Lock size={16} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="text-sm font-black">현재 의결 결과가 확정되었습니다.</div>
                    <div className="mt-0.5 text-xs font-semibold text-blue-600/80">실시간 성원 변동의 영향을 받지 않습니다.</div>
                </div>
                <button
                    type="button"
                    onClick={onDismiss}
                    className="rounded-lg p-1 text-blue-400 transition-colors hover:bg-blue-50 hover:text-blue-700"
                    aria-label="확정 안내 닫기"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
}
