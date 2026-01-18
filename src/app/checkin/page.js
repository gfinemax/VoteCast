'use client';

import React, { useState, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { Search, UserCheck, UserX, AlertCircle, Clock, Check, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

export default function CheckInPage() {
    const { state, actions } = useStore();
    const { members, attendance, activeMeetingId, agendas } = state; // activeMeetingId is Global

    const [searchTerm, setSearchTerm] = useState("");
    const [isStatsOpen, setIsStatsOpen] = useState(false);

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

    // Proxy Modal State
    const [isProxyModalOpen, setIsProxyModalOpen] = useState(false);
    const [proxyMemberId, setProxyMemberId] = useState(null);
    const [proxyNameInput, setProxyNameInput] = useState("");

    const handleOpenProxyModal = (member) => {
        setProxyMemberId(member.id);
        setProxyNameInput(member.proxy || ""); // Pre-fill if exists
        setIsProxyModalOpen(true);
    };

    const handleConfirmProxy = () => {
        if (proxyMemberId && proxyNameInput.trim()) {
            handleCheckIn(proxyMemberId, 'proxy', proxyNameInput.trim());
            setIsProxyModalOpen(false);
            setProxyNameInput("");
            setProxyMemberId(null);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-slate-100 font-sans">
            {/* 1. Header & Active Meeting Banner (Compact) */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
                <div className="max-w-4xl mx-auto">
                    {/* Top Bar: Title + Status */}
                    <div className="flex justify-between items-center px-4 py-2 bg-slate-50 border-b border-slate-100">
                        <h1 className="text-lg font-bold text-slate-800">입장 확인</h1>
                        {currentMeeting ? (
                            <div className="flex items-center gap-1.5">
                                <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                </span>
                                <span className="text-xs font-bold text-emerald-700 truncate max-w-[150px]">{currentMeeting.title}</span>
                            </div>
                        ) : (
                            <span className="text-xs font-bold text-red-500 flex items-center gap-1"><AlertCircle size={12} /> 입장 중단됨</span>
                        )}
                    </div>

                    {/* Compact Stats Bar (Always Visible) */}
                    {activeMeetingId && (
                        <div className="px-4 py-2 bg-white">
                            <div className="flex items-center justify-between" onClick={() => setIsStatsOpen(!isStatsOpen)}>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-black text-slate-800 tracking-tight">{stats.checkedIn}</span>
                                    <span className="text-sm text-slate-500 font-bold">/ {stats.total}명 <span className="text-emerald-600">({stats.rate}%)</span></span>
                                </div>
                                <button className="text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all px-3 py-1.5 rounded-full flex items-center gap-1 shadow-md">
                                    {isStatsOpen ? (
                                        <>접기 <ChevronUp size={14} /></>
                                    ) : (
                                        <>상세 통계 <ChevronDown size={14} /></>
                                    )}
                                </button>
                            </div>

                            {/* Collapsible Detail Stats */}
                            {isStatsOpen && (
                                <div className="mt-4 space-y-5 border-t border-slate-100 pt-4 animate-in slide-in-from-top-2 duration-200">
                                    <div className="grid grid-cols-3 gap-3 text-center">
                                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                                            <div className="text-sm text-emerald-700 font-bold mb-1">직접</div>
                                            <div className="text-3xl font-black text-emerald-800 leading-none">{stats.directCount}</div>
                                        </div>
                                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                                            <div className="text-sm text-blue-700 font-bold mb-1">대리</div>
                                            <div className="text-3xl font-black text-blue-800 leading-none">{stats.proxyCount}</div>
                                        </div>
                                        <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
                                            <div className="text-sm text-orange-700 font-bold mb-1">서면</div>
                                            <div className="text-3xl font-black text-orange-800 leading-none">{stats.writtenCount}</div>
                                        </div>
                                    </div>

                                    {/* Progress Bars (Target) */}
                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between text-sm font-bold text-slate-700">
                                                <span>직접참석 <span className="text-xs font-medium text-slate-500">({stats.directTarget}명 목표)</span></span>
                                                <span className={stats.isDirectMet ? "text-emerald-600" : ""}>{stats.directCount}/{stats.directTarget}</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div className={`h-full ${stats.isDirectMet ? 'bg-emerald-500' : 'bg-slate-300'}`} style={{ width: `${Math.min(100, (stats.directCount / stats.directTarget) * 100)}%` }}></div>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between text-sm font-bold text-slate-700">
                                                <span>전체 성원 <span className="text-xs font-medium text-slate-500">(과반 {stats.majorityTarget})</span></span>
                                                <span className={stats.isMajorityMet ? "text-blue-600" : ""}>{stats.checkedIn}/{stats.majorityTarget}</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden relative">
                                                <div className="absolute top-0 bottom-0 w-[1px] bg-slate-300 left-1/2"></div>
                                                <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, (stats.checkedIn / stats.total) * 100)}%` }}></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </header>

            {/* 2. Search & List */}
            <main className="flex-1 overflow-hidden flex flex-col max-w-4xl mx-auto w-full px-4 pt-4 pb-4">
                <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-300 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-base bg-white text-slate-900 placeholder:text-slate-400"
                        placeholder="동호수(101-101) 또는 성명..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        disabled={!activeMeetingId}
                    />
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pb-40">
                    {filteredMembers.map(member => {
                        const record = activeMeetingId ? attendance.find(a => a.member_id === member.id && a.meeting_id === activeMeetingId) : null;
                        const isCheckedIn = !!record;
                        const checkInType = record?.type;
                        const displayProxyName = record?.proxy_name || member.proxy;

                        return (
                            <div key={member.id} className="p-3 rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:border-blue-300">
                                <div className="flex justify-between items-center">
                                    {/* Member Info (Compact Left) */}
                                    <div className="flex flex-col">
                                        <div className={`text-2xl font-black leading-none mb-1 ${isCheckedIn ? 'text-emerald-700' : 'text-slate-700'}`}>
                                            {member.unit}
                                        </div>
                                        <div className="text-base font-bold text-slate-800 flex items-center">
                                            {member.name}
                                            {displayProxyName && (isCheckedIn ? checkInType === 'proxy' : true) && <span className="text-slate-800 ml-0.5">({displayProxyName})</span>}
                                        </div>
                                    </div>

                                    {/* Actions (Right) */}
                                    <div className="flex gap-1">
                                        {!isCheckedIn ? (
                                            <>
                                                <button
                                                    onClick={() => handleCheckIn(member.id, 'direct')}
                                                    disabled={!activeMeetingId}
                                                    className="flex flex-col items-center justify-center w-14 h-14 rounded-lg bg-emerald-500 active:bg-emerald-600 text-white shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                                                >
                                                    <UserCheck size={20} className="mb-0.5" />
                                                    <span className="text-[12px] font-bold leading-none">본인</span>
                                                </button>
                                                <button
                                                    onClick={() => handleOpenProxyModal(member)}
                                                    disabled={!activeMeetingId}
                                                    className="flex flex-col items-center justify-center w-14 h-14 rounded-lg bg-blue-500 active:bg-blue-600 text-white shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                                                >
                                                    <UserCheck size={20} className="mb-0.5" />
                                                    <span className="text-[12px] font-bold leading-none">대리</span>
                                                </button>
                                                <button
                                                    onClick={() => handleCheckIn(member.id, 'written')}
                                                    disabled={!activeMeetingId}
                                                    className="flex flex-col items-center justify-center w-14 h-14 rounded-lg bg-orange-400 active:bg-orange-500 text-white shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                                                >
                                                    <UserCheck size={20} className="mb-0.5" />
                                                    <span className="text-[12px] font-bold leading-none">서면</span>
                                                </button>
                                            </>
                                        ) : (
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-14 h-14 rounded-lg flex flex-col items-center justify-center bg-slate-100 text-slate-400 shadow-sm border border-slate-200">
                                                    <Check size={20} className="mb-0.5 stroke-[3px]" />
                                                    <span className="text-[12px] font-bold leading-none">{
                                                        checkInType === 'written' ? '서면' :
                                                            checkInType === 'proxy' ? '대리' : '입장'
                                                    }</span>
                                                </div>
                                                <button
                                                    onClick={() => handleCancelCheckIn(member.id)}
                                                    className="w-10 h-14 rounded-lg bg-white border border-slate-200 text-slate-400 active:text-red-500 active:bg-red-50 flex items-center justify-center transition-colors"
                                                >
                                                    <RotateCcw size={18} />
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
            {/* Proxy Input Modal */}
            {isProxyModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5">
                            <h3 className="text-lg font-bold text-slate-800 mb-1">대리인 성명 입력</h3>
                            <p className="text-sm text-slate-500 mb-4">대리 참석자의 성명을 입력해주세요.</p>
                            <input
                                autoFocus
                                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-0 outline-none text-lg font-bold text-slate-800 placeholder:text-slate-300 transition-colors"
                                placeholder="성명 입력"
                                value={proxyNameInput}
                                onChange={(e) => setProxyNameInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && proxyNameInput.trim()) {
                                        handleConfirmProxy();
                                    }
                                }}
                            />
                        </div>
                        <div className="flex border-t border-slate-100">
                            <button
                                onClick={() => setIsProxyModalOpen(false)}
                                className="flex-1 py-4 text-base font-bold text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                            >
                                취소
                            </button>
                            <div className="w-[1px] bg-slate-100"></div>
                            <button
                                onClick={handleConfirmProxy}
                                disabled={!proxyNameInput.trim()}
                                className="flex-1 py-4 text-base font-bold text-blue-600 hover:bg-blue-50 active:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                확인
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
