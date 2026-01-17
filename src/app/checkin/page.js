'use client';

import React, { useState, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { Search, UserCheck, UserX, AlertCircle, Clock, Check, RotateCcw } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

export default function CheckInPage() {
    const { state, actions } = useStore();
    const { members, attendance, activeMeetingId, agendas } = state; // activeMeetingId is Global

    const [searchTerm, setSearchTerm] = useState("");

    // Identify Folders (General Meetings)
    const folders = useMemo(() => agendas.filter(a => a.type === 'folder'), [agendas]);

    // Use Global Active Meeting
    const currentMeeting = useMemo(() => {
        return folders.find(f => f.id === activeMeetingId);
    }, [folders, activeMeetingId]);

    // Filter Stats by Active Meeting
    const stats = useMemo(() => {
        // If no active meeting, stats are 0
        if (!activeMeetingId) return {
            total: state.members.length, // Show total anyway
            checkedIn: 0,
            directCount: 0,
            proxyCount: 0,
            writtenCount: 0,
            rate: 0,
            directTarget: Math.ceil(state.members.length * 0.2),
            majorityTarget: Math.ceil(state.members.length / 2),
            twoThirdsTarget: Math.ceil(state.members.length * (2 / 3)),
            isDirectMet: false,
            isMajorityMet: false,
            isTwoThirdsMet: false
        };

        const currentAttendance = attendance.filter(a => a.meeting_id === activeMeetingId);
        const directCount = currentAttendance.filter(a => a.type === 'direct').length;
        const proxyCount = currentAttendance.filter(a => a.type === 'proxy').length;
        const writtenCount = currentAttendance.filter(a => a.type === 'written').length;
        const checkedInCount = currentAttendance.length;

        // Total Members in DB
        const total = state.members.length;
        const rate = total > 0 ? ((checkedInCount / total) * 100).toFixed(1) : 0;

        // Targets
        const directTarget = Math.ceil(total * 0.2);
        const majorityTarget = Math.ceil(total / 2);
        const twoThirdsTarget = Math.ceil(total * (2 / 3));

        return {
            total,
            checkedIn: checkedInCount,
            directCount,
            proxyCount,
            writtenCount,
            rate,
            directTarget,
            majorityTarget,
            twoThirdsTarget,
            isDirectMet: directCount >= directTarget,
            isMajorityMet: checkedInCount >= majorityTarget,
            isTwoThirdsMet: checkedInCount >= twoThirdsTarget
        };
    }, [attendance, activeMeetingId, members]);

    const filteredMembers = useMemo(() => {
        if (!searchTerm) return members;
        return members.filter(m =>
            m.name.includes(searchTerm) ||
            (m.unit && m.unit.includes(searchTerm)) ||
            (m.proxy && m.proxy.includes(searchTerm))
        );
    }, [members, searchTerm]);


    const handleCheckIn = (memberId, type, proxyName = null) => {
        if (!activeMeetingId) {
            alert("⚠️ 현재 입장 접수 중인 총회가 없습니다.\n관리자에게 문의하세요.");
            return;
        }
        actions.checkInMember(memberId, type, proxyName);
    };

    const handleCancelCheckIn = (memberId) => {
        if (!activeMeetingId) return;
        if (confirm("입장을 취소하시겠습니까?")) {
            actions.cancelCheckInMember(memberId);
        }
    };

    const [isStatsOpen, setIsStatsOpen] = useState(false);

    return (
        <div className="flex flex-col h-screen bg-slate-50 font-sans">
            {/* Sticky Header Group */}
            <header className="sticky top-0 z-30 bg-white shadow-md">
                {/* 1. Top Bar: Title & Simple Toggle */}
                <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100 bg-white z-40 relative">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-bold text-slate-800 tracking-tight">
                                {currentMeeting?.title || '입장 확인'}
                            </h1>
                            {activeMeetingId && (
                                <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-400 leading-none mt-0.5">Admin Control v2.1</p>
                    </div>

                    {/* Collapsible Trigger */}
                    {activeMeetingId && (
                        <button
                            onClick={() => setIsStatsOpen(!isStatsOpen)}
                            className="flex items-center gap-2 pl-3 py-1 border-l border-slate-100"
                        >
                            <div className="text-right">
                                <div className="text-xs font-bold text-slate-600">
                                    <span className="text-emerald-600 text-base">{stats.checkedIn}</span>
                                    <span className="text-slate-300 font-normal mx-0.5">/</span>
                                    {stats.total}
                                </div>
                                <div className="text-[9px] text-slate-400 font-medium">실시간 현황</div>
                            </div>
                            {isStatsOpen ? <RotateCcw className="rotate-180 transition-transform" size={16} /> : <div className="bg-slate-100 p-1 rounded-full"><Clock size={14} className="text-slate-500" /></div>}
                        </button>
                    )}
                </div>

                {/* 2. Expanded Stats (Collapsible) */}
                {activeMeetingId && isStatsOpen && (
                    <div className="bg-slate-50 border-b border-slate-200 p-4 animate-in slide-in-from-top-2 duration-200">
                        <Card className="bg-white shadow-sm border-0 ring-1 ring-slate-200 p-3">
                            <div className="grid grid-cols-3 divide-x divide-slate-100 mb-3 border-b border-slate-100 pb-3">
                                <div className="text-center">
                                    <div className="text-[10px] text-slate-400 mb-0.5">직접(Direct)</div>
                                    <div className="text-lg font-black text-emerald-600 leading-none">{stats.directCount}</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-[10px] text-slate-400 mb-0.5">대리(Proxy)</div>
                                    <div className="text-lg font-black text-blue-600 leading-none">{stats.proxyCount}</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-[10px] text-slate-400 mb-0.5">서면(Written)</div>
                                    <div className="text-lg font-black text-orange-600 leading-none">{stats.writtenCount}</div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {/* Simple Progress Bars */}
                                <div>
                                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                                        <span>성원율 ({stats.rate}%)</span>
                                        <span>과반 {stats.majorityTarget}명</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-blue-400 to-purple-500 transition-all duration-500" style={{ width: `${Math.min(100, (stats.checkedIn / stats.total) * 100)}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                )}

                {/* 3. Search Bar (Sticky) */}
                <div className="p-2 bg-slate-50/90 backdrop-blur-sm border-b border-slate-200">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            className="w-full pl-10 pr-4 py-2.5 rounded-lg border-none ring-1 ring-slate-200 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-base bg-white"
                            placeholder="동호수(101) or 이름 검색"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            disabled={!activeMeetingId}
                        />
                    </div>
                </div>
            </header>

            {/* 4. Main List */}
            <main className="flex-1 overflow-y-auto p-3 space-y-3 pb-20">
                {!activeMeetingId && (
                    <div className="p-8 text-center text-slate-400 flex flex-col items-center opacity-60">
                        <AlertCircle size={48} className="mb-2 opacity-20" />
                        <p>현재 입장 접수 중인 회의가 없습니다.</p>
                    </div>
                )}

                {filteredMembers.map(member => {
                    const record = activeMeetingId ? attendance.find(a => a.member_id === member.id && a.meeting_id === activeMeetingId) : null;
                    const isCheckedIn = !!record;
                    const checkInType = record?.type;
                    const displayProxyName = record?.proxy_name || member.proxy;

                    return (
                        <div key={member.id} className={`rounded-xl border shadow-sm transition-all overflow-hidden ${isCheckedIn
                            ? 'bg-white border-emerald-500 ring-1 ring-emerald-500'
                            : 'bg-white border-slate-200'
                            }`}>

                            <div className="flex flex-row items-stretch min-h-[5rem]">
                                {/* Left: Info Area */}
                                <div className={`flex-1 p-4 flex flex-col justify-center ${isCheckedIn ? 'bg-emerald-50/30' : ''}`}>
                                    <div className="flex items-baseline gap-2">
                                        <span className={`text-2xl font-black tracking-tight ${isCheckedIn ? 'text-emerald-700' : 'text-slate-800'}`}>
                                            {member.unit}
                                        </span>
                                        <span className={`text-base font-semibold ${isCheckedIn ? 'text-emerald-900' : 'text-slate-500'}`}>
                                            {member.name}
                                        </span>
                                    </div>
                                    {/* Proxy Name Info */}
                                    {displayProxyName && (isCheckedIn ? checkInType === 'proxy' : true) && (
                                        <div className="flex items-center gap-1 mt-1 text-slate-500 font-medium">
                                            <span className="text-[10px] bg-slate-100 px-1 py-0.5 rounded text-slate-400">대리</span>
                                            {displayProxyName}
                                        </div>
                                    )}
                                </div>

                                {/* Right: Action Area */}
                                <div className="w-[180px] sm:w-[200px] flex items-center justify-end p-2 border-l border-slate-50 bg-slate-50/50">
                                    {!isCheckedIn ? (
                                        <div className="grid grid-cols-3 gap-1 w-full h-full">
                                            <button
                                                onClick={() => handleCheckIn(member.id, 'direct')}
                                                disabled={!activeMeetingId}
                                                className="flex flex-col items-center justify-center rounded-lg bg-white border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 transition-all active:scale-95 shadow-sm"
                                            >
                                                <span className="text-xs font-bold">본인</span>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const inputName = window.prompt("대리인 성명을 입력해주세요.", member.proxy || "");
                                                    if (inputName !== null && inputName.trim()) handleCheckIn(member.id, 'proxy', inputName.trim());
                                                }}
                                                disabled={!activeMeetingId}
                                                className="flex flex-col items-center justify-center rounded-lg bg-white border border-slate-200 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 text-slate-600 transition-all active:scale-95 shadow-sm"
                                            >
                                                <span className="text-xs font-bold">대리</span>
                                            </button>
                                            <button
                                                onClick={() => handleCheckIn(member.id, 'written')}
                                                disabled={!activeMeetingId}
                                                className="flex flex-col items-center justify-center rounded-lg bg-white border border-slate-200 hover:border-orange-500 hover:bg-orange-50 hover:text-orange-700 text-slate-600 transition-all active:scale-95 shadow-sm"
                                            >
                                                <span className="text-xs font-bold">서면</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex w-full h-full gap-1">
                                            <div className={`flex-1 flex flex-col items-center justify-center rounded-lg border font-bold text-sm ${checkInType === 'proxy' ? 'bg-blue-100 border-blue-200 text-blue-700' :
                                                    checkInType === 'written' ? 'bg-orange-100 border-orange-200 text-orange-700' :
                                                        'bg-emerald-100 border-emerald-200 text-emerald-700'
                                                }`}>
                                                {checkInType === 'proxy' ? '대리' : checkInType === 'written' ? '서면' : '본인'}
                                                <span className="text-[10px] font-normal opacity-70">입장완료</span>
                                            </div>
                                            <button
                                                onClick={() => handleCancelCheckIn(member.id)}
                                                className="w-10 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 transition-all"
                                            >
                                                <RotateCcw size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </main>
        </div>
    );
}
