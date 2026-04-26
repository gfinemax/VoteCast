'use client';

import { CheckCircle2, Save, Trash2 } from 'lucide-react';

const VARIANT_STYLES = {
    dark: {
        applyDisabled: 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50',
        applyEnabled: 'bg-blue-600 hover:bg-blue-700 animate-pulse',
        applySpacing: 'mr-2',
        autoOff: 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-white',
        reset: 'text-slate-400 hover:bg-rose-950 hover:text-rose-400'
    },
    light: {
        applyDisabled: 'bg-slate-200 text-slate-400 cursor-not-allowed',
        applyEnabled: 'bg-blue-600 hover:bg-blue-700 animate-pulse',
        applySpacing: '',
        autoOff: 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100',
        reset: 'text-slate-500 hover:bg-red-50 hover:text-red-600'
    }
};

export default function VoteActionBar({
    variant = 'light',
    isLocalDirty,
    isApplyDisabled,
    isConfirmed,
    isAutoCalc,
    onApply,
    onToggleAutoCalc,
    onReset
}) {
    const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.light;

    return (
        <>
            {isLocalDirty && (
                <button
                    onClick={onApply}
                    disabled={isApplyDisabled}
                    className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg text-white shadow-md transition-all ${styles.applySpacing} ${
                        isApplyDisabled ? styles.applyDisabled : styles.applyEnabled
                    }`}
                >
                    <Save size={14} /> 입력 완료 (선포문구 반영)
                </button>
            )}
            {!isConfirmed && (
                <button
                    onClick={() => onToggleAutoCalc(!isAutoCalc)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        isAutoCalc
                            ? 'bg-blue-600 text-white shadow-md'
                            : styles.autoOff
                    }`}
                >
                    <CheckCircle2 size={14} className={isAutoCalc ? 'opacity-100' : 'opacity-0 hidden'} />
                    자동계산 {isAutoCalc ? 'ON' : 'OFF'}
                </button>
            )}
        </>
    );
}
