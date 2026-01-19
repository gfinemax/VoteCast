'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';

export default function AlertModal({ isOpen, onClose, title, message }) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
        } else {
            const timer = setTimeout(() => setIsVisible(false), 300); // Wait for fade out
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!isVisible && !isOpen) return null;

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${isOpen ? 'opacity-100 backdrop-blur-sm bg-black/50' : 'opacity-0 pointer-events-none'}`}>
            <div
                className={`w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl transform transition-all duration-300 ${isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}
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
