'use client';

import React, { useState, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { Search, UserCheck, UserX, AlertCircle, Clock, Check, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import FlipNumber from '@/components/ui/FlipNumber';
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


    // Written Vote Modal State
    const [isWrittenVoteModalOpen, setIsWrittenVoteModalOpen] = useState(false);
    const [writtenVoteMemberId, setWrittenVoteMemberId] = useState(null);
    const [writtenVotes, setWrittenVotes] = useState({}); // { agendaId: 'yes' | 'no' | 'abstain' }

    // Derive Active Agendas (Items inside the current Active Meeting Folder)
    // Assumption: Agendas are ordered. Meeting is a folder. Items follow it until next folder.
    const activeAgendas = useMemo(() => {
        if (!activeMeetingId || agendas.length === 0) return [];

        const folderIndex = agendas.findIndex(a => a.id === activeMeetingId);
        if (folderIndex === -1) return [];

        const items = [];
        for (let i = folderIndex + 1; i < agendas.length; i++) {
            if (agendas[i].type === 'folder') break; // Stop at next folder
            items.push(agendas[i]);
        }
        return items;
    }, [agendas, activeMeetingId]);

    const handleOpenWrittenVoteModal = (member) => {
        setWrittenVoteMemberId(member.id);

        // Initialize Default Votes (Abstain)
        const initialVotes = {};
        activeAgendas.forEach(a => {
            initialVotes[a.id] = 'abstain';
        });
        setWrittenVotes(initialVotes);

        setIsWrittenVoteModalOpen(true);
    };

    const handleConfirmWrittenVote = () => {
        if (!writtenVoteMemberId) return;

        // Convert Map to Array for API
        const votesArray = Object.entries(writtenVotes).map(([agendaId, choice]) => ({
            agenda_id: parseInt(agendaId),
            choice: choice
        }));

        handleCheckIn(writtenVoteMemberId, 'written', null); // Pass votes via specialized call if needed, but here handleCheckIn is generic wrapper
        // Wait, handleCheckIn uses actions.checkInMember. 
        // We need to pass votes to actions.checkInMember.
        // Let's modify handleCheckIn or call action directly.
        // Actually handleCheckIn wrapper has alert logic. Let's reuse it or bypass.
        // It calls actions.checkInMember(memberId, type, proxyName).
        // I need to update handleCheckIn or call action directly.
        // Let's update handleCheckIn signature OR call action directly here.
        // Calling action directly is cleaner here since we already checked activeMeetingId via activeAgendas logic?
        // But handleCheckIn has the check.
        // Let's call checkInMember directly.

        actions.checkInMember(writtenVoteMemberId, 'written', null, votesArray);

        setIsWrittenVoteModalOpen(false);
        setWrittenVoteMemberId(null);
        setWrittenVotes({});
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
                    <div className="flex justify-start items-center gap-3 px-4 py-2 bg-slate-50 border-b border-slate-100">
                        {currentMeeting ? (
                            <div className="flex items-center gap-1.5">
                                <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                </span>
                                <span className="text-lg font-bold text-emerald-700 truncate max-w-[200px]">{currentMeeting.title}</span>
                            </div>
                        ) : (
                            <span className="text-xs font-bold text-red-500 flex items-center gap-1"><AlertCircle size={12} /> 입장 중단됨</span>
                        )}
                        <div className="h-4 w-px bg-slate-300 mx-1"></div>
                        <h1 className="text-lg font-bold text-slate-800">등록 데스크</h1>
                    </div>

                    {/* Compact Stats Bar (Always Visible) */}
                    {activeMeetingId && (
                        <div className="px-4 py-2 bg-white">
                            <div className="relative flex items-center justify-center py-4 px-2" onClick={() => setIsStatsOpen(!isStatsOpen)}>

                                {/* 1. Left: Total Context */}
                                <div className="absolute left-0 flex flex-col md:block items-start text-base text-slate-500 font-bold tracking-tighter leading-tight md:leading-normal">
                                    <span>전체 {stats.total}명</span>
                                    <span className="text-emerald-600">({stats.rate}%)</span>
                                </div>

                                {/* 2. Center: Hero Number */}
                                <div className="flex items-center gap-3 cursor-pointer group hover:scale-105 transition-transform duration-200">
                                    {/* Flip Counter Component */}
                                    <FlipNumber value={stats.checkedIn} />
                                </div>

                                {/* 3. Right: Detail Button */}
                                <button className="absolute right-0 text-[10px] font-bold text-white bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md">
                                    {isStatsOpen ? (
                                        <>접기 <ChevronUp size={12} /></>
                                    ) : (
                                        <>상세 통계 <ChevronDown size={12} /></>
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
                                                    onClick={() => handleOpenWrittenVoteModal(member)}
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

            {/* Written Vote Input Modal */}
            {isWrittenVoteModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">서면 결의 입력</h3>
                                <p className="text-sm text-slate-500">
                                    {members.find(m => m.id === writtenVoteMemberId)?.unit} {members.find(m => m.id === writtenVoteMemberId)?.name}
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    // Batch Set All to YES
                                    const newVotes = {};
                                    activeAgendas.forEach(agenda => {
                                        newVotes[agenda.id] = 'yes';
                                    });
                                    setWrittenVotes(newVotes);
                                }}
                                className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-200 transition-colors"
                            >
                                전체 찬성
                            </button>
                        </div>

                        {/* Agenda List */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4">
                            {activeAgendas.length === 0 ? (
                                <p className="text-center text-slate-400 py-10">투표할 안건이 없습니다.</p>
                            ) : (
                                activeAgendas.map(agenda => (
                                    <div key={agenda.id} className="flex flex-col gap-2">
                                        <span className="text-sm font-bold text-slate-700 break-keep leading-tight">
                                            {agenda.title}
                                        </span>
                                        <div className="flex bg-slate-100 rounded-lg p-1">
                                            <button
                                                onClick={() => setWrittenVotes(prev => ({ ...prev, [agenda.id]: 'yes' }))}
                                                className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${writtenVotes[agenda.id] === 'yes' ? 'bg-white text-emerald-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                찬성
                                            </button>
                                            <button
                                                onClick={() => setWrittenVotes(prev => ({ ...prev, [agenda.id]: 'no' }))}
                                                className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${writtenVotes[agenda.id] === 'no' ? 'bg-white text-red-500 shadow-sm ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                반대
                                            </button>
                                            <button
                                                onClick={() => setWrittenVotes(prev => ({ ...prev, [agenda.id]: 'abstain' }))}
                                                className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${writtenVotes[agenda.id] === 'abstain' ? 'bg-white text-slate-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                기권
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex border-t border-slate-100 bg-white">
                            <button
                                onClick={() => setIsWrittenVoteModalOpen(false)}
                                className="flex-1 py-4 text-base font-bold text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                            >
                                취소
                            </button>
                            <div className="w-[1px] bg-slate-100"></div>
                            <button
                                onClick={handleConfirmWrittenVote}
                                className="flex-1 py-4 text-base font-bold text-orange-600 hover:bg-orange-50 active:bg-orange-100 transition-colors"
                            >
                                확인 (입장 처리)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
