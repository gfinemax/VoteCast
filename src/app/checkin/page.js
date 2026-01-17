'use client';

import React, { useState, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { Search, UserCheck, Check, Clock, RotateCcw } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

export default function CheckInPage() {
    const { state, actions } = useStore();
    const [searchTerm, setSearchTerm] = useState("");

    const filteredMembers = useMemo(() => {
        if (!searchTerm) return state.members;
        return state.members.filter(m =>
            m.unit.includes(searchTerm) || m.name.includes(searchTerm)
        );
    }, [state.members, searchTerm]);

    const stats = useMemo(() => {
        const total = state.members.length;
        const online = state.members.filter(m => m.is_checked_in);

        const directCount = online.filter(m => m.check_in_type === 'direct').length; // Strictly 'direct' text
        const proxyCount = online.filter(m => m.check_in_type === 'proxy').length;
        const writtenCount = online.filter(m => m.check_in_type === 'written').length;

        // Targets
        const directTarget = Math.ceil(total * 0.2);
        const majorityTarget = Math.ceil(total / 2);
        const twoThirdsTarget = Math.ceil(total * (2 / 3));

        return {
            total,
            checkedIn: online.length,
            directCount,
            proxyCount,
            writtenCount,
            directTarget,
            majorityTarget,
            twoThirdsTarget,
            isDirectMet: directCount >= directTarget,
            isMajorityMet: online.length >= majorityTarget,
            isTwoThirdsMet: online.length >= twoThirdsTarget
        };
    }, [state.members]);

    return (
        <div className="min-h-screen bg-slate-100 font-sans">
            {/* Sticky Header Dashboard */}
            <div className="sticky top-0 z-50 bg-slate-100/95 backdrop-blur-sm pb-2 pt-2 px-2 shadow-sm border-b border-slate-200/50">
                <div className="max-w-md mx-auto">
                    <Card className="bg-white overflow-hidden shadow-md border-0 ring-1 ring-slate-200">
                        {/* 1. Top Row: Global Stats */}
                        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50/50">
                            <div>
                                <h1 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                                    <UserCheck size={12} className="text-emerald-500" /> 입구 체크인 현황
                                </h1>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-xl font-black text-slate-800">{stats.checkedIn}</span>
                                <span className="text-[10px] text-slate-400 font-medium">/ {stats.total}명</span>
                                <span className="text-[10px] font-bold text-emerald-600 ml-1">
                                    ({((stats.checkedIn / (stats.total || 1)) * 100).toFixed(1)}%)
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
                </div>
            </div>

            <div className="max-w-md mx-auto px-4 pb-24 pt-2">
                {/* Search */}
                <div className="relative mb-2">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="동/호수(101-102) 또는 이름 검색"
                        className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 bg-white placeholder:text-slate-400 text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* List */}
                <div className="space-y-2">
                    {filteredMembers.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">
                            검색 결과가 없습니다.
                        </div>
                    ) : (
                        filteredMembers.map(member => (
                            <Card key={member.id} className={`p-3 transition-all ${member.is_checked_in ? 'bg-slate-50 opacity-90' : 'bg-white'}`}>
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0 flex-1 mr-1">
                                        {/* Unified Layout for Checked and Unchecked: Unit (L1) / Name (L2) */}
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-black text-xl text-slate-800 leading-tight">{member.unit}</span>
                                                {member.is_checked_in && (
                                                    <div className={`text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1 ${member.check_in_type === 'proxy' ? 'bg-blue-100 text-blue-600' :
                                                        member.check_in_type === 'written' ? 'bg-orange-100 text-orange-600' :
                                                            'bg-emerald-100 text-emerald-600'
                                                        }`}>
                                                        <Clock size={10} /> {
                                                            member.check_in_type === 'proxy' ? '대리' :
                                                                member.check_in_type === 'written' ? '서면' :
                                                                    '직접'
                                                        }
                                                    </div>
                                                )}
                                            </div>
                                            <span className={`text-base font-bold text-slate-700 leading-tight ${!member.is_checked_in ? 'truncate block' : ''}`}>
                                                {member.name}
                                                {member.proxy && (member.is_checked_in ? member.check_in_type !== 'direct' : true) && <span className="text-slate-600 text-base ml-0.5 font-bold">({member.proxy})</span>}
                                            </span>
                                        </div>
                                    </div>

                                    {member.is_checked_in ? (
                                        <div className="flex gap-0.5 shrink-0">
                                            <Button variant="secondary" disabled className={`text-xs px-2 py-1.5 font-black h-8 disabled:opacity-100 ${member.check_in_type === 'proxy'
                                                ? 'text-blue-800 bg-blue-50 border-blue-100'
                                                : member.check_in_type === 'written'
                                                    ? 'text-orange-800 bg-orange-50 border-orange-100'
                                                    : 'text-emerald-800 bg-emerald-50 border-emerald-100'
                                                }`}>
                                                <Check size={14} /> {
                                                    member.check_in_type === 'written' ? '서면제출' :
                                                        member.check_in_type === 'proxy' ? '대리입장' :
                                                            '입장완료'
                                                }
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() => {
                                                    if (window.confirm(`${member.name} (${member.unit})님의 입장을 취소하시겠습니까?`)) {
                                                        actions.cancelCheckInMember(member.id);
                                                    }
                                                }}
                                                className="px-2 h-8 text-slate-400 hover:text-red-500 hover:bg-red-50 border-slate-200"
                                            >
                                                <RotateCcw size={12} />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex gap-0.5 shrink-0">
                                            <Button
                                                variant="success"
                                                onClick={() => actions.checkInMember(member.id, 'direct')}
                                                className="px-1 py-1.5 text-xs h-9 shadow-sm"
                                            >
                                                직접
                                            </Button>
                                            <Button
                                                variant="success"
                                                onClick={() => {
                                                    const inputName = window.prompt("대리인 성명을 입력해주세요.", member.proxy || "");
                                                    if (inputName !== null) {
                                                        const finalName = inputName.trim();
                                                        if (finalName) {
                                                            actions.checkInMember(member.id, 'proxy', finalName);
                                                        } else {
                                                            alert("대리인 성명을 입력해야 합니다.");
                                                        }
                                                    }
                                                }}
                                                className="px-1 py-1.5 text-xs h-9 shadow-sm"
                                            >
                                                대리
                                            </Button>
                                            <Button
                                                variant="success"
                                                onClick={() => actions.checkInMember(member.id, 'written')}
                                                className="px-1 py-1.5 text-xs h-9 shadow-sm"
                                            >
                                                서면
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
