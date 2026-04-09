'use client';

import React from 'react';
import { AlertCircle, X } from 'lucide-react';

export default function AlertModal({ isOpen, onClose, title, message }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div
                className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
                role="alertdialog"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                    <div className="flex items-center gap-3 text-amber-500">
                        <AlertCircle size={24} />
                        <h3 className="font-bold text-lg text-white">{title || '알림'}</h3>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                        {message}
                    </p>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-950/50 rounded-b-2xl flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-xl transition-all border border-slate-700 hover:border-slate-600 shadow-lg active:scale-95"
                    >
                        확인
                    </button>
                </div>
            </div>
        </div>
    );
}
