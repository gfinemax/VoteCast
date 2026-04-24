'use client';

import { Lock, Unlock } from 'lucide-react';

export default function DecisionConfirmModal({ type, onCancel, onConfirm }) {
    const isConfirm = type === 'confirm';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200">
                <div className="flex items-center gap-3 text-slate-800 mb-4">
                    {isConfirm ? (
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-full">
                            <Lock size={20} />
                        </div>
                    ) : (
                        <div className="p-2 bg-slate-100 text-slate-500 rounded-full">
                            <Unlock size={20} />
                        </div>
                    )}
                    <h3 className="text-xl font-bold">
                        {isConfirm ? '의결 확정 확인' : '확정 취소 확인'}
                    </h3>
                </div>
                <div className="text-slate-600 leading-relaxed mb-8 whitespace-pre-line text-[15px]">
                    {isConfirm
                        ? "현재 기록 상태로 안건 의결 결과를 확정하시겠습니까?\n\n이후 실시간 성원이 변동되어도 결과는 영구 고정됩니다."
                        : "이미 확정된 안건 결과를 취소하시겠습니까?\n\n안건이 다시 실시간 성원 데이터에 연동되어 변동될 수 있습니다."}
                </div>
                <div className="flex justify-end gap-2">
                    <button
                        onClick={onCancel}
                        className="px-5 py-2.5 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold transition-colors disabled:opacity-50"
                    >
                        되돌아가기
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-5 py-2.5 rounded-xl text-white font-semibold shadow-sm transition-all focus:ring-4 ${
                            isConfirm
                                ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-100'
                                : 'bg-slate-700 hover:bg-slate-800 focus:ring-slate-200'
                        }`}
                    >
                        {isConfirm ? '네, 확정합니다' : '네, 취소합니다'}
                    </button>
                </div>
            </div>
        </div>
    );
}
