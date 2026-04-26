'use client';

import React, { useState, useEffect } from 'react';
import { FileText, ChevronLeft, ChevronRight } from 'lucide-react';

export default function DashboardLayout({ title, subtitle, sidebarContent, sidebarFooter, headerContent, fixedTopContent, children }) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    // 컴포넌트 마운트 시, 저장된 사이드바 상태를 불러옵니다.
    useEffect(() => {
        setIsMounted(true);
        const storedValue = localStorage.getItem('votecast_sidebar_collapsed');
        if (storedValue === 'true') {
            setIsCollapsed(true);
        }
    }, []);

    const toggleSidebar = () => {
        const newValue = !isCollapsed;
        setIsCollapsed(newValue);
        localStorage.setItem('votecast_sidebar_collapsed', newValue.toString());
    };

    return (
        <div className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden relative">
            {/* Sidebar */}
            <aside 
                className={`bg-white border-r border-slate-200 flex flex-col shadow-lg z-10 shrink-0 transition-all duration-300 ease-in-out ${
                    isCollapsed ? 'w-0 overflow-hidden' : 'w-80'
                }`}
            >
                {/* 
                  컨텐츠의 너비를 20rem(w-80)으로 고정해주어야, 
                  aside 래퍼의 폭이 0으로 줄어들 때 내부 글자가 찌그러지지 않고 부드럽게 가려집니다.
                */}
                <div className="w-80 flex flex-col h-full">
                    <div className="p-6 border-b border-slate-100 shrink-0">
                        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
                                <FileText size={18} />
                            </div>
                            {title}
                        </h1>
                        <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
                    </div>

                    {/* Scrollable Sidebar Content */}
                    <div className="flex-1 overflow-y-auto">
                        {sidebarContent}
                    </div>

                    {/* Sticky Sidebar Footer */}
                    {sidebarFooter && (
                        <div className="shrink-0 z-20">
                            {sidebarFooter}
                        </div>
                    )}
                </div>
            </aside>

            {/* Floating Toggle Button */}
            {isMounted && (
                <button
                    onClick={toggleSidebar}
                    className="absolute z-30 flex items-center justify-center gap-1 h-14 px-2.5 bg-lime-400 hover:bg-lime-500 shadow-md shadow-lime-500/30 rounded-r-xl transition-all duration-300 ease-in-out text-slate-900 font-extrabold tracking-wider text-[10px] focus:outline-none border border-l-0 border-lime-500"
                    style={{
                        top: '50vh',
                        transform: 'translateY(-50%)',
                        left: isCollapsed ? '0px' : '320px', // 320px = w-80
                    }}
                    title={isCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
                >
                    {isCollapsed ? (
                        <>
                            <ChevronRight size={16} strokeWidth={3} />
                            <span className="pr-0.5">SIDEBAR</span>
                        </>
                    ) : (
                        <>
                            <span className="pl-0.5">WIDE</span>
                            <ChevronLeft size={16} strokeWidth={3} />
                        </>
                    )}
                </button>
            )}

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Header */}
                <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 shadow-sm shrink-0 z-20">
                    <div className="flex items-center gap-4 w-full">
                        {headerContent}
                    </div>
                </header>

                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto w-full">
                    {/* Fixed Top Content as Sticky (Matches scroll context width) */}
                    {fixedTopContent && (
                        <div className="sticky top-0 z-20 px-4 pt-4 pb-0 w-full relative pointer-events-none">
                            {/* Seamless masking to hide scrolling text ONLY in the top 16px gap */}
                            <div className="absolute top-0 left-0 right-0 h-4 bg-slate-50"></div>
                            <div className="w-full relative pointer-events-auto drop-shadow-xl rounded-xl">
                                {fixedTopContent}
                            </div>
                        </div>
                    )}

                    <div className="px-4 pt-2 pb-2">
                        <div className="w-full pb-4">
                            {children}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
