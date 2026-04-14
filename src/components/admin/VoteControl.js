'use client';

import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { useStore } from '@/lib/store';
import { getAgendaVoteBuckets, getAttendanceQuorumTarget, getMeetingAttendanceStats, normalizeAgendaType } from '@/lib/store';
import { CheckCircle2, AlertTriangle, Trash2, Lock, Unlock, RotateCcw, Save, Wand2 } from 'lucide-react';
import Card from '@/components/ui/Card';

const EMPTY_INACTIVE_MEMBER_IDS = [];

export default function VoteControl() {
    const { state, actions } = useStore();
    const { updateAgenda, setDeclarationEditMode, setAgendaTypeLock } = actions;
    const { members, attendance, agendas, currentAgendaId, voteData } = state;
    const [isReadyToConfirm, setIsReadyToConfirm] = useState(false);
    const [confirmModalState, setConfirmModalState] = useState({ isOpen: false, type: null }); // type: 'confirm' | 'reset'
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

    // 1. Identify Context (Current Agenda & Meeting/Folder)
    const currentAgenda = agendas.find(a => a.id === currentAgendaId);

    // Find the "Meeting" (Folder) this agenda belongs to
    const meetingId = useMemo(() => {
        if (!currentAgenda) return null;
        if (currentAgenda.type === 'folder') return currentAgenda.id;

        // Find the closest preceding folder
        const currentIndex = agendas.findIndex(a => a.id === currentAgendaId);
        for (let i = currentIndex - 1; i >= 0; i--) {
            if (agendas[i].type === 'folder') return agendas[i].id;
        }
        return null; // Orphan agenda?
    }, [agendas, currentAgendaId, currentAgenda]);

    // 2. Derive Attendance Data (Real-time)
    const realtimeStats = useMemo(() => {
        return getMeetingAttendanceStats(attendance, meetingId, activeMemberIdSet);
    }, [activeMemberIdSet, attendance, meetingId]);

    // SNAPSHOT HANDLING
    const snapshot = currentAgenda?.vote_snapshot;
    const isConfirmed = !!snapshot;
    const liveVoteBuckets = useMemo(() => getAgendaVoteBuckets(currentAgenda), [currentAgenda]);
    const hasSplitVoteColumns = liveVoteBuckets.hasSplitVoteColumns;
    const writtenVoteTotals = liveVoteBuckets.written;
    const onsiteVoteTotals = hasSplitVoteColumns ? liveVoteBuckets.onsite : liveVoteBuckets.final;
    const finalVoteTotals = liveVoteBuckets.final;

    // Use Snapshot if confirmed, otherwise Realtime
    const displayStats = isConfirmed ? snapshot.stats : realtimeStats;

    // Vote Data Sources
    const votesYes = isConfirmed ? snapshot.votes.yes : finalVoteTotals.yes;
    const votesNo = isConfirmed ? snapshot.votes.no : finalVoteTotals.no;
    const votesAbstain = isConfirmed ? snapshot.votes.abstain : finalVoteTotals.abstain;
    const declaration = isConfirmed ? snapshot.declaration : (currentAgenda?.declaration || '');
    const editableVoteFieldMap = hasSplitVoteColumns
        ? { yes: 'onsite_yes', no: 'onsite_no', abstain: 'onsite_abstain' }
        : { yes: 'votes_yes', no: 'votes_no', abstain: 'votes_abstain' };
    const totalWrittenVotes = writtenVoteTotals.yes + writtenVoteTotals.no + writtenVoteTotals.abstain;
    const editableVotesYes = onsiteVoteTotals.yes;
    const editableVotesNo = onsiteVoteTotals.no;
    const editableVotesAbstain = onsiteVoteTotals.abstain;

    // Vote Type Map
    const currentAgendaType = normalizeAgendaType(currentAgenda?.type);
    const isSpecialVote = currentAgendaType === 'twoThirds';
    const isElection = currentAgendaType === 'election';

    // Targets (Based on Snapshot or Realtime totalMembers)
    // Note: If total members changed (removed from DB), snapshot should logically preserve it? 
    // Usually total members is stable, but let's assume Members list is realtime reference OR snapshot if we saved it.
    // For now, using realtime totalMembers is likely acceptable unless members were deleted.
    const totalMembers = activeMembers.length;

    // Recalculate Logic based on DISPLAY stats
    const quorumTarget = getAttendanceQuorumTarget(currentAgendaType, totalMembers);

    const directTarget = Math.ceil(totalMembers * 0.2);
    const isDirectSatisfied = !isElection || (displayStats.direct >= directTarget);
    const isQuorumSatisfied = (displayStats.total >= quorumTarget) && isDirectSatisfied;

    // Pass/Fail Logic (derived)
    const calculatePass = () => {
        if (isSpecialVote) {
            return votesYes >= Math.ceil(displayStats.total * (2 / 3));
        } else {
            return votesYes > (displayStats.total / 2);
        }
    };
    const isPassed = calculatePass();

    // 3. Declaration Generation
    const generateDefaultDeclaration = useCallback(() => {
        if (!currentAgenda || displayStats.total === 0) return '';

        const criterion = isSpecialVote ? "3분의 2 이상" : "과반수 이상";

        return `"${currentAgenda.title}" 서면결의 포함 찬성(${votesYes})표, 반대(${votesNo})표, 기권(${votesAbstain})표로
전체 참석자(${displayStats.total.toLocaleString()})명중 ${criterion} ${isPassed ? '찬성으로' : '찬성 미달로'}
"${currentAgenda.title}"은 ${isPassed ? '가결' : '부결'}되었음을 선포합니다.`;
    }, [currentAgenda, displayStats.total, isPassed, isSpecialVote, votesAbstain, votesNo, votesYes]);

    // Use GLOBAL state for declaration editing (prevents revert on re-render)
    const declarationEditState = state.declarationEditState?.[currentAgendaId] || { isEditing: false, isAutoCalc: true };
    const isEditingDeclaration = declarationEditState.isEditing;
    const isAutoCalc = declarationEditState.isAutoCalc;
    const agendaTypeLocks = (voteData?.agendaTypeLocks && typeof voteData.agendaTypeLocks === 'object')
        ? voteData.agendaTypeLocks
        : {};

    // LOCAL declaration state for editing (doesn't trigger realtime sync)
    const [declarationDraft, setDeclarationDraft] = useState({ agendaId: null, value: '' });
    const localDeclaration = declarationDraft.agendaId === currentAgendaId
        ? declarationDraft.value
        : (declaration || '');
    const isTypeLocked = !!agendaTypeLocks[currentAgendaId];
    const primaryOnsiteInputRef = useRef(null);

    const setIsEditingDeclaration = (value) => {
        if (!currentAgendaId) return;
        setDeclarationEditMode(currentAgendaId, value, isAutoCalc);
    };
    const setIsAutoCalc = (value) => {
        if (!currentAgendaId) return;
        setDeclarationEditMode(currentAgendaId, isEditingDeclaration, value);
    };

    // Save declaration to DB (called when clicking Done)
    const saveDeclaration = useCallback(() => {
        if (currentAgenda && localDeclaration !== declaration) {
            updateAgenda({ id: currentAgenda.id, declaration: localDeclaration });
        }
    }, [currentAgenda, declaration, localDeclaration, updateAgenda]);

    // Declaration Auto-Update (only when NOT editing)
    useEffect(() => {
        if (!currentAgenda || isEditingDeclaration || isConfirmed) return;
        if (isAutoCalc) {
            const newDecl = generateDefaultDeclaration();
            if (newDecl !== currentAgenda.declaration) {
                updateAgenda({ id: currentAgenda.id, declaration: newDecl });
            }
        }
    }, [currentAgenda, generateDefaultDeclaration, isAutoCalc, isConfirmed, isEditingDeclaration, updateAgenda]);

    useEffect(() => {
        if (!hasSplitVoteColumns || isConfirmed) return undefined;

        const frameId = window.requestAnimationFrame(() => {
            primaryOnsiteInputRef.current?.focus();
        });

        return () => {
            window.cancelAnimationFrame(frameId);
        };
    }, [currentAgendaId, hasSplitVoteColumns, isConfirmed]);


    // Handlers
    const handleTypeChange = (newType) => {
        if (currentAgenda && !isConfirmed && !isTypeLocked) { // Cannot change type if confirmed or locked
            actions.updateAgenda({ id: currentAgenda.id, type: newType });
        }
    };

    const toggleTypeLock = async () => {
        if (!currentAgendaId) return;
        try {
            await setAgendaTypeLock(currentAgendaId, !isTypeLocked);
        } catch (error) {
            console.error('Failed to persist agenda type lock:', error);
            alert(error.message || '잠금 상태 저장에 실패했습니다.');
        }
    };

    const handleVoteUpdate = (field, rawValue) => {
        if (isConfirmed) return;
        if (!currentAgenda) return;

        // Explicitly treat empty string as 0
        const value = (rawValue === '' || rawValue === null || rawValue === undefined) ? 0 : parseInt(rawValue);
        if (isNaN(value)) return;

        let updates = { [field]: value };

        // Auto-Calc Logic
        if (isAutoCalc) {
            if (hasSplitVoteColumns) {
                if (field === 'onsite_yes') {
                    const currentAbstain = editableVotesAbstain;
                    const nextNo = Math.max(0, displayStats.total - totalWrittenVotes - value - currentAbstain);
                    updates.onsite_no = nextNo;
                } else if (field === 'onsite_no') {
                    const currentAbstain = editableVotesAbstain;
                    const nextYes = Math.max(0, displayStats.total - totalWrittenVotes - value - currentAbstain);
                    updates.onsite_yes = nextYes;
                } else if (field === 'onsite_abstain') {
                    const currentYes = editableVotesYes;
                    const nextNo = Math.max(0, displayStats.total - totalWrittenVotes - currentYes - value);
                    updates.onsite_no = nextNo;
                }
            } else if (field === 'votes_yes') {
                const currentAbstain = votesAbstain;
                const nextNo = Math.max(0, displayStats.total - value - currentAbstain);
                updates.votes_no = nextNo;
            } else if (field === 'votes_no') {
                const currentAbstain = votesAbstain;
                const nextYes = Math.max(0, displayStats.total - value - currentAbstain);
                updates.votes_yes = nextYes;
            } else if (field === 'votes_abstain') {
                const currentYes = votesYes;
                const nextNo = Math.max(0, displayStats.total - currentYes - value);
                updates.votes_no = nextNo;
            }
        }

        updateAgenda({ id: currentAgenda.id, ...updates });
    };

    const handleAutoSum = () => {
        if (isConfirmed || !currentAgenda) return;
        const remainder = hasSplitVoteColumns
            ? Math.max(0, displayStats.total - totalWrittenVotes - editableVotesNo - editableVotesAbstain)
            : Math.max(0, displayStats.total - votesNo - votesAbstain);
        handleVoteUpdate(editableVoteFieldMap.yes, remainder);
    };

    const handleResetEditableVotes = () => {
        if (isConfirmed || !currentAgenda) return;

        if (hasSplitVoteColumns) {
            updateAgenda({
                id: currentAgenda.id,
                onsite_yes: 0,
                onsite_no: 0,
                onsite_abstain: 0
            });
            return;
        }

        updateAgenda({
            id: currentAgenda.id,
            votes_yes: 0,
            votes_no: 0,
            votes_abstain: 0
        });
    };

    const handleConfirmDecision = () => {
        setConfirmModalState({ isOpen: true, type: 'confirm' });
    };

    const handleResetDecision = () => {
        setConfirmModalState({ isOpen: true, type: 'reset' });
    };

    const executeModalAction = () => {
        if (confirmModalState.type === 'confirm') {
            const snapshotData = {
                stats: realtimeStats,
                votes: { yes: votesYes, no: votesNo, abstain: votesAbstain },
                declaration: currentAgenda.declaration, // current value
                result: isPassed ? 'PASSED' : 'FAILED',
                timestamp: new Date().toISOString()
            };
            updateAgenda({ id: currentAgenda.id, vote_snapshot: snapshotData });
            setConfirmModalState({ isOpen: false, type: null });
        } else if (confirmModalState.type === 'reset') {
            updateAgenda({ id: currentAgenda.id, vote_snapshot: null });
            setIsReadyToConfirm(false); // Reset the checkbox state when resetting
            setConfirmModalState({ isOpen: false, type: null });
        }
    };

    if (!currentAgenda) return <div className="p-10 text-center text-slate-400">안건을 선택해주세요.</div>;

    // Helper for Total Votes Cast
    const totalVotesCast = votesYes + votesNo + votesAbstain;
    const isVoteCountValid = totalVotesCast === displayStats.total;
    const voteTypeOptions = [
        {
            value: 'majority',
            label: '일반',
            activeClass: 'border-blue-200 bg-blue-50 text-blue-700 shadow-sm',
            tooltipLines: [
                '정족수: 전체 조합원 과반수 출석',
                '의결: 출석자 과반수 찬성'
            ]
        },
        {
            value: 'election',
            label: '선거',
            activeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm',
            tooltipLines: [
                '정족수: 전체 조합원 과반수 출석(직접참석20%)',
                '의결: 출석자 과반수 찬성'
            ]
        },
        {
            value: 'twoThirds',
            label: '해산/규약',
            activeClass: 'border-violet-200 bg-violet-50 text-violet-700 shadow-sm',
            tooltipLines: [
                '정족수: 전체 조합원 3분의 2 출석',
                '의결: 출석자 3분의 2 이상 찬성'
            ]
        }
    ];

    const splitVoteDisplayCards = hasSplitVoteColumns ? [
        {
            key: 'yes',
            summaryLabel: '전체 찬성',
            inputLabel: '현장 찬성',
            totalValue: votesYes,
            writtenValue: writtenVoteTotals.yes,
            onsiteValue: editableVotesYes,
            updateField: editableVoteFieldMap.yes,
            tone: {
                rowTint: 'border-emerald-100 bg-emerald-50/60',
                labelBadge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                totalText: 'text-emerald-700',
                writtenText: 'text-emerald-700/80',
                inputLabel: 'text-emerald-700',
                inputBorder: 'border-emerald-100 text-emerald-700 caret-emerald-700 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100'
            }
        },
        {
            key: 'no',
            summaryLabel: '전체 반대',
            inputLabel: '현장 반대',
            totalValue: votesNo,
            writtenValue: writtenVoteTotals.no,
            onsiteValue: editableVotesNo,
            updateField: editableVoteFieldMap.no,
            tone: {
                rowTint: 'border-red-100 bg-red-50/60',
                labelBadge: 'bg-red-100 text-red-700 border-red-200',
                totalText: 'text-red-700',
                writtenText: 'text-red-700/80',
                inputLabel: 'text-red-700',
                inputBorder: 'border-red-100 text-red-700 caret-red-700 focus:border-red-500 focus:ring-4 focus:ring-red-100'
            }
        },
        {
            key: 'abstain',
            summaryLabel: '전체 기권/무효',
            inputLabel: '현장 기권/무효',
            totalValue: votesAbstain,
            writtenValue: writtenVoteTotals.abstain,
            onsiteValue: editableVotesAbstain,
            updateField: editableVoteFieldMap.abstain,
            tone: {
                rowTint: 'border-slate-200 bg-slate-50',
                labelBadge: 'bg-slate-100 text-slate-600 border-slate-200',
                totalText: 'text-slate-600',
                writtenText: 'text-slate-500',
                inputLabel: 'text-slate-500',
                inputBorder: 'border-slate-200 text-slate-500 caret-slate-600 focus:border-slate-400 focus:ring-4 focus:ring-slate-100'
            }
        }
    ] : [];


    return (
        <div className="space-y-4 pb-20">
            {/* Header Section */}
            <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                    <h2 className="text-2xl font-bold leading-snug break-keep">
                        {currentAgenda.title}
                        <span className="inline-block align-middle ml-2 -mt-1 text-sm font-normal text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                            {isSpecialVote ? '특별결의(2/3)' : (currentAgendaType === 'election' ? '일반결의(과반/현장참석 20%)' : '일반결의(과반)')}
                        </span>
                    </h2>
                </div>

                {/* Actions removed and moved to Section 4 at the bottom */}
            </div>

            {/* Confirmed Banner */}
            {isConfirmed && (
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg flex justify-center items-center gap-2 text-blue-700 font-bold animate-in fade-in slide-in-from-top-2">
                    <Lock size={16} />
                    현재 의결 결과가 확정되었습니다. (실시간 성원 변동의 영향을 받지 않습니다)
                </div>
            )}

            {/* Section 1: Attendance */}
            <section className={isConfirmed ? "opacity-90 grayscale-[0.3]" : ""}>
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                        01. 성원(참석) 집계
                        <span className="text-xs font-normal text-slate-400 normal-case ml-2">
                            (참조: {agendas.find(a => a.id === meetingId)?.title || '미지정'})
                        </span>
                        {isConfirmed && <span className="text-xs bg-slate-200 text-slate-600 px-1.5 rounded">고정됨</span>}
                    </h3>

                    {/* Vote Type Selector - Single Line Unified Toolbar */}
                    <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
                        <button
                            type="button"
                            onClick={toggleTypeLock}
                            disabled={isConfirmed}
                            title={isTypeLocked ? '투표 유형 잠금 해제' : '투표 유형 잠금'}
                            className={`flex h-8 w-9 items-center justify-center rounded-md transition-all ${
                                isTypeLocked
                                    ? 'bg-yellow-400 text-yellow-900 shadow-sm'
                                    : 'bg-transparent text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                            } disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                            {isTypeLocked ? <Lock size={14} /> : <Unlock size={14} />}
                        </button>

                        <div className="mx-1 h-4 w-px bg-slate-200"></div>

                        <div className="flex items-center">
                            {voteTypeOptions.map((option) => {
                                const isActive = currentAgendaType === option.value;
                                return (
                                    <div key={option.value} className="group relative">
                                        <button
                                            onClick={() => handleTypeChange(option.value)}
                                            disabled={isConfirmed || isTypeLocked}
                                            className={`rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all border ${
                                                isActive
                                                    ? option.activeClass
                                                    : 'border-transparent bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                                            } disabled:cursor-not-allowed disabled:opacity-45`}
                                        >
                                            {option.label}
                                        </button>
                                        <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-56 -translate-x-1/2 rounded-xl border border-slate-200 bg-slate-950 px-3 py-2 text-center text-[11px] font-medium leading-relaxed text-white shadow-2xl group-hover:block group-focus-within:block">
                                            {option.tooltipLines.map((line) => (
                                                <div key={line}>{line}</div>
                                            ))}
                                            <div className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 border-b border-r border-slate-200 bg-slate-950" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <Card className="p-4 space-y-3">
                    {/* Total Members & Quorum Check */}
                    <div className="bg-slate-800 text-white p-3 rounded-lg mb-2 shadow-inner">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-bold text-slate-300">전체 조합원 수</label>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-xl font-bold">{totalMembers}</span>
                                <span className="text-sm text-slate-400">명</span>
                            </div>
                        </div>

                        <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden mb-2 relative">
                            <div className="absolute top-0 bottom-0 w-0.5 bg-white/50 z-10" style={{ left: isSpecialVote ? '66.66%' : '50%' }}></div>
                            <div
                                className={`h-full transition-all duration-500 ${isQuorumSatisfied ? 'bg-emerald-500' : 'bg-red-500'}`}
                                style={{ width: `${Math.min(100, (displayStats.total / (totalMembers || 1)) * 100)}%` }}
                            ></div>
                        </div>

                        <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-400">
                                개회 기준: {quorumTarget}명
                                {isElection && <span className="text-emerald-400 ml-1">중에 현장참석 {directTarget}명(20%)</span>}
                            </span>
                            <span className={`font-bold ${isQuorumSatisfied ? 'text-emerald-400' : 'text-red-400'}`}>
                                {isQuorumSatisfied
                                    ? '조건 충족 (개회 가능)'
                                    : `미달 ${!isDirectSatisfied ? '(직접참석 부족)' : `(${Math.max(0, quorumTarget - displayStats.total)}명 부족)`}`}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* 1. Direct */}
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded min-w-[120px]">
                            <span className="text-sm font-medium text-slate-500 mr-2">조합원</span>
                            <span className="font-mono font-bold text-slate-700 text-2xl">{displayStats.direct}</span>
                        </div>

                        <div className="text-slate-300 font-bold text-lg">+</div>

                        {/* 2. Proxy */}
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded min-w-[120px]">
                            <span className="text-sm font-medium text-slate-500 mr-2">대리인</span>
                            <span className="font-mono font-bold text-slate-700 text-2xl">{displayStats.proxy}</span>
                        </div>

                        <div className="text-slate-300 font-bold text-lg">+</div>

                        {/* 3. Written */}
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded min-w-[120px]">
                            <span className="text-sm font-medium text-slate-500 mr-2">서면</span>
                            <span className="font-mono font-bold text-slate-700 text-2xl">{displayStats.written}</span>
                        </div>

                        <div className="text-slate-300 font-bold text-lg">=</div>

                        {/* 4. Total (Equation Result) */}
                        <div className="flex-1 flex justify-end items-baseline gap-2">
                            <span className="text-base font-bold text-slate-400">총</span>
                            <div className="text-5xl font-black text-blue-600 leading-none">
                                {displayStats.total.toLocaleString()}<span className="text-xl text-blue-400 font-bold ml-1">명</span>
                            </div>
                        </div>
                    </div>
                </Card>
            </section>

            {/* Section 2: Votes */}
            <section className={isConfirmed ? "pointer-events-none opacity-90" : ""}>
                <div className="flex justify-between items-end mb-3">
                    <h3 className="text-lg font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                        02. 투표결과 입력
                        {isConfirmed && <Lock size={14} className="text-slate-400" />}
                    </h3>
                </div>
                <Card className={`p-4 ${isConfirmed ? 'bg-slate-50' : 'bg-white'}`}>
                    {hasSplitVoteColumns ? (
                        <div className="space-y-3">
                            {/* Summary Dashboard Component */}
                            <div className="flex flex-col md:flex-row gap-4 items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex items-center gap-6 divide-x divide-slate-200 w-full md:w-auto">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-semibold text-slate-400 mb-1">총 투표수</span>
                                        <span className="text-2xl font-black text-blue-700">{totalVotesCast}<span className="text-sm font-normal ml-1">표</span></span>
                                    </div>
                                    <div className="flex flex-col pl-6">
                                        <span className="text-xs font-semibold text-slate-400 mb-1">성원(참석자)</span>
                                        <span className="text-xl font-bold text-slate-700">{displayStats.total}<span className="text-sm font-normal ml-1">명</span></span>
                                    </div>
                                    <div className="flex flex-col pl-6 hidden sm:flex">
                                        <span className="text-xs font-semibold text-slate-400 mb-1">투표 구성</span>
                                        <div className="text-sm font-medium text-slate-600 mt-1">
                                            서면 <span className="font-bold text-slate-800">{totalWrittenVotes}</span>
                                            <span className="text-slate-400 mx-1.5">+</span>
                                            현장 <span className="font-bold text-slate-800">{editableVotesYes + editableVotesNo + editableVotesAbstain}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 w-full md:w-auto md:min-w-[140px] transition-colors ${
                                    isVoteCountValid 
                                        ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                                        : 'bg-red-50 border-red-100 text-red-600 animate-pulse'
                                }`}>
                                    {isVoteCountValid ? (
                                        <>
                                            <CheckCircle2 size={24} className="mb-1 text-emerald-500" />
                                            <span className="text-sm font-bold">결과 일치 (검증됨)</span>
                                        </>
                                    ) : (
                                        <>
                                            <AlertTriangle size={24} className="mb-1" />
                                            <span className="text-sm font-bold">{displayStats.total - totalVotesCast}표 부족</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-100 pb-4">
                                    <div className="text-lg font-black text-slate-800">현장 투표 입력</div>
                                    <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                                        {!isConfirmed && (
                                            <button
                                                onClick={() => setIsAutoCalc(!isAutoCalc)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                                    isAutoCalc 
                                                        ? 'bg-blue-600 text-white shadow-md' 
                                                        : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'
                                                }`}
                                            >
                                                <CheckCircle2 size={14} className={isAutoCalc ? 'opacity-100' : 'opacity-0 hidden'} />
                                                자동계산 {isAutoCalc ? 'ON' : 'OFF'}
                                            </button>
                                        )}
                                        {!isConfirmed && (
                                            <button
                                                onClick={handleAutoSum}
                                                title="참석자 수에 맞춰 잔여 표 자동 입력"
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200 transition-colors"
                                            >
                                                <Wand2 size={14} />
                                                잔여표 찬성 채우기
                                            </button>
                                        )}
                                        <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></div>
                                        <button
                                            onClick={handleResetEditableVotes}
                                            disabled={isConfirmed}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                                        >
                                            <Trash2 size={14} /> 초기화
                                        </button>
                                    </div>
                                </div>

                                <div className="hidden grid-cols-[minmax(100px,1fr)_1fr_auto_minmax(140px,1.5fr)_auto_1fr] gap-4 px-4 pb-2 text-xs font-bold uppercase tracking-wide text-slate-400 md:grid items-center">
                                    <div>구분</div>
                                    <div className="text-center">서면(고정)</div>
                                    <div className="w-4"></div>
                                    <div className="text-center text-blue-600">현장 입력</div>
                                    <div className="w-4"></div>
                                    <div className="text-center">총 합계</div>
                                </div>

                                <div className="space-y-2">
                                    {splitVoteDisplayCards.map((card) => (
                                        <div
                                            key={`${card.key}-row`}
                                            className={`grid grid-cols-1 md:grid-cols-[minmax(100px,1fr)_1fr_auto_minmax(140px,1.5fr)_auto_1fr] gap-3 items-center rounded-2xl border px-3 py-2 transition-colors ${card.tone.rowTint} hover:shadow-md`}
                                        >
                                            <div className="flex items-center justify-between md:block">
                                                <span className={`inline-flex rounded-lg border px-3 py-1.5 text-sm font-bold shadow-sm ${card.tone.labelBadge}`}>
                                                    {card.summaryLabel.replace('전체 ', '')}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between rounded-xl bg-white/60 px-4 py-3 md:bg-transparent md:px-0 md:py-0 md:justify-center">
                                                <span className="text-xs font-bold text-slate-400 md:hidden">서면(고정)</span>
                                                <span className={`font-mono text-xl font-bold ${card.tone.writtenText}`}>{card.writtenValue}</span>
                                            </div>

                                            <div className="hidden md:flex justify-center text-slate-300 font-black">+</div>

                                            <div className="relative">
                                                <div className={`mb-1 text-xs font-bold md:hidden ${card.tone.inputLabel}`}>현장 입력</div>
                                                <input
                                                    ref={card.key === 'yes' ? primaryOnsiteInputRef : null}
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={card.onsiteValue === 0 && !isConfirmed ? '' : card.onsiteValue}
                                                    placeholder="0"
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/[^0-9]/g, '');
                                                        handleVoteUpdate(card.updateField, val);
                                                    }}
                                                    disabled={isConfirmed}
                                                    className={`w-full rounded-xl border-2 bg-white px-3 py-2 text-center text-2xl md:text-3xl font-black shadow-sm outline-none disabled:bg-slate-100 disabled:text-slate-500 transition-all ${card.tone.inputBorder}`}
                                                />
                                            </div>

                                            <div className="hidden md:flex justify-center text-slate-300 font-black">=</div>

                                            <div className="flex items-center justify-between rounded-xl bg-white/60 px-4 py-3 md:bg-transparent md:px-0 md:py-0 md:justify-center">
                                                <span className="text-xs font-bold text-slate-400 md:hidden">총 합계</span>
                                                <div className="flex items-end gap-1">
                                                    <span className={`font-mono text-2xl font-black ${card.tone.totalText}`}>{card.totalValue}</span>
                                                    <span className="text-xs font-bold text-slate-400 mb-1">표</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        // Normal mode (non split columns)
                        <div className="space-y-3">
                            <div className="flex flex-col md:flex-row gap-4 items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex items-center gap-6 divide-x divide-slate-200">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-semibold text-slate-400 mb-1">총 투표수</span>
                                        <span className="text-2xl font-black text-blue-700">{totalVotesCast}<span className="text-sm font-normal ml-1">표</span></span>
                                    </div>
                                    <div className="flex flex-col pl-6">
                                        <span className="text-xs font-semibold text-slate-400 mb-1">성원(참석자)</span>
                                        <span className="text-xl font-bold text-slate-700">{displayStats.total}<span className="text-sm font-normal ml-1">명</span></span>
                                    </div>
                                </div>
                                <div className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 w-full md:w-auto md:min-w-[140px] transition-colors ${
                                    isVoteCountValid 
                                        ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                                        : 'bg-red-50 border-red-100 text-red-600 animate-pulse'
                                }`}>
                                    {isVoteCountValid ? (
                                        <>
                                            <CheckCircle2 size={24} className="mb-1 text-emerald-500" />
                                            <span className="text-sm font-bold">결과 일치 (검증됨)</span>
                                        </>
                                    ) : (
                                        <>
                                            <AlertTriangle size={24} className="mb-1" />
                                            <span className="text-sm font-bold">{displayStats.total - totalVotesCast}표 부족</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="mb-3 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-100 pb-3">
                                    <div className="text-lg font-black text-slate-800">투표 결과 직접 입력</div>
                                    <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                                        {!isConfirmed && (
                                            <button
                                                onClick={() => setIsAutoCalc(!isAutoCalc)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                                    isAutoCalc 
                                                        ? 'bg-blue-600 text-white shadow-md' 
                                                        : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'
                                                }`}
                                            >
                                                <CheckCircle2 size={14} className={isAutoCalc ? 'opacity-100' : 'opacity-0 hidden'} />
                                                자동계산 {isAutoCalc ? 'ON' : 'OFF'}
                                            </button>
                                        )}
                                        <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></div>
                                        <button
                                            onClick={handleResetEditableVotes}
                                            disabled={isConfirmed}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                                        >
                                            <Trash2 size={14} /> 초기화
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="flex flex-col gap-2 relative bg-emerald-50/50 p-4 border border-emerald-100 rounded-2xl transition-colors hover:bg-emerald-50">
                                        <label className="text-base font-bold text-emerald-800 flex justify-between items-center w-full">
                                            <span>찬성</span>
                                            {!isConfirmed && (
                                                <button
                                                    onClick={handleAutoSum}
                                                    title="참석자 수에 맞춰 잔여 표 자동 입력"
                                                    className="flex items-center gap-1 bg-white border border-emerald-200 px-2 py-1 hover:bg-emerald-100 rounded-lg text-emerald-700 transition-colors text-xs shadow-sm"
                                                >
                                                    <Wand2 size={12} /> 잔여표 채우기
                                                </button>
                                            )}
                                        </label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={editableVotesYes === 0 && !isConfirmed ? '' : editableVotesYes}
                                            placeholder="0"
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/[^0-9]/g, '');
                                                handleVoteUpdate(editableVoteFieldMap.yes, val);
                                            }}
                                            disabled={isConfirmed}
                                            className="w-full p-4 border-2 border-emerald-200 rounded-xl text-center text-4xl font-black text-emerald-800 bg-white shadow-inner outline-none caret-emerald-700 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-100 disabled:text-slate-500 transition-all"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2 bg-red-50/50 p-4 border border-red-100 rounded-2xl transition-colors hover:bg-red-50">
                                        <label className="text-base font-bold text-red-800">반대</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={editableVotesNo === 0 && !isConfirmed ? '' : editableVotesNo}
                                            placeholder="0"
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/[^0-9]/g, '');
                                                handleVoteUpdate(editableVoteFieldMap.no, val);
                                            }}
                                            disabled={isConfirmed}
                                            className="w-full p-4 border-2 border-red-200 rounded-xl text-center text-4xl font-black text-red-800 bg-white shadow-inner outline-none caret-red-700 focus:border-red-500 focus:ring-4 focus:ring-red-100 disabled:bg-slate-100 disabled:text-slate-500 transition-all"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2 bg-slate-50/50 p-4 border border-slate-200 rounded-2xl transition-colors hover:bg-slate-50">
                                        <label className="text-base font-bold text-slate-600">기권/무효</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={editableVotesAbstain === 0 && !isConfirmed ? '' : editableVotesAbstain}
                                            placeholder="0"
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/[^0-9]/g, '');
                                                handleVoteUpdate(editableVoteFieldMap.abstain, val);
                                            }}
                                            disabled={isConfirmed}
                                            className="w-full p-4 border-2 border-slate-200 rounded-xl text-center text-4xl font-black text-slate-600 bg-white shadow-inner outline-none caret-slate-600 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 disabled:bg-slate-100 disabled:text-slate-400 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </Card>
            </section>

            {/* Section 3: Declaration */}
            <section>
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-bold text-slate-600 uppercase tracking-wider">
                        03. 선포 문구
                    </h3>
                    {isEditingDeclaration && !isConfirmed ? (
                        <button
                            onClick={() => {
                                saveDeclaration(); // Save to DB first
                                setIsEditingDeclaration(false);
                            }}
                            className="text-xs flex items-center gap-1 px-3 py-1 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 transition-colors font-medium"
                        >
                            ✓ 완료
                        </button>
                    ) : (
                        <button
                            onClick={() => {
                                if (isConfirmed) return;
                                const initialDeclaration = declaration || generateDefaultDeclaration();
                                setDeclarationDraft({ agendaId: currentAgendaId, value: initialDeclaration });
                                setDeclarationEditMode(currentAgendaId, true, false);
                            }}
                            disabled={isConfirmed}
                            className={`text-xs flex items-center gap-1 px-3 py-1 rounded-full transition-colors font-medium ${isConfirmed ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                            ✎ 편집
                        </button>
                    )}
                </div>

                <Card className="p-4">
                    <textarea
                        value={isEditingDeclaration ? localDeclaration : (declaration || '')}
                        onChange={(e) => setDeclarationDraft({ agendaId: currentAgendaId, value: e.target.value })}
                        disabled={!isEditingDeclaration || isConfirmed}
                        placeholder={isEditingDeclaration ? "선포문구를 입력하세요..." : "편집 버튼을 클릭하면 자동 생성됩니다."}
                        rows={Math.max(4, ((isEditingDeclaration ? localDeclaration : declaration) || '').split('\n').length + 1)}
                        className={`w-full p-3 border rounded-lg outline-none text-xl font-serif resize-none min-h-[120px] shadow-inner leading-relaxed transition-colors ${isEditingDeclaration && !isConfirmed
                            ? 'border-blue-300 bg-white text-slate-700 focus:ring-2 focus:ring-blue-500'
                            : 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed'
                            }`}
                    />
                    {isConfirmed && (
                        <div className="mt-2 text-xs text-slate-400 text-right">
                            * 이 선포문은 의결 확정 시점에 고정되었습니다.
                        </div>
                    )}
                </Card>
            </section>
            
            {/* Section 4: Final Confirmation */}
            <section className="mt-8 pt-8 border-t-2 border-slate-100">
                <div className="flex flex-col items-center justify-center p-8 bg-slate-50 border border-slate-200 rounded-3xl shadow-sm">
                    <h3 className="text-xl font-bold text-slate-800 mb-2">
                        04. 최종 결과 확정
                    </h3>
                    <p className="text-slate-500 mb-6 text-center">
                        모든 출석율과 투표 인원이 오류 없이 정상적으로 표기되었는지 확인해 주세요.
                    </p>

                    {isConfirmed ? (
                        <div className="flex flex-col items-center gap-4">
                            <div className="flex items-center gap-2 text-blue-700 font-bold bg-blue-50/50 border border-blue-100 px-6 py-3 rounded-xl shadow-sm">
                                <CheckCircle2 size={24} />
                                현재 안건의 의결 결과가 안전하게 확정되어 잠겼습니다.
                            </div>
                            <button
                                onClick={() => {
                                    handleResetDecision();
                                    setIsReadyToConfirm(false);
                                }}
                                className="mt-2 flex items-center gap-2 text-slate-500 bg-white border border-slate-200 px-5 py-2.5 rounded-xl hover:bg-slate-100 transition-all font-semibold"
                            >
                                <Unlock size={18} />
                                확정 취소 및 수정하기
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-3 w-full max-w-sm">
                            <label className="flex items-center justify-center gap-3 w-full p-4 border border-slate-200 rounded-xl bg-white cursor-pointer hover:bg-slate-50 select-none shadow-sm transition-all focus-within:ring-2 focus-within:ring-slate-200">
                                <input 
                                    type="checkbox" 
                                    className="w-5 h-5 accent-blue-600 cursor-pointer rounded" 
                                    checked={isReadyToConfirm}
                                    onChange={(e) => setIsReadyToConfirm(e.target.checked)}
                                />
                                <span className="font-semibold text-slate-700">모든 결과를 확인하였으며, 확정합니다.</span>
                            </label>
                            <button
                                onClick={() => {
                                    handleConfirmDecision();
                                }}
                                disabled={!isReadyToConfirm}
                                className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl transition-all font-bold text-xl ${
                                    isReadyToConfirm 
                                    ? 'bg-blue-600 border border-blue-700 text-white hover:bg-blue-700 hover:shadow-lg shadow-md' 
                                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none opacity-80'
                                }`}
                            >
                                <Lock size={22} className={isReadyToConfirm ? 'text-white/90' : 'opacity-50'} />
                                안건 결과 최종 확정
                            </button>
                        </div>
                    )}
                </div>
            </section>

            {/* Custom Confirm Modal */}
            {confirmModalState.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 text-slate-800 mb-4">
                            {confirmModalState.type === 'confirm' ? (
                                <div className="p-2 bg-blue-100 text-blue-600 rounded-full">
                                    <Lock size={20} />
                                </div>
                            ) : (
                                <div className="p-2 bg-slate-100 text-slate-500 rounded-full">
                                    <Unlock size={20} />
                                </div>
                            )}
                            <h3 className="text-xl font-bold">
                                {confirmModalState.type === 'confirm' ? '의결 확정 확인' : '확정 취소 확인'}
                            </h3>
                        </div>
                        <div className="text-slate-600 leading-relaxed mb-8 whitespace-pre-line text-[15px]">
                            {confirmModalState.type === 'confirm' 
                                ? "현재 기록 상태로 안건 의결 결과를 확정하시겠습니까?\n\n이후 실시간 성원이 변동되어도 결과는 영구 고정됩니다."
                                : "이미 확정된 안건 결과를 취소하시겠습니까?\n\n안건이 다시 실시간 성원 데이터에 연동되어 변동될 수 있습니다."}
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setConfirmModalState({ isOpen: false, type: null })}
                                className="px-5 py-2.5 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold transition-colors disabled:opacity-50"
                            >
                                되돌아기기
                            </button>
                            <button
                                onClick={executeModalAction}
                                className={`px-5 py-2.5 rounded-xl text-white font-semibold shadow-sm transition-all focus:ring-4 ${
                                    confirmModalState.type === 'confirm' 
                                    ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-100' 
                                    : 'bg-slate-700 hover:bg-slate-800 focus:ring-slate-200'
                                }`}
                            >
                                {confirmModalState.type === 'confirm' ? '네, 확정합니다' : '네, 취소합니다'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
