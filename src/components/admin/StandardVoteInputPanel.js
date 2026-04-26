'use client';

import { AlertTriangle, CheckCircle2, Wand2, ShieldAlert } from 'lucide-react';
import VoteActionBar from '@/components/admin/VoteActionBar';
import VoteNumericInput from '@/components/admin/VoteNumericInput';

export default function StandardVoteInputPanel({
    displayTotalVotesCast,
    effectiveTotalAttendance,
    isVoteCountValid,
    voteCountStatusText,
    isLocalDirty,
    isApplyDisabled,
    isConfirmed,
    isAutoCalc,
    localVotes,
    onApply,
    onToggleAutoCalc,
    onReset,
    onAutoSum,
    onLocalVoteChange,
    isQuorumLocked = false
}) {
    const isInputDisabled = isConfirmed || isQuorumLocked;

    return (
        <div className="space-y-3">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-6 divide-x divide-slate-200">
                    <div className="flex flex-col">
                        <span className="text-xs font-semibold text-slate-400 mb-1">총 투표수</span>
                        <span className="text-2xl font-black text-blue-700">{displayTotalVotesCast}<span className="text-sm font-normal ml-1">표</span></span>
                    </div>
                    <div className="flex flex-col pl-6">
                        <span className="text-xs font-semibold text-slate-400 mb-1">성원(참석자)</span>
                        <span className="text-xl font-bold text-slate-700">{effectiveTotalAttendance}<span className="text-sm font-normal ml-1">명</span></span>
                    </div>
                </div>
                
                {isQuorumLocked ? (
                    <div className="flex flex-col items-center justify-center p-3 rounded-xl border-2 border-amber-200 bg-amber-50 text-amber-700 w-full md:w-auto md:min-w-[140px]">
                        <ShieldAlert size={24} className="mb-1 text-amber-500" />
                        <span className="text-sm font-bold">성원 미달 (입력 잠금)</span>
                    </div>
                ) : (
                    <div className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 w-full md:w-auto md:min-w-[140px] transition-colors ${
                        isVoteCountValid
                            ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                            : 'bg-red-50 border-red-100 text-red-600 animate-pulse'
                    }`}>
                        {isVoteCountValid ? (
                            <>
                                <CheckCircle2 size={24} className="mb-1 text-emerald-500" />
                                <span className="text-sm font-bold">결과 일치 (검증됨)</span>
                            </>
                        ) : (
                            <>
                                <AlertTriangle size={24} className="mb-1" />
                                <span className="text-sm font-bold">{voteCountStatusText}</span>
                            </>
                        )}
                    </div>
                )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm relative overflow-hidden">
                <div className="mb-3 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-100 pb-3">
                    <div className="flex flex-col">
                        <div className="text-lg font-black text-slate-800">투표 결과 직접 입력</div>
                        {isQuorumLocked && (
                            <div className="text-[11px] font-bold text-amber-600 flex items-center gap-1 mt-0.5">
                                <ShieldAlert size={12} /> 성원이 충족되어야 입력이 가능합니다
                            </div>
                        )}
                    </div>
                    
                    {!isQuorumLocked && (
                        <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                            <VoteActionBar
                                variant="light"
                                isLocalDirty={isLocalDirty}
                                isApplyDisabled={isApplyDisabled}
                                isConfirmed={isConfirmed}
                                isAutoCalc={isAutoCalc}
                                onApply={onApply}
                                onToggleAutoCalc={onToggleAutoCalc}
                                onReset={onReset}
                            />
                        </div>
                    )}
                </div>

                <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 transition-opacity ${isQuorumLocked ? 'opacity-40 select-none' : ''}`}>
                    <div className="flex flex-col gap-2 relative bg-emerald-50/50 p-4 border border-emerald-100 rounded-2xl transition-colors hover:bg-emerald-50">
                        <label className="text-base font-bold text-emerald-800 flex justify-between items-center w-full">
                            <span>찬성</span>
                            {!isInputDisabled && (
                                <button
                                    onClick={onAutoSum}
                                    title="참석자 수에 맞춰 잔여 표 자동 입력"
                                    className="flex items-center gap-1 bg-white border border-emerald-200 px-2 py-1 hover:bg-emerald-100 rounded-lg text-emerald-700 transition-colors text-xs shadow-sm"
                                >
                                    <Wand2 size={12} /> 잔여표 채우기
                                </button>
                            )}
                        </label>
                        <VoteNumericInput
                            value={localVotes.yes}
                            placeholder="0"
                            onChange={(value) => onLocalVoteChange('yes', value)}
                            disabled={isInputDisabled}
                            className="w-full p-2 border-2 border-emerald-200 rounded-xl text-center text-3xl font-black text-emerald-800 bg-white shadow-inner outline-none caret-emerald-700 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-100 disabled:text-slate-500 transition-all"
                        />
                    </div>
                    <div className="flex flex-col gap-2 bg-red-50/50 p-4 border border-red-100 rounded-2xl transition-colors hover:bg-red-50">
                        <label className="text-base font-bold text-red-800">반대</label>
                        <VoteNumericInput
                            value={localVotes.no}
                            placeholder="0"
                            onChange={(value) => onLocalVoteChange('no', value)}
                            disabled={isInputDisabled}
                            className="w-full p-2 border-2 border-red-200 rounded-xl text-center text-3xl font-black text-red-800 bg-white shadow-inner outline-none caret-red-700 focus:border-red-500 focus:ring-4 focus:ring-red-100 disabled:bg-slate-100 disabled:text-slate-500 transition-all"
                        />
                    </div>
                    <div className="flex flex-col gap-2 bg-slate-50/50 p-4 border border-slate-200 rounded-2xl transition-colors hover:bg-slate-50">
                        <label className="text-base font-bold text-slate-600">기권/무효</label>
                        <VoteNumericInput
                            value={localVotes.abstain}
                            placeholder="0"
                            onChange={(value) => onLocalVoteChange('abstain', value)}
                            disabled={isInputDisabled}
                            className="w-full p-2 border-2 border-slate-200 rounded-xl text-center text-3xl font-black text-slate-600 bg-white shadow-inner outline-none caret-slate-600 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 disabled:bg-slate-100 disabled:text-slate-400 transition-all"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
