'use client';

import React, { useMemo, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react';
import Card from '@/components/ui/Card';

export default function VoteControl() {
    const { state, actions } = useStore();
    const { voteData, members } = state;

    // Agenda & Declaration Logic - FIRST, before any derived values
    const currentAgenda = state.agendas.find(a => a.id === state.currentAgendaId);

    // Vote Type Map for compatibility (general -> majority, special -> twoThirds)
    const normalizeType = (type) => {
        if (type === 'general') return 'majority';
        if (type === 'special') return 'twoThirds';
        return type || 'majority';
    };

    // **FIX**: Source of truth is currentAgenda.type, NOT voteData.voteType
    const currentAgendaType = normalizeType(currentAgenda?.type);

    const isSpecialVote = currentAgendaType === 'twoThirds';
    const isElection = currentAgendaType === 'election';

    const totalAttendance = (parseInt(voteData.writtenAttendance) || 0) +
        (parseInt(voteData.directAttendance) || 0) +
        (parseInt(voteData.proxyAttendance) || 0);

    // 1. Quorum Target
    const quorumTarget = isSpecialVote
        ? Math.ceil((voteData.totalMembers || 0) * (2 / 3))
        : Math.ceil((voteData.totalMembers || 0) / 2);

    // 2. Direct Attendance Check (Election only)
    const directTarget = Math.ceil((voteData.totalMembers || 0) * 0.2);
    const isDirectSatisfied = !isElection || (voteData.directAttendance >= directTarget);
    const isQuorumSatisfied = (totalAttendance >= quorumTarget) && isDirectSatisfied;

    const liveDirectAttendance = useMemo(() => {
        return members.filter(m => m.isCheckedIn && m.checkInType !== 'proxy').length;
    }, [members]);

    const liveProxyAttendance = useMemo(() => {
        return members.filter(m => m.isCheckedIn && m.checkInType === 'proxy').length;
    }, [members]);

    const [isInitialized, setIsInitialized] = React.useState(false);
    useEffect(() => {
        if (!isInitialized) {
            if (liveDirectAttendance > voteData.directAttendance) {
                actions.updateVoteData('directAttendance', liveDirectAttendance);
            }
            if (liveProxyAttendance > voteData.proxyAttendance) {
                actions.updateVoteData('proxyAttendance', liveProxyAttendance);
            }
            setIsInitialized(true);
        } else {
            if (liveDirectAttendance !== voteData.directAttendance) {
                actions.updateVoteData('directAttendance', liveDirectAttendance);
            }
            if (liveProxyAttendance !== voteData.proxyAttendance) {
                actions.updateVoteData('proxyAttendance', liveProxyAttendance);
            }
        }
    }, [liveDirectAttendance, liveProxyAttendance, isInitialized, voteData.directAttendance, voteData.proxyAttendance, actions]);

    const generateDefaultDeclaration = () => {
        if (!currentAgenda || totalAttendance === 0) return '';
        const criterion = isSpecialVote ? "3분의 2 이상" : "과반수 이상";
        const votesYes = voteData.votesYes || 0;
        const votesNo = voteData.votesNo || 0;
        const votesAbstain = voteData.votesAbstain || 0;

        return `"${currentAgenda.title}" 서면결의 포함 찬성(${votesYes})표, 반대(${votesNo})표, 기권(${votesAbstain})표로
전체 참석자(${totalAttendance.toLocaleString()})명중 ${criterion} 찬성으로
"${currentAgenda.title}"은 가결되었음을 선포합니다.`;
    };

    // Edit mode state for declaration
    const [isEditingDeclaration, setIsEditingDeclaration] = React.useState(false);

    // Auto-generate declaration when empty and entering edit mode
    const handleStartEdit = () => {
        if (currentAgenda && (!currentAgenda.declaration || currentAgenda.declaration.trim() === '')) {
            // Auto-generate template when empty
            actions.updateAgenda({ id: currentAgenda.id, declaration: generateDefaultDeclaration() });
        }
        setIsEditingDeclaration(true);
    };

    const handleFinishEdit = () => {
        setIsEditingDeclaration(false);
    };

    // Handler to save declaration per-agenda
    const handleDeclarationChange = (value) => {
        if (currentAgenda) {
            actions.updateAgenda({ id: currentAgenda.id, declaration: value });
        }
    };

    // Handler to change type - ONLY updates the Agenda record
    const handleSetType = (newType) => {
        if (currentAgenda) {
            actions.updateAgenda({ id: currentAgenda.id, type: newType });
        }
    };

    const totalVotesCast = (parseInt(voteData.votesYes) || 0) + (parseInt(voteData.votesNo) || 0) + (parseInt(voteData.votesAbstain) || 0);
    const isVoteCountValid = totalAttendance === totalVotesCast;

    return (
        <div className="space-y-3">
            {/* Section 1: Attendance */}
            <section>
                <div className="flex justify-between items-end mb-3">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        01. 성원(참석) 집계

                    </h3>

                    {/* Vote Type Selector */}
                    <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                        <button
                            onClick={() => handleSetType('majority')}
                            className={`px-3 py-1 text-xs font-bold rounded transition-all ${currentAgendaType === 'majority' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            일반
                        </button>
                        <button
                            onClick={() => handleSetType('election')}
                            className={`px-3 py-1 text-xs font-bold rounded transition-all ${currentAgendaType === 'election' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            선거 (직접20%)
                        </button>
                        <button
                            onClick={() => handleSetType('twoThirds')}
                            className={`px-3 py-1 text-xs font-bold rounded transition-all ${currentAgendaType === 'twoThirds' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            해산/규약
                        </button>
                    </div>
                </div>

                <Card className="p-4 space-y-3">
                    {/* Total Members & Quorum Check */}
                    <div className="bg-slate-800 text-white p-3 rounded-lg mb-2 shadow-inner">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-bold text-slate-300">전체 조합원 수 (기준)</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    value={voteData.totalMembers || ''}
                                    onChange={(e) => actions.updateVoteData('totalMembers', parseInt(e.target.value) || 0)}
                                    placeholder="0"
                                    className="w-24 p-1 bg-slate-700 border border-slate-600 rounded text-right font-mono text-white focus:ring-1 focus:ring-blue-500 outline-none"
                                />
                                <span className="text-sm text-slate-400">명</span>
                            </div>
                        </div>

                        <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden mb-2 relative">
                            {/* Quorum Marker (66% or 50%) */}
                            <div className="absolute top-0 bottom-0 w-0.5 bg-white/50 z-10" style={{ left: isSpecialVote ? '66.66%' : '50%' }}></div>
                            <div
                                className={`h-full transition-all duration-500 ${isQuorumSatisfied ? 'bg-emerald-500' : 'bg-red-500'}`}
                                style={{ width: `${Math.min(100, (totalAttendance / (voteData.totalMembers || 1)) * 100)}%` }}
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
                                    : `미달 ${!isDirectSatisfied ? '(직접참석 부족)' : `(${Math.max(0, quorumTarget - totalAttendance)}명 부족)`}`}
                            </span>
                        </div>
                    </div>

                    <div className="bg-slate-50 p-3 rounded border border-slate-100 mb-2">
                        <div className="flex justify-between items-center text-sm mb-1">
                            <span className="text-slate-500">실시간 현장 입장 (전체)</span>
                            <span className="text-emerald-600 font-bold flex items-center gap-1 text-xs">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                Live Sync
                            </span>
                        </div>
                        <div className="flex items-baseline gap-2 mb-1">
                            <div className="text-3xl font-mono font-bold text-slate-800">
                                {liveDirectAttendance + liveProxyAttendance}명
                            </div>
                            <div className="text-sm font-medium text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-100 shadow-sm">
                                <span className="text-emerald-600">조합원 {liveDirectAttendance}</span>
                                <span className="mx-1 text-slate-300">|</span>
                                <span className="text-orange-500">대리 {liveProxyAttendance}</span>
                            </div>
                        </div>
                        {isElection && (
                            <div className={`text-xs font-bold mt-1 ${isDirectSatisfied ? 'text-emerald-600' : 'text-red-500'}`}>
                                * 직접참석비율: {((liveDirectAttendance / (voteData.totalMembers || 1)) * 100).toFixed(1)}% (기준 20% / {directTarget}명)
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        {/* 1. Member (Direct) */}
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">조합원 (현장)</label>
                            <input
                                type="number"
                                value={voteData.directAttendance || 0}
                                onChange={(e) => actions.updateVoteData('directAttendance', parseInt(e.target.value) || 0)}
                                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-slate-500 outline-none text-right font-mono"
                            />
                        </div>

                        {/* 2. Proxy */}
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">
                                대리인 (현장)
                                {isElection && <span className="text-red-500 text-[10px] ml-1">*투표불가</span>}
                            </label>
                            <input
                                type="number"
                                value={voteData.proxyAttendance || 0}
                                onChange={(e) => actions.updateVoteData('proxyAttendance', parseInt(e.target.value) || 0)}
                                className={`w-full p-2 border rounded focus:ring-2 outline-none text-right font-mono ${isElection ? 'border-red-200 bg-red-50 text-red-700 focus:ring-red-200' : 'border-slate-300 focus:ring-slate-500'}`}
                            />
                        </div>

                        {/* 3. Written */}
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">서면결의</label>
                            <input
                                type="number"
                                value={voteData.writtenAttendance || 0}
                                onChange={(e) => actions.updateVoteData('writtenAttendance', parseInt(e.target.value) || 0)}
                                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-slate-500 outline-none text-right font-mono"
                            />
                        </div>
                    </div>
                    <div className="pt-4 border-t border-slate-100">
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-700">총 성원 (서면+조합원+대리인)</span>
                            <span className="text-2xl font-bold text-blue-700">{totalAttendance.toLocaleString()}명</span>
                        </div>
                    </div>
                </Card>
            </section>

            {/* Section 2: Votes */}
            <section>
                <div className="flex justify-between items-end mb-3">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">02. 투표 결과 입력</h3>
                    <button
                        onClick={() => {
                            actions.updateVoteData('votesYes', 0);
                            actions.updateVoteData('votesNo', 0);
                            actions.updateVoteData('votesAbstain', 0);
                        }}
                        className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1"
                    >
                        <Trash2 size={12} /> 초기화
                    </button>
                </div>
                <Card className="p-6">
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-emerald-700 text-center">찬성</label>
                            <input
                                type="number"
                                value={voteData.votesYes}
                                onChange={(e) => actions.updateVoteData('votesYes', parseInt(e.target.value) || 0)}
                                className="w-full p-3 border-2 border-emerald-100 rounded-lg focus:border-emerald-500 outline-none text-center text-2xl font-bold text-emerald-700"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-red-700 text-center">반대</label>
                            <input
                                type="number"
                                value={voteData.votesNo}
                                onChange={(e) => actions.updateVoteData('votesNo', parseInt(e.target.value) || 0)}
                                className="w-full p-3 border-2 border-red-100 rounded-lg focus:border-red-500 outline-none text-center text-2xl font-bold text-red-700"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-slate-500 text-center">기권/무효</label>
                            <input
                                type="number"
                                value={voteData.votesAbstain}
                                onChange={(e) => actions.updateVoteData('votesAbstain', parseInt(e.target.value) || 0)}
                                className="w-full p-3 border-2 border-slate-200 rounded-lg focus:border-slate-400 outline-none text-center text-2xl font-bold text-slate-500"
                            />
                        </div>
                    </div>

                    {/* Check Count */}
                    <div className={`p-3 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors ${isVoteCountValid ? 'bg-slate-50 text-slate-600' : 'bg-red-50 text-red-600 animate-pulse'
                        }`}>
                        {isVoteCountValid ? (
                            <>
                                <CheckCircle2 size={16} className="text-emerald-500" />
                                합계 일치 확인완료
                            </>
                        ) : (
                            <>
                                <AlertTriangle size={16} />
                                주의: 총 {totalVotesCast}표 (참석자 {totalAttendance}명)
                            </>
                        )}
                    </div>

                </Card>
            </section>

            {/* Section 3: Declaration - Separate Card */}
            <section>
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                        03. 선포 문구
                    </h3>
                    {isEditingDeclaration ? (
                        <button
                            onClick={handleFinishEdit}
                            className="text-xs flex items-center gap-1 px-3 py-1 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 transition-colors font-medium"
                        >
                            ✓ 완료
                        </button>
                    ) : (
                        <button
                            onClick={handleStartEdit}
                            className="text-xs flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200 transition-colors font-medium"
                        >
                            ✎ 편집
                        </button>
                    )}
                </div>

                <Card className="p-4">
                    <textarea
                        value={currentAgenda?.declaration || ''}
                        onChange={(e) => handleDeclarationChange(e.target.value)}
                        disabled={!isEditingDeclaration}
                        placeholder={isEditingDeclaration ? "선포문구를 입력하세요..." : "편집 버튼을 클릭하면 자동 생성됩니다."}
                        className={`w-full p-3 border rounded-lg outline-none text-xl font-serif resize-none h-40 leading-relaxed transition-colors ${isEditingDeclaration
                            ? 'border-blue-300 bg-white text-slate-700 focus:ring-2 focus:ring-blue-500'
                            : 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed'
                            }`}
                    />
                    <p className="text-xs text-slate-400 mt-2">
                        {isEditingDeclaration
                            ? '* 수정 후 "완료" 버튼을 클릭하세요. 자동 저장됩니다.'
                            : '* 안건별로 저장됩니다. 실수 방지를 위해 잠금 상태입니다.'}
                    </p>
                </Card>
            </section>
        </div>
    );
}
