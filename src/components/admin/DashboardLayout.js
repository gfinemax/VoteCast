'use client';

import React from 'react';
import { FileText } from 'lucide-react';

export default function DashboardLayout({ title, subtitle, sidebarContent, headerContent, children }) {
    return (
        <div className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden">
            {/* Sidebar */}
            <aside className="w-80 bg-white border-r border-slate-200 flex flex-col shadow-lg z-10">
                <div className="p-6 border-b border-slate-100">
                    <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
                            <FileText size={18} />
                        </div>
                        {title}
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
                </div>
                {sidebarContent}
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Header */}
                <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm shrink-0">
                    <div className="flex items-center gap-4 w-full">
                        {headerContent}
                    </div>
                </header>

                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-5xl mx-auto pb-20">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
}
