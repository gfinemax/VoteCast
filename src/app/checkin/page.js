'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { getMajorityThreshold, getMeetingAttendanceStats, getUniqueAttendanceRecords, normalizeAgendaType } from '@/lib/store';
import { Search, UserCheck, AlertCircle, Clock, Check, RotateCcw, ChevronDown, ChevronUp, User, FileText, Pencil, Loader2 } from 'lucide-react';
import FlipNumber from '@/components/ui/FlipNumber';
import FullscreenToggle from '@/components/ui/FullscreenToggle';
import AuthStatus from '@/components/ui/AuthStatus';

const EMPTY_INACTIVE_MEMBER_IDS = [];
const MEETING_TYPE_OPTIONS = [
    { value: 'direct', label: '본인', description: '직접 참석', icon: User, tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { value: 'proxy', label: '대리', description: '대리 참석', icon: Clock, tone: 'bg-blue-50 text-blue-700 border-blue-200' },
    { value: 'written', label: '서면결의서', description: '서면 의결권', icon: FileText, tone: 'bg-orange-50 text-orange-700 border-orange-200' },
    { value: 'none', label: '없음', description: '총회 불참', icon: Check, tone: 'bg-slate-100 text-slate-700 border-slate-200' }
];
const ELECTION_MODE_OPTIONS = [
    { value: 'onsite', label: '현장', description: '현장 선거 참여', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { value: 'mail', label: '우편투표', description: '우편투표 고정표 입력', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
    { value: 'none', label: '없음', description: '선거 불참', tone: 'bg-slate-100 text-slate-700 border-slate-200' }
];

const buildInitialWrittenVotes = (agendas = []) => {
    const initialVotes = {};
    agendas.forEach((agenda) => {
        initialVotes[agenda.id] = 'yes';
    });
    return initialVotes;
};

const buildInitialElectionVotes = (agendas = []) => {
    const initialVotes = {};
    agendas.forEach((agenda) => {
        initialVotes[agenda.id] = 'yes';
    });
    return initialVotes;
};

const getAttendanceBadges = (record) => {
    if (!record) return [];

    const badges = [];
    if (record.has_election) {
        badges.push({
            key: 'election',
            label: '선거',
            icon: Check,
            className: 'bg-amber-100 text-amber-700'
        });
    }

    if (record.type === 'direct') {
        badges.push({
            key: 'direct',
            label: '본인',
            icon: User,
            className: 'bg-emerald-100 text-emerald-700'
        });
    }

    if (record.type === 'proxy') {
        badges.push({
            key: 'proxy',
            label: '대리',
            icon: Clock,
            className: 'bg-blue-100 text-blue-700'
        });
    }

    if (record.type === 'written') {
        badges.push({
            key: 'written',
            label: '서면결의서',
            icon: FileText,
            className: 'bg-orange-100 text-orange-700'
        });
    }

    return badges;
};

export default function CheckInPage() {
    const { state, actions } = useStore();
    const { members, attendance, activeMeetingId, agendas, voteData } = state; // activeMeetingId is Global
    const inactiveMemberIds = Array.isArray(voteData?.inactiveMemberIds) ? voteData.inactiveMemberIds : EMPTY_INACTIVE_MEMBER_IDS;
    const activeMemberIdSet = useMemo(() => {
        const inactiveMemberIdSet = new Set(inactiveMemberIds);
        return new Set(
            members
                .filter(member => member.is_active !== false && !inactiveMemberIdSet.has(member.id))
                .map(member => member.id)
        );
    }, [inactiveMemberIds, members]);
    const activeMembers = useMemo(() => {
        return members.filter(member => activeMemberIdSet.has(member.id));
    }, [activeMemberIdSet, members]);

    const [searchTerm, setSearchTerm] = useState("");

    const [isStatsOpen, setIsStatsOpen] = useState(false);
    const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
    const [checkInModalMode, setCheckInModalMode] = useState('create');
    const [isCheckInModalLoading, setIsCheckInModalLoading] = useState(false);
    const [isCheckInSubmitting, setIsCheckInSubmitting] = useState(false);
    const [checkInForm, setCheckInForm] = useState({
        memberId: null,
        meetingType: 'direct',
        electionMode: 'onsite',
        proxyName: '',
        writtenVotes: {},
        electionVotes: {}
    });


    // Identify Folders (General Meetings)
    const folders = useMemo(() => agendas.filter(a => a.type === 'folder'), [agendas]);

    // Use Global Active Meeting
    const currentMeeting = useMemo(() => {
        return folders.find(f => f.id === activeMeetingId);
    }, [folders, activeMeetingId]);

    const meetingAttendanceRecords = useMemo(
        () => getUniqueAttendanceRecords(attendance, activeMeetingId, activeMemberIdSet),
        [activeMeetingId, activeMemberIdSet, attendance]
    );
    const attendanceRecordByMemberId = useMemo(
        () => new Map(meetingAttendanceRecords.map((record) => [record.member_id, record])),
        [meetingAttendanceRecords]
    );

    // Filter Stats by Active Meeting
    const stats = useMemo(() => {
        // If no active meeting, stats are 0
        if (!activeMeetingId) return {
            total: activeMembers.length, // Show total anyway
            checkedIn: 0,
            participantCount: 0,
            directCount: 0,
            proxyCount: 0,
            writtenCount: 0,
            electionCount: 0,
            rate: 0,
            directTarget: Math.ceil(activeMembers.length * 0.2),
            majorityTarget: getMajorityThreshold(activeMembers.length),
            twoThirdsTarget: Math.ceil(activeMembers.length * (2 / 3)),
            isDirectMet: false,
            isMajorityMet: false,
            isTwoThirdsMet: false
        };

        const meetingStats = getMeetingAttendanceStats(attendance, activeMeetingId, activeMemberIdSet);
        const directCount = meetingStats.direct;
        const proxyCount = meetingStats.proxy;
        const writtenCount = meetingStats.written;
        const electionCount = meetingStats.election;
        const checkedInCount = meetingStats.total;
        const participantCount = meetingStats.participantTotal;

        // Total Members in DB
        const total = activeMembers.length;
        const rate = total > 0 ? ((checkedInCount / total) * 100).toFixed(1) : 0;

        // Targets
        const directTarget = Math.ceil(total * 0.2);
        const majorityTarget = getMajorityThreshold(total);
        const twoThirdsTarget = Math.ceil(total * (2 / 3));

        return {
            total,
            checkedIn: checkedInCount,
            participantCount,
            directCount,
            proxyCount,
            writtenCount,
            electionCount,
            rate,
            directTarget,
            majorityTarget,
            twoThirdsTarget,
            isDirectMet: directCount >= directTarget,
            isMajorityMet: checkedInCount >= majorityTarget,
            isTwoThirdsMet: checkedInCount >= twoThirdsTarget
        };
    }, [activeMeetingId, activeMemberIdSet, activeMembers.length, attendance]);

    const filteredMembers = useMemo(() => {
        if (!searchTerm) return activeMembers;
        return activeMembers.filter(m =>
            String(m.name || '').includes(searchTerm) ||
            String(m.unit || '').includes(searchTerm) ||
            String(m.proxy || '').includes(searchTerm)
        );
    }, [activeMembers, searchTerm]);


    const closeCheckInModal = () => {
        setIsCheckInModalOpen(false);
        setCheckInModalMode('create');
        setIsCheckInModalLoading(false);
        setIsCheckInSubmitting(false);
        setCheckInForm({
            memberId: null,
            meetingType: 'direct',
            electionMode: 'onsite',
            proxyName: '',
            writtenVotes: {},
            electionVotes: {}
        });
    };

    const handleOpenCheckInModal = (member) => {
        if (!activeMeetingId) {
            alert("⚠️ 현재 입장 접수 중인 총회가 없습니다.\n관리자에게 문의하세요.");
            return;
        }
        setCheckInModalMode('create');
        setIsCheckInModalLoading(false);
        setCheckInForm({
            memberId: member.id,
            meetingType: 'direct',
            electionMode: 'onsite',
            proxyName: member.proxy || "",
            writtenVotes: buildInitialWrittenVotes(writtenAgendas),
            electionVotes: buildInitialElectionVotes(electionAgendas)
        });
        setIsCheckInModalOpen(true);
    };

    const handleOpenEditCheckInModal = async (member, record) => {
        if (!activeMeetingId || !record) return;

        setCheckInModalMode('edit');
        setIsCheckInModalLoading(true);
        setCheckInForm({
            memberId: member.id,
            meetingType: record.type || 'none',
            electionMode: record.has_election ? 'onsite' : 'none',
            proxyName: record.proxy_name || member.proxy || '',
            writtenVotes: {},
            electionVotes: {}
        });
        setIsCheckInModalOpen(true);

        try {
            const detail = await actions.getCheckInDetails(member.id);
            if (!detail) {
                throw new Error('기존 접수 정보를 불러오지 못했습니다.');
            }

            setCheckInForm({
                memberId: member.id,
                meetingType: detail.meetingType || 'none',
                electionMode: detail.electionMode || 'none',
                proxyName: detail.proxyName || member.proxy || '',
                writtenVotes: detail.writtenVotes || {},
                electionVotes: detail.electionVotes || {}
            });
        } catch (error) {
            console.error('Failed to load check-in detail:', error);
            alert(error.message || '기존 접수 정보를 불러오지 못했습니다.');
            closeCheckInModal();
        } finally {
            setIsCheckInModalLoading(false);
        }
    };

    const handleCancelCheckIn = (memberId) => {
        if (!activeMeetingId) return;
        setCancelMemberId(memberId);
        setIsCancelModalOpen(true);
    };
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [cancelMemberId, setCancelMemberId] = useState(null);

    // Derive Active Agendas (Items inside the current Active Meeting Folder)
    // Assumption: Agendas are ordered. Meeting is a folder. Items follow it until next folder.
    const activeAgendas = (() => {
        if (!activeMeetingId || agendas.length === 0) return [];

        const folderIndex = agendas.findIndex(a => a.id === activeMeetingId);
        if (folderIndex === -1) return [];

        const items = [];
        for (let i = folderIndex + 1; i < agendas.length; i++) {
            if (agendas[i].type === 'folder') break; // Stop at next folder
            items.push(agendas[i]);
        }
        return items;
    })();
    const writtenAgendas = activeAgendas.filter((agenda) => normalizeAgendaType(agenda?.type) !== 'election');
    const electionAgendas = activeAgendas.filter((agenda) => normalizeAgendaType(agenda?.type) === 'election');

    const selectedCheckInMember = members.find((member) => member.id === checkInForm.memberId) || null;
    const isWrittenComplete = (
        checkInForm.meetingType !== 'written'
        || writtenAgendas.every((agenda) => ['yes', 'no', 'abstain'].includes(checkInForm.writtenVotes?.[agenda.id]))
    );
    const isMailElectionComplete = (
        checkInForm.electionMode !== 'mail'
        || electionAgendas.every((agenda) => ['yes', 'no', 'abstain'].includes(checkInForm.electionVotes?.[agenda.id]))
    );

    const isSubmitDisabled = (
        !checkInForm.memberId
        || (checkInForm.electionMode === 'none' && checkInForm.meetingType === 'none')
        || (checkInForm.meetingType === 'proxy' && !checkInForm.proxyName.trim())
        || !isWrittenComplete
        || !isMailElectionComplete
        || isCheckInModalLoading
        || isCheckInSubmitting
    );

    const handleConfirmCheckIn = async () => {
        if (!checkInForm.memberId) return;
        if (!activeMeetingId) {
            alert("⚠️ 현재 입장 접수 중인 총회가 없습니다.\n관리자에게 문의하세요.");
            return;
        }

        const writtenAgendaIdSet = new Set(writtenAgendas.map((agenda) => agenda.id));
        const electionAgendaIdSet = new Set(electionAgendas.map((agenda) => agenda.id));
        const votesArray = Object.entries(checkInForm.writtenVotes || {})
            .filter(([agendaId, choice]) => writtenAgendaIdSet.has(parseInt(agendaId, 10)) && ['yes', 'no', 'abstain'].includes(choice))
            .map(([agendaId, choice]) => ({
                agenda_id: parseInt(agendaId, 10),
                choice
            }));
        const electionVotesArray = Object.entries(checkInForm.electionVotes || {})
            .filter(([agendaId]) => electionAgendaIdSet.has(parseInt(agendaId, 10)))
            .filter(([, choice]) => ['yes', 'no', 'abstain'].includes(choice))
            .map(([agendaId, choice]) => ({
                agenda_id: parseInt(agendaId, 10),
                choice
            }));

        setIsCheckInSubmitting(true);
        const payload = {
            meetingType: checkInForm.meetingType === 'none' ? null : checkInForm.meetingType,
            electionMode: checkInForm.electionMode,
            proxyName: checkInForm.meetingType === 'proxy' ? checkInForm.proxyName.trim() : null,
            writtenVotes: checkInForm.meetingType === 'written' ? votesArray : [],
            electionVotes: checkInForm.electionMode === 'mail' ? electionVotesArray : []
        };

        try {
            const result = checkInModalMode === 'edit'
                ? await actions.replaceCheckInMember(checkInForm.memberId, payload)
                : await actions.checkInMember(checkInForm.memberId, payload);

            if (result?.ok === false) {
                throw (result.error || new Error(checkInModalMode === 'edit' ? '접수 수정에 실패했습니다.' : '접수 처리에 실패했습니다.'));
            }

            closeCheckInModal();
        } catch (error) {
            console.error('Failed to save check-in:', error);
            alert(error.message || (checkInModalMode === 'edit' ? '접수 수정에 실패했습니다.' : '접수 처리에 실패했습니다.'));
        } finally {
            setIsCheckInSubmitting(false);
        }
    };

    const handleConfirmCancelCheckIn = () => {
        if (!cancelMemberId) return;
        actions.cancelCheckInMember(cancelMemberId);
        setIsCancelModalOpen(false);
        setCancelMemberId(null);
    };

    const cancelMember = useMemo(
        () => members.find((member) => member.id === cancelMemberId) || null,
        [cancelMemberId, members]
    );

    return (
        <div className="flex flex-col h-screen bg-slate-100 font-sans">
            {/* 1. Header & Active Meeting Banner (Compact) */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
                <div className="max-w-4xl mx-auto">
                    {/* Top Bar: Title + Status */}
                    <div className="flex justify-start items-center gap-3 px-3 py-1 bg-slate-50 border-b border-slate-100">
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

                        <div className="flex-grow"></div>
                        <FullscreenToggle />
                        <div className="w-px h-4 bg-slate-300 mx-2 hidden md:block"></div>
                        <AuthStatus />
                    </div>

                    {/* Compact Stats Bar (Always Visible) */}
                    {activeMeetingId && (
                        <div className="px-4 py-2 bg-white">
                            <div className="relative flex flex-col md:flex-row items-center justify-between md:justify-center py-1 md:py-4 px-2 gap-2" onClick={() => setIsStatsOpen(!isStatsOpen)}>

                                {/* 1. Left: Total Context */}
                                <div className="md:absolute md:left-0 flex flex-row md:flex-col items-center md:items-start gap-2 md:gap-0 text-sm md:text-base text-slate-500 font-bold tracking-tighter leading-none md:leading-normal">
                                    <span>전체 {stats.total}명</span>
                                    <span className="text-emerald-600">({stats.rate}%)</span>
                                </div>

                                {/* 2. Center: Hero Number */}
                                <div className="flex items-center gap-2 cursor-pointer group hover:scale-105 transition-transform duration-200">
                                    {/* Flip Counter Component */}
                                    <FlipNumber value={stats.checkedIn} />
                                </div>

                                {/* 3. Right: Detail Button */}
                                <button className="md:absolute md:right-0 text-xs font-bold text-white bg-slate-600 hover:bg-slate-700 active:scale-95 transition-all px-2 py-1 md:py-0.5 rounded-full flex items-center gap-1 shadow-md w-full md:w-auto justify-center">
                                    {isStatsOpen ? (
                                        <>접기 <ChevronUp size={14} /></>
                                    ) : (
                                        <>상세 통계 <ChevronDown size={14} /></>
                                    )}
                                </button>
                            </div>

                            {/* Collapsible Detail Stats */}
                            {isStatsOpen && (
                                <div className="mt-1 space-y-3 border-t border-slate-100 pt-2 animate-in slide-in-from-top-2 duration-200">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-2">
                                            <div className="text-sm text-emerald-700 font-bold mb-1">직접</div>
                                            <div className="text-3xl font-black text-emerald-800 leading-none">{stats.directCount}</div>
                                        </div>
                                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-2">
                                            <div className="text-sm text-blue-700 font-bold mb-1">대리</div>
                                            <div className="text-3xl font-black text-blue-800 leading-none">{stats.proxyCount}</div>
                                        </div>
                                        <div className="bg-orange-50 border border-orange-100 rounded-xl p-2">
                                            <div className="text-sm text-orange-700 font-bold mb-1">서면결의서</div>
                                            <div className="text-3xl font-black text-orange-800 leading-none">{stats.writtenCount}</div>
                                        </div>
                                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-2">
                                            <div className="text-sm text-amber-700 font-bold mb-1">선거</div>
                                            <div className="text-3xl font-black text-amber-800 leading-none">{stats.electionCount}</div>
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600 flex items-center justify-between">
                                        <span>복합 포함 전체 처리</span>
                                        <span className="text-slate-900">{stats.participantCount}명</span>
                                    </div>

                                    {/* Progress Bars (Target) */}
                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between text-sm font-bold text-slate-700">
                                                <span>직접참석 <span className="text-xs font-medium text-slate-500">({stats.directTarget}명 목표)</span></span>
                                                <span className={stats.isDirectMet ? "text-emerald-600" : ""}>{stats.directCount}/{stats.directTarget}</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div className={`h-full ${stats.isDirectMet ? 'bg-emerald-500' : 'bg-slate-300'}`} style={{ width: `${Math.min(100, (stats.directCount / (stats.directTarget || 1)) * 100)}%` }}></div>
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
            <main className="flex-1 overflow-hidden flex flex-col max-w-4xl mx-auto w-full px-4 pt-2 pb-4">
                <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        className="w-full pl-9 pr-4 py-3 md:py-2.5 rounded-lg border border-slate-300 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-base bg-white text-slate-900 placeholder:text-slate-400"
                        placeholder="조합원넘버 또는 성명..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        disabled={!activeMeetingId}
                    />
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pb-40">
                    {filteredMembers.map(member => {
                        const record = activeMeetingId ? attendanceRecordByMemberId.get(member.id) : null;
                        const isCheckedIn = !!record;
                        const checkInType = record?.type;
                        const displayProxyName = record?.proxy_name || member.proxy;
                        const badges = getAttendanceBadges(record);

                        return (
                            <div key={member.id} className="p-2 rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:border-blue-300">
                                <div className="flex justify-between items-center">
                                    {/* Member Info (Compact Left) */}
                                    <div className="flex flex-col">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <div className={`text-2xl font-black leading-none ${isCheckedIn ? 'text-emerald-700' : 'text-slate-700'}`}>
                                                {member.unit}
                                            </div>
                                            {isCheckedIn && badges.map((badge) => {
                                                const Icon = badge.icon;
                                                return (
                                                    <span key={badge.key} className={`px-1.5 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 ${badge.className}`}>
                                                        <Icon size={12} /> {badge.label}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                        <div className="text-base font-bold text-slate-800 flex items-center leading-tight">
                                            {member.name}
                                            {displayProxyName && (isCheckedIn ? checkInType === 'proxy' : true) && <span className="text-slate-800 ml-0.5 text-sm md:text-base">({displayProxyName})</span>}
                                        </div>
                                    </div>

                                    {/* Actions (Right) */}
                                    <div className="flex gap-1.5 shrink-0">
                                        {!isCheckedIn ? (
                                            <button
                                                onClick={() => handleOpenCheckInModal(member)}
                                                disabled={!activeMeetingId}
                                                className="min-w-[4.25rem] h-10 md:h-12 px-3 rounded-lg bg-slate-600 hover:bg-slate-700 active:bg-slate-800 text-white shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center gap-1.5"
                                            >
                                                <UserCheck size={16} className="md:w-[18px] md:h-[18px]" />
                                                <span className="text-[11px] md:text-sm font-bold leading-none">접수</span>
                                            </button>
                                        ) : (
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    onClick={() => handleOpenEditCheckInModal(member, record)}
                                                    className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-white border border-slate-200 text-slate-400 active:text-blue-600 active:bg-blue-50 flex items-center justify-center transition-colors shadow-sm"
                                                >
                                                    <Pencil size={18} className="md:w-5 md:h-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleCancelCheckIn(member.id)}
                                                    className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-white border border-slate-200 text-slate-400 active:text-red-500 active:bg-red-50 flex items-center justify-center transition-colors shadow-sm"
                                                >
                                                    <RotateCcw size={18} className="md:w-5 md:h-5" />
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
            {isCheckInModalOpen && selectedCheckInMember && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center animate-in fade-in duration-200">
                    <div className="bg-white rounded-t-3xl md:rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in slide-in-from-bottom-8 md:zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
                        <div className="p-5 border-b border-slate-100 bg-slate-50">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">{checkInModalMode === 'edit' ? '입장 및 선거 수정' : '입장 및 선거 접수'}</h3>
                                    <p className="text-sm text-slate-500">
                                        {selectedCheckInMember.unit} {selectedCheckInMember.name}
                                    </p>
                                </div>
                                <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
                                    선거 복합 지원
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 space-y-5">
                            {isCheckInModalLoading && (
                                <section className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 flex items-center gap-3 text-sm font-semibold text-slate-600">
                                    <Loader2 size={18} className="animate-spin" />
                                    기존 접수 정보를 불러오는 중입니다.
                                </section>
                            )}
                            <section className="space-y-3">
                                <div>
                                    <div className="text-sm font-bold text-slate-800">총회 의결권</div>
                                    <p className="text-xs text-slate-500">본인, 대리, 서면 중 하나를 선택하거나 총회 불참으로 둘 수 있습니다.</p>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {MEETING_TYPE_OPTIONS.map((option) => {
                                        const Icon = option.icon;
                                        const isActive = checkInForm.meetingType === option.value;
                                        return (
                                            <button
                                                key={option.value}
                                                onClick={() => setCheckInForm((prev) => ({
                                                    ...prev,
                                                    meetingType: option.value,
                                                    writtenVotes: option.value === 'written'
                                                        ? (Object.keys(prev.writtenVotes || {}).length ? prev.writtenVotes : buildInitialWrittenVotes(writtenAgendas))
                                                        : prev.writtenVotes
                                                }))}
                                                className={`rounded-2xl border px-4 py-3 text-left transition-all ${isActive ? option.tone + ' ring-2 ring-offset-1 ring-slate-300 shadow-sm' : 'border-slate-200 bg-white text-slate-600'}`}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <Icon size={18} />
                                                    {isActive && <Check size={16} />}
                                                </div>
                                                <div className="text-sm font-black">{option.label}</div>
                                                <div className="text-[11px] font-semibold opacity-80">{option.description}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>

                            <section className="space-y-3">
                                <div>
                                    <div className="text-sm font-bold text-slate-800">선거 참여</div>
                                    <p className="text-xs text-slate-500">현장 선거 또는 우편투표 중 하나를 선택할 수 있습니다.</p>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {ELECTION_MODE_OPTIONS.map((option) => {
                                        const isActive = checkInForm.electionMode === option.value;
                                        return (
                                            <button
                                                key={option.value}
                                                onClick={() => setCheckInForm((prev) => ({
                                                    ...prev,
                                                    electionMode: option.value,
                                                    electionVotes: option.value === 'mail'
                                                        ? (Object.keys(prev.electionVotes || {}).length ? prev.electionVotes : buildInitialElectionVotes(electionAgendas))
                                                        : prev.electionVotes
                                                }))}
                                                className={`rounded-2xl border px-3 py-3 text-left transition-all ${isActive ? option.tone + ' ring-2 ring-offset-1 ring-slate-300 shadow-sm' : 'border-slate-200 bg-white text-slate-600'}`}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-sm font-black">{option.label}</span>
                                                    {isActive && <Check size={16} />}
                                                </div>
                                                <div className="text-[11px] font-semibold opacity-80 break-keep">{option.description}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>

                            {checkInForm.meetingType === 'proxy' && (
                                <section className="space-y-2">
                                    <div className="text-sm font-bold text-slate-800">대리인 성명</div>
                                    <input
                                        autoFocus
                                        className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-0 outline-none text-base font-bold text-slate-800 placeholder:text-slate-300 transition-colors"
                                        placeholder="대리인 성명 입력"
                                        value={checkInForm.proxyName}
                                        onChange={(e) => setCheckInForm((prev) => ({ ...prev, proxyName: e.target.value }))}
                                    />
                                </section>
                            )}

                            {checkInForm.meetingType === 'written' && (
                                <section className="space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-bold text-slate-800">서면결의서</div>
                                            <p className="text-xs text-slate-500">선거 안건을 제외한 총회 안건만 반영됩니다.</p>
                                        </div>
                                        <button
                                            onClick={() => setCheckInForm((prev) => ({ ...prev, writtenVotes: buildInitialWrittenVotes(writtenAgendas) }))}
                                            className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-200 transition-colors"
                                        >
                                            전체 찬성
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        {writtenAgendas.length === 0 ? (
                                            <p className="text-center text-slate-400 py-6">서면결의 대상 총회 안건이 없습니다.</p>
                                        ) : (
                                            writtenAgendas.map((agenda) => (
                                                <div key={agenda.id} className="flex flex-col gap-2">
                                                    <span className="text-sm font-bold text-slate-700 break-keep leading-tight">
                                                        {agenda.title}
                                                    </span>
                                                    <div className="flex bg-slate-100 rounded-lg p-1">
                                                        <button
                                                            onClick={() => setCheckInForm((prev) => ({ ...prev, writtenVotes: { ...prev.writtenVotes, [agenda.id]: 'yes' } }))}
                                                            className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${checkInForm.writtenVotes[agenda.id] === 'yes' ? 'bg-white text-emerald-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                                                        >
                                                            찬성
                                                        </button>
                                                        <button
                                                            onClick={() => setCheckInForm((prev) => ({ ...prev, writtenVotes: { ...prev.writtenVotes, [agenda.id]: 'no' } }))}
                                                            className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${checkInForm.writtenVotes[agenda.id] === 'no' ? 'bg-white text-red-500 shadow-sm ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                                                        >
                                                            반대
                                                        </button>
                                                        <button
                                                            onClick={() => setCheckInForm((prev) => ({ ...prev, writtenVotes: { ...prev.writtenVotes, [agenda.id]: 'abstain' } }))}
                                                            className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${checkInForm.writtenVotes[agenda.id] === 'abstain' ? 'bg-white text-slate-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                                                        >
                                                            기권
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </section>
                            )}

                            {checkInForm.electionMode === 'mail' && (
                                <section className="space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-bold text-slate-800">우편투표 입력</div>
                                            <p className="text-xs text-slate-500">선거 안건별 찬성, 반대, 기권을 선택합니다.</p>
                                        </div>
                                        <button
                                            onClick={() => setCheckInForm((prev) => {
                                                const nextVotes = { ...prev.electionVotes };
                                                electionAgendas.forEach((agenda) => {
                                                    nextVotes[agenda.id] = 'yes';
                                                });
                                                return { ...prev, electionVotes: nextVotes };
                                            })}
                                            className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-200 transition-colors"
                                        >
                                            전체 찬성
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        {electionAgendas.length === 0 ? (
                                            <p className="text-center text-slate-400 py-6">우편투표 대상 선거 안건이 없습니다.</p>
                                        ) : (
                                            electionAgendas.map((agenda) => (
                                                <div key={agenda.id} className="flex flex-col gap-2">
                                                    <span className="text-sm font-bold text-slate-700 break-keep leading-tight">
                                                        {agenda.title}
                                                    </span>
                                                    <div className="flex bg-slate-100 rounded-lg p-1">
                                                        <button
                                                            onClick={() => setCheckInForm((prev) => ({ ...prev, electionVotes: { ...prev.electionVotes, [agenda.id]: 'yes' } }))}
                                                            className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${checkInForm.electionVotes[agenda.id] === 'yes' ? 'bg-white text-emerald-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                                                        >
                                                            찬성
                                                        </button>
                                                        <button
                                                            onClick={() => setCheckInForm((prev) => ({ ...prev, electionVotes: { ...prev.electionVotes, [agenda.id]: 'no' } }))}
                                                            className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${checkInForm.electionVotes[agenda.id] === 'no' ? 'bg-white text-red-500 shadow-sm ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                                                        >
                                                            반대
                                                        </button>
                                                        <button
                                                            onClick={() => setCheckInForm((prev) => ({ ...prev, electionVotes: { ...prev.electionVotes, [agenda.id]: 'abstain' } }))}
                                                            className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${checkInForm.electionVotes[agenda.id] === 'abstain' ? 'bg-white text-slate-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                                                        >
                                                            기권
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </section>
                            )}

                            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                                <div className="text-sm font-bold text-slate-800">저장 결과</div>
                                <div className="flex flex-wrap gap-2">
                                    {getAttendanceBadges({
                                        type: checkInForm.meetingType === 'none' ? null : checkInForm.meetingType,
                                        has_election: checkInForm.electionMode !== 'none'
                                    }).map((badge) => {
                                        const Icon = badge.icon;
                                        return (
                                            <span key={badge.key} className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${badge.className}`}>
                                                <Icon size={12} /> {badge.label}
                                            </span>
                                        );
                                    })}
                                    {!isMailElectionComplete && (
                                        <span className="text-xs font-semibold text-red-500">우편투표를 선택한 경우 모든 선거 안건에 응답해야 합니다.</span>
                                    )}
                                    {!isWrittenComplete && (
                                        <span className="text-xs font-semibold text-red-500">서면결의서를 선택한 경우 모든 총회 안건에 응답해야 합니다.</span>
                                    )}
                                    {checkInForm.electionMode === 'none' && checkInForm.meetingType === 'none' && (
                                        <span className="text-xs font-semibold text-red-500">총회 상태 또는 선거 참여를 하나 이상 선택해야 합니다.</span>
                                    )}
                                </div>
                            </section>
                        </div>

                        <div className="flex items-center gap-3 border-t border-slate-200/60 bg-white/90 backdrop-blur-2xl px-5 py-4 pb-5 md:pb-4 w-full shadow-[0_-12px_36px_-6px_rgba(0,0,0,0.12)] relative z-10">
                            <button
                                onClick={closeCheckInModal}
                                className="flex-1 rounded-2xl border-none bg-slate-100/80 px-4 py-4 text-[15px] font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-200/80 active:bg-slate-300 active:scale-95 flex items-center justify-center"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleConfirmCheckIn}
                                disabled={isSubmitDisabled}
                                className="flex-[2] rounded-2xl border-none bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-4 text-[16px] font-black text-white shadow-[0_8px_16px_-6px_rgba(79,70,229,0.5)] transition-all hover:from-blue-500 hover:to-indigo-500 hover:shadow-[0_12px_20px_-6px_rgba(79,70,229,0.6)] active:scale-95 disabled:pointer-events-none disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none flex items-center justify-center"
                            >
                                {isCheckInSubmitting ? '저장 중...' : (checkInModalMode === 'edit' ? '확인 (수정 완료)' : '확인 (접수 완료)')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isCancelModalOpen && cancelMember && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5">
                            <h3 className="text-lg font-bold text-slate-800 mb-1">입장 취소</h3>
                            <p className="text-sm text-slate-500 mb-4 break-keep">
                                {cancelMember.unit} {cancelMember.name} 조합원의 입장을 취소하시겠습니까?
                            </p>
                        </div>
                        <div className="flex border-t border-slate-100">
                            <button
                                onClick={() => {
                                    setIsCancelModalOpen(false);
                                    setCancelMemberId(null);
                                }}
                                className="flex-1 py-4 text-base font-bold text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                            >
                                닫기
                            </button>
                            <div className="w-[1px] bg-slate-100"></div>
                            <button
                                onClick={handleConfirmCancelCheckIn}
                                className="flex-1 py-4 text-base font-bold text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors"
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
