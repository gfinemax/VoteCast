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

    return (
        <div className="flex flex-col h-screen bg-slate-100 font-sans">
            {/* 1. Header & Active Meeting Banner */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
                <div className="max-w-4xl mx-auto px-4 py-3">
                    <div className="flex justify-between items-center mb-2">
                        <h1 className="text-xl font-bold text-slate-800">입장 확인 (Check-in)</h1>
                        <span className="text-xs text-slate-400">v2.1 (Admin Control)</span>
                    </div>

                    {/* Active Meeting Banner */}
                    <div className={`p-3 rounded-lg border flex items-center justify-center gap-2 mb-2 shadow-sm transition-colors ${currentMeeting
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : "bg-red-50 border-red-200 text-red-800"
                        }`}>
                        {currentMeeting ? (
                            <>
                                <span className="relative flex h-3 w-3 mr-1">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                </span>
                                <span className="font-bold text-lg">{currentMeeting.title}</span>
                                <span className="text-sm font-normal opacity-80 ml-1">입장 접수 중...</span>
                            </>
                        ) : (
                            <>
                                <AlertCircle size={20} />
                                <span className="font-bold">현재 진행 중인 입장이 없습니다.</span>
                                <span className="text-sm opacity-80">(관리자 통제 대기)</span>
                            </>
                        )}
                    </div>

                    {/* Stats Dashboard */}
                    {activeMeetingId && (
                        <Card className="bg-white overflow-hidden shadow-md border-0 ring-1 ring-slate-200">
                            {/* 1. Top Row: Global Stats */}
                            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50/50">
                                <div>
                                    <h1 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                                        <UserCheck size={12} className="text-emerald-500" /> 실시간 집계
                                    </h1>
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-xl font-black text-slate-800">{stats.checkedIn}</span>
                                    <span className="text-[10px] text-slate-400 font-medium">/ {stats.total}명</span>
                                    <span className="text-[10px] font-bold text-emerald-600 ml-1">
                                        ({stats.rate}%)
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
                                <div className="py-1.5 text-center bg-emerald-50/30">
                                    <div className="text-[10px] uppercase font-bold text-emerald-600">직접 (Direct)</div>
                                    <div className="text-base font-bold text-emerald-700 leading-none">{stats.directCount}</div>
                                </div>
                                <div className="py-1.5 text-center bg-blue-50/30">
                                    <div className="text-[10px] uppercase font-bold text-blue-600">대리 (Proxy)</div>
                                    <div className="text-base font-bold text-blue-700 leading-none">{stats.proxyCount}</div>
                                </div>
                                <div className="py-1.5 text-center bg-orange-50/30">
                                    <div className="text-[10px] uppercase font-bold text-orange-600">서면 (Written)</div>
                                    <div className="text-base font-bold text-orange-700 leading-none">{stats.writtenCount}</div>
                                </div>
                            </div>

                            {/* 3. Bottom Row: Progress Bars */}
                            <div className="px-3 py-2 space-y-2 bg-white">
                                {/* Bar 1: Direct Attendance (20%) */}
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center text-[10px] font-bold">
                                        <span className="text-slate-500 flex items-center gap-1">
                                            직접참석 (20%)
                                            {stats.isDirectMet ? (
                                                <span className="bg-emerald-100 text-emerald-600 px-1 rounded-[2px]">충족 OK</span>
                                            ) : (
                                                <span className="text-slate-300 font-normal">{stats.directTarget}명 목표</span>
                                            )}
                                        </span>
                                        <span className={stats.isDirectMet ? "text-emerald-600" : "text-slate-400"}>
                                            {stats.directCount}/{stats.directTarget}
                                        </span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-500 ${stats.isDirectMet ? 'bg-emerald-500' : 'bg-slate-400'}`}
                                            style={{ width: `${Math.min(100, (stats.directCount / stats.directTarget) * 100)}%` }}
                                        ></div>
                                    </div>
                                </div>

                                {/* Bar 2: Total Quorum (Majority / 2/3) */}
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center text-[10px] font-bold">
                                        <span className="text-slate-500">전체 성원율</span>
                                        <div className="flex gap-2">
                                            <span className={stats.isMajorityMet ? "text-blue-600" : "text-slate-300"}>과반 {stats.majorityTarget}</span>
                                            <span className="text-slate-200">|</span>
                                            <span className={stats.isTwoThirdsMet ? "text-purple-600" : "text-slate-300"}>2/3 {stats.twoThirdsTarget}</span>
                                        </div>
                                    </div>
                                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden relative">
                                        {/* Markers */}
                                        <div className="absolute top-0 bottom-0 w-[1px] bg-slate-300 z-10" style={{ left: '50%' }}></div>
                                        <div className="absolute top-0 bottom-0 w-[1px] bg-slate-300 z-10" style={{ left: '66.66%' }}></div>

                                        {/* Fill */}
                                        <div
                                            className="h-full bg-gradient-to-r from-blue-400 to-purple-500 transition-all duration-500"
                                            style={{ width: `${Math.min(100, (stats.checkedIn / stats.total) * 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}
                </div>
            </header>

            {/* 2. Search & List */}
            <main className="flex-1 overflow-hidden flex flex-col max-w-4xl mx-auto w-full px-4 pt-4 pb-20">
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-lg"
                        placeholder="동호수(101-101) 또는 성명 검색..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        disabled={!activeMeetingId}
                    />
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pb-10">
                    {filteredMembers.map(member => {
                        // Check if checked in FOR THE ACTIVE MEETING
                        const record = activeMeetingId ? attendance.find(a => a.member_id === member.id && a.meeting_id === activeMeetingId) : null;
                        const isCheckedIn = !!record;
                        const checkInType = record?.type;
                        const displayProxyName = record?.proxy_name || member.proxy;

                        return (
                            <div key={member.id} className={`p-4 rounded-xl border transition-all ${isCheckedIn
                                ? 'bg-emerald-50 border-emerald-200'
                                : 'bg-white border-slate-200 hover:border-blue-300'
                                }`}>
                                <div className="flex justify-between items-start">
                                    {/* Member Info */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-lg font-bold ${isCheckedIn ? 'text-emerald-800' : 'text-slate-800'}`}>
                                                {member.unit}
                                            </span>
                                            {isCheckedIn && (
                                                <div className={`text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1 ${checkInType === 'proxy' ? 'bg-blue-100 text-blue-600' :
                                                    checkInType === 'written' ? 'bg-orange-100 text-orange-600' :
                                                        'bg-emerald-100 text-emerald-600'
                                                    }`}>
                                                    <Clock size={10} /> {
                                                        checkInType === 'proxy' ? '대리' :
                                                            checkInType === 'written' ? '서면' :
                                                                '직접'
                                                    }
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-slate-600 font-medium">
                                            {member.name}
                                            {displayProxyName && (isCheckedIn ? checkInType === 'proxy' : true) && <span className="text-slate-600 ml-1">({displayProxyName})</span>}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        {!isCheckedIn ? (
                                            <>
                                                <button
                                                    onClick={() => handleCheckIn(member.id, 'direct')}
                                                    disabled={!activeMeetingId}
                                                    className="flex flex-col items-center justify-center w-14 h-14 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                                                >
                                                    <UserCheck size={20} className="mb-0.5" />
                                                    <span className="text-[10px] font-bold leading-none">본인</span>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const inputName = window.prompt("대리인 성명을 입력해주세요.", member.proxy || "");
                                                        if (inputName !== null) {
                                                            const finalName = inputName.trim();
                                                            if (finalName) {
                                                                handleCheckIn(member.id, 'proxy', finalName);
                                                            } else {
                                                                alert("대리인 성명을 입력해야 합니다.");
                                                            }
                                                        }
                                                    }}
                                                    disabled={!activeMeetingId}
                                                    className="flex flex-col items-center justify-center w-14 h-14 rounded-lg bg-blue-500 hover:bg-blue-600 text-white shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                                                >
                                                    <UserCheck size={20} className="mb-0.5" />
                                                    <span className="text-[10px] font-bold leading-none">대리</span>
                                                </button>
                                                <button
                                                    onClick={() => handleCheckIn(member.id, 'written')}
                                                    disabled={!activeMeetingId}
                                                    className="flex flex-col items-center justify-center w-14 h-14 rounded-lg bg-orange-400 hover:bg-orange-500 text-white shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                                                >
                                                    <UserCheck size={20} className="mb-0.5" />
                                                    <span className="text-[10px] font-bold leading-none">서면</span>
                                                </button>
                                            </>
                                        ) : (
                                            <div className="flex gap-0.5 shrink-0">
                                                <Button variant="secondary" disabled className={`text-xs px-2 py-1.5 font-black h-14 w-20 flex flex-col items-center justify-center gap-1 disabled:opacity-100 ${checkInType === 'proxy'
                                                    ? 'text-blue-800 bg-blue-50 border-blue-100'
                                                    : checkInType === 'written'
                                                        ? 'text-orange-800 bg-orange-50 border-orange-100'
                                                        : 'text-emerald-800 bg-emerald-50 border-emerald-100'
                                                    }`}>
                                                    <Check size={16} />
                                                    <span className="leading-none">{
                                                        checkInType === 'written' ? '서면제출' :
                                                            checkInType === 'proxy' ? '대리입장' :
                                                                '입장완료'
                                                    }</span>
                                                </Button>
                                                <button
                                                    onClick={() => handleCancelCheckIn(member.id)}
                                                    className="flex flex-col items-center justify-center w-10 h-14 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-red-500 border border-slate-200 transition-all"
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
                </div>
            </main>
        </div>
    );
}
