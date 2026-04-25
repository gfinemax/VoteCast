'use client';

import { AlertCircle, AlertTriangle, CheckCircle2, Lock, Unlock } from 'lucide-react';

export default function FinalConfirmationPanel({
    isConfirmed,
    isReadyToConfirm,
    isLocalDirty,
    isVoteCountValid,
    voteCountStatusText,
    displayTotalVotesCast,
    effectiveTotalAttendance,
    hasElectionValidationIssue,
    canConfirmDecision,
    onReadyChange,
    onResetDecision,
    onConfirmDecision
}) {
    return (
        <section className="flex flex-col flex-1">
            <div className="flex justify-between items-center mb-1 mt-1">
                <h3 className="text-base font-bold text-slate-600 uppercase tracking-wider">
                    04. 최종 결과 확정
                </h3>
            </div>
            <div className="flex flex-col items-center justify-center p-3 bg-slate-50 border border-slate-200 rounded-2xl shadow-sm flex-1">
                <p className="text-slate-500 mb-2 text-center text-sm">
                    모든 출석율과 투표 인원이 오류 없이 정상적으로 표기되었는지 확인해 주세요.
                </p>

                {isConfirmed ? (
                    <div className="flex flex-col items-center gap-3">
                        <div className="flex items-center gap-2 text-blue-700 font-bold bg-blue-50/50 border border-blue-100 px-5 py-2.5 rounded-xl shadow-sm">
                            <CheckCircle2 size={24} />
                            현재 안건의 의결 결과가 안전하게 확정되어 잠겼습니다.
                        </div>
                        <button
                            onClick={onResetDecision}
                            className="mt-1 flex items-center gap-2 text-slate-500 bg-white border border-slate-200 px-5 py-2 rounded-xl hover:bg-slate-100 transition-all font-semibold"
                        >
                            <Unlock size={18} />
                            확정 취소 및 수정하기
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2.5 w-full max-w-sm">
                        <label className="flex items-center justify-center gap-3 w-full px-4 py-3 border border-slate-200 rounded-xl bg-white cursor-pointer hover:bg-slate-50 select-none shadow-sm transition-all focus-within:ring-2 focus-within:ring-slate-200">
                            <input
                                type="checkbox"
                                className="w-5 h-5 accent-blue-600 cursor-pointer rounded"
                                checked={isReadyToConfirm}
                                disabled={isLocalDirty}
                                onChange={(event) => onReadyChange(event.target.checked)}
                            />
                            <span className="font-semibold text-slate-700">모든 결과를 확인하였으며, 확정합니다.</span>
                        </label>
                        {isLocalDirty && (
                            <div className="w-full rounded-xl border border-amber-300 bg-amber-50/80 px-4 py-2.5 text-center text-sm font-bold text-amber-800 shadow-sm animate-pulse">
                                <div className="flex items-center justify-center gap-2 mb-1">
                                    <AlertTriangle size={18} className="text-amber-600" />
                                    <span>현장 투표 입력값 미반영</span>
                                </div>
                                <p className="text-xs font-semibold leading-relaxed">
                                    위의 <span className="text-blue-700 underline underline-offset-2">[입력 완료 (선포문구 반영)]</span> 버튼을 반드시 눌러야 선포 문구에 숫자가 기록되고 확정이 가능해집니다.
                                </p>
                            </div>
                        )}
                        {!isLocalDirty && !isVoteCountValid && (
                            <div className="w-full rounded-xl border border-rose-300 bg-rose-50/80 px-4 py-3 text-center text-sm font-bold text-rose-800 shadow-sm">
                                <div className="flex items-center justify-center gap-2 mb-1">
                                    <AlertCircle size={18} className="text-rose-600" />
                                    <span>투표수 합계 불일치 ({voteCountStatusText})</span>
                                </div>
                                <p className="text-xs font-semibold leading-relaxed">
                                    총 투표수({displayTotalVotesCast}표)가 성원 인원({effectiveTotalAttendance}명)과 일치해야 확정할 수 있습니다. <br />
                                    입력칸의 숫자를 조정한 후 다시 [입력 완료]를 눌러주세요.
                                </p>
                            </div>
                        )}
                        {!isLocalDirty && hasElectionValidationIssue && isVoteCountValid && (
                            <div className="w-full rounded-xl border border-amber-300 bg-amber-50/80 px-4 py-3 text-center text-sm font-bold text-amber-800 shadow-sm">
                                <div className="flex items-center justify-center gap-2 mb-1">
                                    <AlertTriangle size={18} className="text-amber-600" />
                                    <span>선거 검증 항목 확인 필요</span>
                                </div>
                                <p className="text-xs font-semibold leading-relaxed">
                                    상단의 선거 안건 검증 경고 내용을 확인해 주세요. <br />
                                    (중복 인원 정리 또는 우편투표 누락분 처리 필요)
                                </p>
                            </div>
                        )}
                        <button
                            onClick={onConfirmDecision}
                            disabled={!canConfirmDecision}
                            className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl transition-all font-bold text-xl ${
                                canConfirmDecision
                                    ? 'bg-blue-600 border border-blue-700 text-white hover:bg-blue-700 hover:shadow-lg shadow-md'
                                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none opacity-80'
                            }`}
                        >
                            <Lock size={18} className={canConfirmDecision ? 'text-white/90' : 'opacity-50'} />
                            안건 결과 최종 확정
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}
