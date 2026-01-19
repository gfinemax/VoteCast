'use client';

import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { CheckCircle2, AlertTriangle, Trash2, Lock, Unlock, RotateCcw, Save, Wand2 } from 'lucide-react';
import Card from '@/components/ui/Card';

export default function VoteControl() {
    const { state, actions } = useStore();
    const { members, attendance, agendas, currentAgendaId } = state;

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

        const relevantRecords = attendance.filter(a => a.meeting_id === meetingId);
        const direct = relevantRecords.filter(a => a.type === 'direct').length;
        const proxy = relevantRecords.filter(a => a.type === 'proxy').length;
        const written = relevantRecords.filter(a => a.type === 'written').length;

        return {
            direct,
            proxy,
            written,
            total: direct + proxy + written
        };
    }, [attendance, meetingId]);

    // SNAPSHOT HANDLING
    const snapshot = currentAgenda?.vote_snapshot;
    const isConfirmed = !!snapshot;

    // Use Snapshot if confirmed, otherwise Realtime
    const displayStats = isConfirmed ? snapshot.stats : realtimeStats;

    // Vote Data Sources
    const votesYes = isConfirmed ? snapshot.votes.yes : (currentAgenda?.votes_yes || 0);
    const votesNo = isConfirmed ? snapshot.votes.no : (currentAgenda?.votes_no || 0);
    const votesAbstain = isConfirmed ? snapshot.votes.abstain : (currentAgenda?.votes_abstain || 0);
    const declaration = isConfirmed ? snapshot.declaration : (currentAgenda?.declaration || '');

    // Vote Type Map
    const normalizeType = (type) => {
        if (type === 'general') return 'majority';
        if (type === 'special') return 'twoThirds';
        return type || 'majority';
    };
    const currentAgendaType = normalizeType(currentAgenda?.type);
    const isSpecialVote = currentAgendaType === 'twoThirds';
    const isElection = currentAgendaType === 'election';

    // Targets (Based on Snapshot or Realtime totalMembers)
    // Note: If total members changed (removed from DB), snapshot should logically preserve it? 
    // Usually total members is stable, but let's assume Members list is realtime reference OR snapshot if we saved it.
    // For now, using realtime totalMembers is likely acceptable unless members were deleted.
    const totalMembers = members.length;

    // Recalculate Logic based on DISPLAY stats
    const quorumTarget = isSpecialVote
        ? Math.ceil(totalMembers * (2 / 3))
        : Math.ceil(totalMembers / 2);

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
    const generateDefaultDeclaration = () => {
        if (!currentAgenda || displayStats.total === 0) return '';

        const criterion = isSpecialVote ? "3분의 2 이상" : "과반수 이상";

        return `"${currentAgenda.title}" 서면결의 포함 찬성(${votesYes})표, 반대(${votesNo})표, 기권(${votesAbstain})표로
전체 참석자(${displayStats.total.toLocaleString()})명중 ${criterion} ${isPassed ? '찬성으로' : '찬성 미달로'}
"${currentAgenda.title}"은 ${isPassed ? '가결' : '부결'}되었음을 선포합니다.`;
    };

    // Use GLOBAL state for declaration editing (prevents revert on re-render)
    const declarationEditState = state.declarationEditState?.[currentAgendaId] || { isEditing: false, isAutoCalc: true };
    const isEditingDeclaration = declarationEditState.isEditing;
    const isAutoCalc = declarationEditState.isAutoCalc;

    // LOCAL declaration state for editing (doesn't trigger realtime sync)
    const [localDeclaration, setLocalDeclaration] = useState(declaration || '');

    // Sync localDeclaration with server when NOT editing
    useEffect(() => {
        if (!isEditingDeclaration) {
            setLocalDeclaration(declaration || '');
        }
    }, [declaration, isEditingDeclaration]);

    const setIsEditingDeclaration = (value) => {
        actions.setDeclarationEditMode(currentAgendaId, value, isAutoCalc);
    };
    const setIsAutoCalc = (value) => {
        actions.setDeclarationEditMode(currentAgendaId, isEditingDeclaration, value);
    };

    // Save declaration to DB (called when clicking Done)
    const saveDeclaration = useCallback(() => {
        if (currentAgenda && localDeclaration !== declaration) {
            actions.updateAgenda({ id: currentAgenda.id, declaration: localDeclaration });
        }
    }, [currentAgenda, localDeclaration, declaration, actions]);

    // Declaration Auto-Update (only when NOT editing)
    useEffect(() => {
        if (!currentAgenda || isEditingDeclaration || isConfirmed) return;
        if (isAutoCalc) {
            const newDecl = generateDefaultDeclaration();
            if (newDecl !== currentAgenda.declaration) {
                actions.updateAgenda({ id: currentAgenda.id, declaration: newDecl });
            }
        }
    }, [isAutoCalc, votesYes, votesNo, votesAbstain, displayStats, currentAgenda, isConfirmed, isEditingDeclaration]);


    // Handlers
    const handleTypeChange = (newType) => {
        if (currentAgenda && !isConfirmed) { // Cannot change type if confirmed
            actions.updateAgenda({ id: currentAgenda.id, type: newType });
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
            if (field === 'votes_yes') {
                const currentAbstain = votesAbstain;
                const textNo = Math.max(0, displayStats.total - value - currentAbstain);
                updates.votes_no = textNo;
            } else if (field === 'votes_no') {
                const currentAbstain = votesAbstain;
                const testYes = Math.max(0, displayStats.total - value - currentAbstain);
                updates.votes_yes = testYes;
            } else if (field === 'votes_abstain') {
                const currentYes = votesYes;
                const testNo = Math.max(0, displayStats.total - currentYes - value);
                updates.votes_no = testNo;
            }
        }

        actions.updateAgenda({ id: currentAgenda.id, ...updates });
    };

    const handleAutoSum = () => {
        if (isConfirmed || !currentAgenda) return;
        // Calculate remaining for 'Yes' based on 'No' and 'Abstain'
        const remainder = Math.max(0, displayStats.total - votesNo - votesAbstain);
        handleVoteUpdate('votes_yes', remainder);
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
        actions.updateAgenda({ id: currentAgenda.id, vote_snapshot: snapshotData });
    };

    const handleResetDecision = () => {
        if (!confirm("확정을 취소하시겠습니까?\n다시 실시간 성원 데이터가 반영됩니다.")) return;
        actions.updateAgenda({ id: currentAgenda.id, vote_snapshot: null });
    };

    if (!currentAgenda) return <div className="p-10 text-center text-slate-400">안건을 선택해주세요.</div>;

    // Helper for Total Votes Cast
    const totalVotesCast = votesYes + votesNo + votesAbstain;
    const isVoteCountValid = totalVotesCast === displayStats.total;


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
                    <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                        <button
                            onClick={() => handleTypeChange('majority')}
                            disabled={isConfirmed}
                            className={`px - 3 py - 1 text - xs font - bold rounded transition - all ${currentAgendaType === 'majority' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'} disabled: opacity - 50 disabled: cursor - not - allowed`}
                        >
                            일반
                        </button>
                        <button
                            onClick={() => handleTypeChange('election')}
                            disabled={isConfirmed}
                            className={`px - 3 py - 1 text - xs font - bold rounded transition - all ${currentAgendaType === 'election' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'} disabled: opacity - 50 disabled: cursor - not - allowed`}
                        >
                            선거
                        </button>
                        <button
                            onClick={() => handleTypeChange('twoThirds')}
                            disabled={isConfirmed}
                            className={`px - 3 py - 1 text - xs font - bold rounded transition - all ${currentAgendaType === 'twoThirds' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'} disabled: opacity - 50 disabled: cursor - not - allowed`}
                        >
                            해산/규약
                        </button>
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
                                className={`h - full transition - all duration - 500 ${isQuorumSatisfied ? 'bg-emerald-500' : 'bg-red-500'} `}
                                style={{ width: `${Math.min(100, (displayStats.total / (totalMembers || 1)) * 100)}% ` }}
                            ></div>
                        </div>

                        <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-400">
                                개회 기준: {quorumTarget}명
                                {isElection && <span className="text-emerald-400 ml-1"> + 직접 {directTarget}명(20%)</span>}
                            </span>
                            <span className={`font - bold ${isQuorumSatisfied ? 'text-emerald-400' : 'text-red-400'} `}>
                                {isQuorumSatisfied
                                    ? '조건 충족 (개회 가능)'
                                    : `미달 ${!isDirectSatisfied ? '(직접참석 부족)' : `(${Math.max(0, quorumTarget - displayStats.total)}명 부족)`} `}
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
                            onClick={() => {
                                handleVoteUpdate('votes_yes', 0);
                                handleVoteUpdate('votes_no', 0);
                                handleVoteUpdate('votes_abstain', 0);
                            }}
                            disabled={isConfirmed}
                            className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 ml-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Trash2 size={12} /> 초기화
                        </button>
                    </div>
                </div>
                <Card className={`p-6 ${isConfirmed ? 'bg-slate-50' : 'bg-white'}`}>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="flex flex-col items-center gap-2 relative">
                            <label className="block text-sm font-bold text-emerald-700 text-center flex items-center gap-1">
                                찬성
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
                                value={votesYes === 0 && isEditingDeclaration ? '' : votesYes}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                    handleVoteUpdate('votes_yes', val);
                                }}
                                onFocus={(e) => e.target.select()}
                                disabled={isConfirmed}
                                className="w-full p-3 border-2 border-emerald-100 rounded-lg focus:border-emerald-500 outline-none text-center text-3xl font-black text-emerald-700 shadow-sm disabled:bg-slate-100 disabled:text-slate-500"
                            />
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <label className="block text-sm font-bold text-red-700 text-center">반대</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={votesNo === 0 && isEditingDeclaration ? '' : votesNo}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                    handleVoteUpdate('votes_no', val);
                                }}
                                onFocus={(e) => e.target.select()}
                                disabled={isConfirmed}
                                className="w-full p-3 border-2 border-red-100 rounded-lg focus:border-red-500 outline-none text-center text-3xl font-black text-red-700 shadow-sm disabled:bg-slate-100 disabled:text-slate-500"
                            />
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <label className="block text-sm font-bold text-slate-500 text-center">기권/무효</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={votesAbstain === 0 && isEditingDeclaration ? '' : votesAbstain}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                    handleVoteUpdate('votes_abstain', val);
                                }}
                                onFocus={(e) => e.target.select()}
                                disabled={isConfirmed}
                                className="w-full p-3 border-2 border-slate-200 rounded-lg focus:border-slate-400 outline-none text-center text-3xl font-black text-slate-500 shadow-sm disabled:bg-slate-100 disabled:text-slate-400"
                            />
                        </div>
                    </div>

                    <div className={`p-3 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors ${isVoteCountValid ? 'bg-slate-50 text-slate-600' : 'bg-red-50 text-red-600 animate-pulse'}`}>
                        {isVoteCountValid ? (
                            <>
                                <CheckCircle2 size={16} className="text-emerald-500" />
                                합계 일치 확인완료
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
                                // Initialize local declaration if empty, then set auto-generated
                                if (!declaration) {
                                    const generatedDecl = generateDefaultDeclaration();
                                    actions.updateAgenda({ id: currentAgenda.id, declaration: generatedDecl });
                                    setLocalDeclaration(generatedDecl);
                                } else {
                                    setLocalDeclaration(declaration);
                                }
                                actions.setDeclarationEditMode(currentAgendaId, true, false);
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
                        onChange={(e) => setLocalDeclaration(e.target.value)}
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
        </div >
    );
}
