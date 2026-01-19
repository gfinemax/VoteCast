'use client';

import React, { useState, useEffect } from 'react';
import { Maximize, Minimize } from 'lucide-react';

export default function FullscreenToggle({ className = "", iconOnly = false }) {
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, []);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error enabling full-screen mode: ${err.message}`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    if (iconOnly) {
        return (
            <button
                onClick={toggleFullscreen}
                className={`p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg shadow-sm border border-slate-200 transition-colors ${className}`}
                title="전체화면 (F11)"
            >
                {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
        );
    }

    return (
        <>
            {/* Desktop Button */}
            <button
                onClick={toggleFullscreen}
                className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-all text-xs font-bold shadow-sm border border-slate-200 ${className}`}
                title="전체화면 (F11)"
            >
                {isFullscreen ? (
                    <>
                        <Minimize size={14} />
                        <span>축소</span>
                    </>
                ) : (
                    <>
                        <Maximize size={14} />
                        <span>전체화면</span>
                    </>
                )}
            </button>

            {/* Mobile Button (Icon Only) */}
            <button
                onClick={toggleFullscreen}
                className={`md:hidden p-2 bg-slate-100 text-slate-600 rounded-lg shadow-sm border border-slate-200 ${className}`}
            >
                {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
        </>
    );
}
