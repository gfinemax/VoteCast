'use client';

import React, { useSyncExternalStore } from 'react';
import { FileText, ChevronLeft, ChevronRight } from 'lucide-react';

const SIDEBAR_COLLAPSED_KEY = 'votecast_sidebar_collapsed';
const SIDEBAR_COLLAPSED_EVENT = 'votecast_sidebar_collapsed_change';

const getSidebarCollapsedSnapshot = () => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
};

const subscribeSidebarCollapsed = (callback) => {
    if (typeof window === 'undefined') return () => {};

    window.addEventListener('storage', callback);
    window.addEventListener(SIDEBAR_COLLAPSED_EVENT, callback);

    return () => {
        window.removeEventListener('storage', callback);
        window.removeEventListener(SIDEBAR_COLLAPSED_EVENT, callback);
    };
};

export default function DashboardLayout({ title, subtitle, titleBadge, sidebarContent, sidebarFooter, headerContent, fixedTopContent, children }) {
    const isCollapsed = useSyncExternalStore(
        subscribeSidebarCollapsed,
        getSidebarCollapsedSnapshot,
        () => false
    );

    const toggleSidebar = () => {
        const newValue = !isCollapsed;
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, newValue.toString());
        window.dispatchEvent(new Event(SIDEBAR_COLLAPSED_EVENT));
    };

    return (
        <div
            className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden relative"
            style={{ '--votecast-sidebar-width': isCollapsed ? '0px' : '20rem' }}
        >
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
                        <div className="flex items-start justify-between">
                            <div>
                                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                    <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
                                        <FileText size={18} />
                                    </div>
                                    {title}
                                </h1>
                                <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
                            </div>
                            {titleBadge && (
                                <div className="mt-1">
                                    {titleBadge}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Scrollable Sidebar Content */}
                    <div className="flex-1 overflow-y-auto">
                        {sidebarContent}
                    </div>

                    {/* Sticky Sidebar Footer */}
                    {sidebarFooter && (
                        <div className="shrink-0 z-20 relative">
                            {sidebarFooter}
                        </div>
                    )}
                </div>
            </aside>

            {/* Floating Toggle Button */}
            <button
                onClick={toggleSidebar}
                className="absolute z-30 flex flex-col items-center justify-center gap-1.5 w-7 h-28 py-2 bg-lime-400 hover:bg-lime-500 shadow-lg drop-shadow-md rounded-r-lg transition-all duration-300 ease-in-out text-slate-900 font-extrabold tracking-widest text-[9px] focus:outline-none border-y border-r border-lime-500 border-b-[3px] border-b-lime-600"
                style={{
                    top: '50vh',
                    transform: 'translateY(-50%)',
                    left: isCollapsed ? '0px' : '320px', // 320px = w-80
                }}
                title={isCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
            >
                {isCollapsed ? (
                    <>
                        <ChevronRight size={14} strokeWidth={3} />
                        <span className="leading-none" style={{ writingMode: 'vertical-rl' }}>SIDEBAR</span>
                    </>
                ) : (
                    <>
                        <span className="leading-none" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>WIDE</span>
                        <ChevronLeft size={14} strokeWidth={3} />
                    </>
                )}
            </button>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Header */}
                <header className="h-16 bg-white border-b border-slate-200 shrink-0 z-20 px-4">
                    <div className="flex items-center gap-4 w-full h-full max-w-[1280px] mx-auto">
                        {headerContent}
                    </div>
                </header>

                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto w-full">
                    {/* Fixed Top Content as Sticky (Matches scroll context width) */}
                    {fixedTopContent && (
                        <div className="sticky top-0 z-20 px-4 pt-4 pb-0 w-full relative pointer-events-none">
                            <div className="max-w-[1280px] mx-auto relative">
                                {/* Seamless masking to hide scrolling text ONLY in the top 16px gap */}
                                <div className="absolute top-0 left-0 right-0 h-4 bg-slate-50"></div>
                                <div className="w-full relative pointer-events-auto drop-shadow-xl rounded-xl">
                                    {fixedTopContent}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="px-4 pt-2 pb-2">
                        <div className="max-w-[1280px] mx-auto w-full pb-4">
                            {children}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
