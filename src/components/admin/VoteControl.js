'use client';

import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { getAgendaVoteBuckets, getAttendanceQuorumTarget, normalizeAgendaType } from '@/lib/store';
import { CheckCircle2, AlertTriangle, Trash2, Lock, Unlock, RotateCcw, Save, Wand2 } from 'lucide-react';
import Card from '@/components/ui/Card';

const EMPTY_INACTIVE_MEMBER_IDS = [];

export default function VoteControl() {
    const { state, actions } = useStore();
    const { updateAgenda, setDeclarationEditMode, setAgendaTypeLock } = actions;
    const { members, attendance, agendas, currentAgendaId, voteData } = state;
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
        if (!meetingId) return { direct: 0, proxy: 0, written: 0, total: 0 };

        const relevantRecords = attendance.filter(
            (a) => a.meeting_id === meetingId && activeMemberIdSet.has(a.member_id)
        );
        const direct = relevantRecords.filter(a => a.type === 'direct').length;
        const proxy = relevantRecords.filter(a => a.type === 'proxy').length;
        const written = relevantRecords.filter(a => a.type === 'written').length;

        return {
            direct,
            proxy,
            written,
            total: direct + proxy + written
        };
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
        if (!confirm("현재 상태로 의결을 확정하시겠습니까?\n이후 성원이 변경되어도 결과는 고정됩니다.")) return;

        const snapshotData = {
            stats: realtimeStats,
            votes: { yes: votesYes, no: votesNo, abstain: votesAbstain },
            declaration: currentAgenda.declaration, // current value
            result: isPassed ? 'PASSED' : 'FAILED',
            timestamp: new Date().toISOString()
        };
        updateAgenda({ id: currentAgenda.id, vote_snapshot: snapshotData });
    };

    const handleResetDecision = () => {
        if (!confirm("확정을 취소하시겠습니까?\n다시 실시간 성원 데이터가 반영됩니다.")) return;
        updateAgenda({ id: currentAgenda.id, vote_snapshot: null });
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


    return (
        <div className="space-y-6 pb-20">
            {/* Header Section */}
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        {currentAgenda.title}
                        <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {isSpecialVote ? '특별결의(2/3)' : '일반결의(과반)'}
                        </span>
                    </h2>
                </div>

                {/* Confirm/Reset Actions */}
                <div className="flex gap-2">
                    {isConfirmed ? (
                        <button
                            onClick={handleResetDecision}
                            className="flex items-center gap-2 bg-slate-600 text-white px-4 py-2 rounded-lg hover:bg-slate-700 shadow transition-all text-sm"
                        >
                            <Unlock size={18} />
                            확정취소
                        </button>
                    ) : (
                        <button
                            onClick={handleConfirmDecision}
                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 shadow transition-all text-sm"
                        >
                            <Lock size={18} />
                            의결확정
                        </button>
                    )}
                </div>
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
                <div className="flex justify-between items-end mb-3">
                    <h3 className="text-lg font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                        01. 성원(참석) 집계
                        <span className="text-xs font-normal text-slate-400 normal-case ml-2">
                            (참조: {agendas.find(a => a.id === meetingId)?.title || '미지정'})
                        </span>
                        {isConfirmed && <span className="text-xs bg-slate-200 text-slate-600 px-1.5 rounded">고정됨</span>}
                    </h3>

                    {/* Vote Type Selector */}
                    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
                        <button
                            type="button"
                            onClick={toggleTypeLock}
                            disabled={isConfirmed}
                            title={isTypeLocked ? '투표 유형 잠금 해제' : '투표 유형 잠금'}
                            className={`flex h-11 w-11 items-center justify-center rounded-xl border transition-all ${
                                isTypeLocked
                                    ? 'border-slate-800 bg-slate-900 text-white shadow-sm'
                                    : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700'
                            } disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400`}
                        >
                            {isTypeLocked ? <Lock size={15} /> : <Unlock size={15} />}
                        </button>

                        <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-slate-50 p-1">
                            {voteTypeOptions.map((option) => (
                                <div key={option.value} className="group relative">
                                    <button
                                        onClick={() => handleTypeChange(option.value)}
                                        disabled={isConfirmed || isTypeLocked}
                                        className={`min-w-[92px] rounded-lg border px-4 py-2 text-sm font-semibold whitespace-nowrap transition-all ${
                                            currentAgendaType === option.value
                                                ? option.activeClass
                                                : 'border-transparent bg-transparent text-slate-500 hover:border-slate-200 hover:bg-white hover:text-slate-700'
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
                            ))}
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
                                {isElection && <span className="text-emerald-400 ml-1"> + 직접 {directTarget}명(20%)</span>}
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
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsAutoCalc(!isAutoCalc)}
                            disabled={isConfirmed}
                            className={`text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors ${isAutoCalc ? 'bg-blue-100 text-blue-700 font-bold' : 'bg-slate-100 text-slate-400'} disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            <CheckCircle2 size={12} className={isAutoCalc ? 'opacity-100' : 'opacity-0'} />
                            자동계산 {isAutoCalc ? 'ON' : 'OFF'}
                        </button>
                        <button
                            onClick={handleResetEditableVotes}
                            disabled={isConfirmed}
                            className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 ml-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Trash2 size={12} /> {hasSplitVoteColumns ? '현장 초기화' : '초기화'}
                        </button>
                    </div>
                </div>
                <Card className={`p-6 ${isConfirmed ? 'bg-slate-50' : 'bg-white'}`}>
                    {hasSplitVoteColumns && (
                        <div className="mb-4 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                            <div className="font-medium text-slate-600">
                                서면 고정 <span className="font-mono font-bold text-slate-800">{totalWrittenVotes}</span>표
                                <span className="mx-2 text-slate-300">+</span>
                                현장 입력 <span className="font-mono font-bold text-slate-800">{editableVotesYes + editableVotesNo + editableVotesAbstain}</span>표
                                <span className="mx-2 text-slate-300">=</span>
                                총 <span className="font-mono font-bold text-blue-700">{totalVotesCast}</span>표
                            </div>
                            {!isConfirmed && <div className="text-xs text-slate-500">서면결의 반영분은 초기화되지 않습니다.</div>}
                        </div>
                    )}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="flex flex-col items-center gap-2 relative">
                            <label className="block text-sm font-bold text-emerald-700 text-center flex items-center gap-1">
                                {hasSplitVoteColumns ? '찬성(현장)' : '찬성'}
                                {!isConfirmed && (
                                    <button
                                        onClick={handleAutoSum}
                                        title="참석자 수에 맞춰 잔여 표 자동 입력"
                                        className="p-1 hover:bg-emerald-100 rounded text-emerald-600 transition-colors"
                                    >
                                        <Wand2 size={12} />
                                    </button>
                                )}
                            </label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={editableVotesYes === 0 && isEditingDeclaration ? '' : editableVotesYes}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                    handleVoteUpdate(editableVoteFieldMap.yes, val);
                                }}
                                onFocus={(e) => e.target.select()}
                                disabled={isConfirmed}
                                className="w-full p-3 border-2 border-emerald-100 rounded-lg focus:border-emerald-500 outline-none text-center text-3xl font-black text-emerald-700 shadow-sm disabled:bg-slate-100 disabled:text-slate-500"
                            />
                            {hasSplitVoteColumns && (
                                <div className="w-full rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                                    <div className="flex justify-between"><span>서면</span><span className="font-mono font-semibold">{writtenVoteTotals.yes}</span></div>
                                    <div className="mt-1 flex justify-between"><span>합계</span><span className="font-mono font-bold">{votesYes}</span></div>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <label className="block text-sm font-bold text-red-700 text-center">{hasSplitVoteColumns ? '반대(현장)' : '반대'}</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={editableVotesNo === 0 && isEditingDeclaration ? '' : editableVotesNo}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                    handleVoteUpdate(editableVoteFieldMap.no, val);
                                }}
                                onFocus={(e) => e.target.select()}
                                disabled={isConfirmed}
                                className="w-full p-3 border-2 border-red-100 rounded-lg focus:border-red-500 outline-none text-center text-3xl font-black text-red-700 shadow-sm disabled:bg-slate-100 disabled:text-slate-500"
                            />
                            {hasSplitVoteColumns && (
                                <div className="w-full rounded-lg bg-red-50 px-3 py-2 text-xs text-red-900">
                                    <div className="flex justify-between"><span>서면</span><span className="font-mono font-semibold">{writtenVoteTotals.no}</span></div>
                                    <div className="mt-1 flex justify-between"><span>합계</span><span className="font-mono font-bold">{votesNo}</span></div>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <label className="block text-sm font-bold text-slate-500 text-center">{hasSplitVoteColumns ? '기권/무효(현장)' : '기권/무효'}</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={editableVotesAbstain === 0 && isEditingDeclaration ? '' : editableVotesAbstain}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                    handleVoteUpdate(editableVoteFieldMap.abstain, val);
                                }}
                                onFocus={(e) => e.target.select()}
                                disabled={isConfirmed}
                                className="w-full p-3 border-2 border-slate-200 rounded-lg focus:border-slate-400 outline-none text-center text-3xl font-black text-slate-500 shadow-sm disabled:bg-slate-100 disabled:text-slate-400"
                            />
                            {hasSplitVoteColumns && (
                                <div className="w-full rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
                                    <div className="flex justify-between"><span>서면</span><span className="font-mono font-semibold">{writtenVoteTotals.abstain}</span></div>
                                    <div className="mt-1 flex justify-between"><span>합계</span><span className="font-mono font-bold">{votesAbstain}</span></div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={`p-3 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors ${isVoteCountValid ? 'bg-slate-50 text-slate-600' : 'bg-red-50 text-red-600 animate-pulse'}`}>
                        {isVoteCountValid ? (
                            <>
                                <CheckCircle2 size={16} className="text-emerald-500" />
                                {hasSplitVoteColumns ? '총 투표수(서면+현장) 일치 확인완료' : '합계 일치 확인완료'}
                            </>
                        ) : (
                            <>
                                <AlertTriangle size={16} />
                                주의: 총 {totalVotesCast}표 (참석자 {displayStats.total}명)
                            </>
                        )}
                    </div>

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
        </div>
    );
}
