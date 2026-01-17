'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react';
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

    // 2. Derive Attendance Data (Scoped to Meeting)
    const meetingStats = useMemo(() => {
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

    // Vote Type Map
    const normalizeType = (type) => {
        if (type === 'general') return 'majority';
        if (type === 'special') return 'twoThirds';
        return type || 'majority';
    };
    const currentAgendaType = normalizeType(currentAgenda?.type);
    const isSpecialVote = currentAgendaType === 'twoThirds';
    const isElection = currentAgendaType === 'election';

    // Targets
    // Use global members length as total potential members
    const totalMembers = members.length;
    const quorumTarget = isSpecialVote
        ? Math.ceil(totalMembers * (2 / 3))
        : Math.ceil(totalMembers / 2);

    const directTarget = Math.ceil(totalMembers * 0.2);
    const isDirectSatisfied = !isElection || (meetingStats.direct >= directTarget);
    const isQuorumSatisfied = (meetingStats.total >= quorumTarget) && isDirectSatisfied;

    // 3. Declaration Generation
    const generateDefaultDeclaration = () => {
        if (!currentAgenda || meetingStats.total === 0) return '';
        const criterion = isSpecialVote ? "3분의 2 이상" : "과반수 이상";
        const votesYes = currentAgenda.votes_yes || 0;
        const votesNo = currentAgenda.votes_no || 0;
        const votesAbstain = currentAgenda.votes_abstain || 0;

        return `"${currentAgenda.title}" 서면결의 포함 찬성(${votesYes})표, 반대(${votesNo})표, 기권(${votesAbstain})표로
전체 참석자(${meetingStats.total.toLocaleString()})명중 ${criterion} 찬성으로
"${currentAgenda.title}"은 가결되었음을 선포합니다.`;
    };

    const [isEditingDeclaration, setIsEditingDeclaration] = useState(false);

    // Declaration Auto-Update
    useEffect(() => {
        if (!currentAgenda || isEditingDeclaration) return;
        // Only update if current one is empty? OR auto-update always?
        // User pattern suggests we want auto-update unless manually edited.
        // Let's assume if it matches the 'template' pattern we verify, otherwise keep custom.
        // Simplified: Update fields that are dependent on numbers.

        // Actually, let's just not auto-overwrite if user typed something custom.
        // But for "Live" system, we usually want live numbers.
        // Let's use the helper to update ONLY if we are in a 'clean slate' or it looks like a template.
        // For safety, let's just provide the "Auto Generate" via the edit start or effect if empty.

        if (!currentAgenda.declaration) {
            const newDecl = generateDefaultDeclaration();
            if (newDecl) actions.updateAgenda({ id: currentAgenda.id, declaration: newDecl });
        }
    }, [meetingStats.total, currentAgenda?.votes_yes, currentAgenda?.votes_no, currentAgenda?.votes_abstain]);


    const handleTypeChange = (newType) => {
        if (currentAgenda) {
            actions.updateAgenda({ id: currentAgenda.id, type: newType });
        }
    };

    const handleVoteUpdate = (field, value) => {
        if (currentAgenda) {
            actions.updateAgenda({ id: currentAgenda.id, [field]: value });
        }
    };

    const totalVotesCast = (currentAgenda?.votes_yes || 0) + (currentAgenda?.votes_no || 0) + (currentAgenda?.votes_abstain || 0);
    const isVoteCountValid = meetingStats.total === totalVotesCast;

    if (!currentAgenda) return <div className="p-4 text-slate-500">안건을 선택해주세요.</div>;

    return (
        <div className="space-y-3">
            {/* Section 1: Attendance (Read-Only from DB for integrity) */}
            <section>
                <div className="flex justify-between items-end mb-3">
                    <h3 className="text-lg font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                        01. 성원(참석) 집계
                        <span className="text-xs font-normal text-slate-400 normal-case ml-2">
                            (참조: {agendas.find(a => a.id === meetingId)?.title || '미지정'})
                        </span>
                    </h3>

                    {/* Vote Type Selector */}
                    <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                        <button
                            onClick={() => handleTypeChange('majority')}
                            className={`px-3 py-1 text-xs font-bold rounded transition-all ${currentAgendaType === 'majority' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            일반
                        </button>
                        <button
                            onClick={() => handleTypeChange('election')}
                            className={`px-3 py-1 text-xs font-bold rounded transition-all ${currentAgendaType === 'election' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            선거
                        </button>
                        <button
                            onClick={() => handleTypeChange('twoThirds')}
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
                                style={{ width: `${Math.min(100, (meetingStats.total / (totalMembers || 1)) * 100)}%` }}
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
                                    : `미달 ${!isDirectSatisfied ? '(직접참석 부족)' : `(${Math.max(0, quorumTarget - meetingStats.total)}명 부족)`}`}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        {/* 1. Direct */}
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">조합원 (현장)</label>
                            <div className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-right font-mono font-bold text-slate-700">
                                {meetingStats.direct}
                            </div>
                        </div>

                        {/* 2. Proxy */}
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">대리인 (현장)</label>
                            <div className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-right font-mono font-bold text-slate-700">
                                {meetingStats.proxy}
                            </div>
                        </div>

                        {/* 3. Written */}
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">서면결의</label>
                            <div className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-right font-mono font-bold text-slate-700">
                                {meetingStats.written}
                            </div>
                        </div>
                    </div>
                    <div className="pt-4 border-t border-slate-100">
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-700">총 성원 (조합원+대리인+서면)</span>
                            <span className="text-2xl font-bold text-blue-700">{meetingStats.total.toLocaleString()}명</span>
                        </div>
                    </div>
                </Card>
            </section>

            {/* Section 2: Votes */}
            <section>
                <div className="flex justify-between items-end mb-3">
                    <h3 className="text-lg font-bold text-slate-600 uppercase tracking-wider">02. 투표결과 입력</h3>
                    <button
                        onClick={() => {
                            handleVoteUpdate('votes_yes', 0);
                            handleVoteUpdate('votes_no', 0);
                            handleVoteUpdate('votes_abstain', 0);
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
                                value={currentAgenda.votes_yes || 0}
                                onChange={(e) => handleVoteUpdate('votes_yes', parseInt(e.target.value) || 0)}
                                className="w-full p-3 border-2 border-emerald-100 rounded-lg focus:border-emerald-500 outline-none text-center text-2xl font-bold text-emerald-700"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-red-700 text-center">반대</label>
                            <input
                                type="number"
                                value={currentAgenda.votes_no || 0}
                                onChange={(e) => handleVoteUpdate('votes_no', parseInt(e.target.value) || 0)}
                                className="w-full p-3 border-2 border-red-100 rounded-lg focus:border-red-500 outline-none text-center text-2xl font-bold text-red-700"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-slate-500 text-center">기권/무효</label>
                            <input
                                type="number"
                                value={currentAgenda.votes_abstain || 0}
                                onChange={(e) => handleVoteUpdate('votes_abstain', parseInt(e.target.value) || 0)}
                                className="w-full p-3 border-2 border-slate-200 rounded-lg focus:border-slate-400 outline-none text-center text-2xl font-bold text-slate-500"
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
                                주의: 총 {totalVotesCast}표 (참석자 {meetingStats.total}명)
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
                    {isEditingDeclaration ? (
                        <button
                            onClick={() => setIsEditingDeclaration(false)}
                            className="text-xs flex items-center gap-1 px-3 py-1 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 transition-colors font-medium"
                        >
                            ✓ 완료
                        </button>
                    ) : (
                        <button
                            onClick={() => {
                                if (!currentAgenda.declaration) actions.updateAgenda({ id: currentAgenda.id, declaration: generateDefaultDeclaration() });
                                setIsEditingDeclaration(true);
                            }}
                            className="text-xs flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200 transition-colors font-medium"
                        >
                            ✎ 편집
                        </button>
                    )}
                </div>

                <Card className="p-4">
                    <textarea
                        value={currentAgenda.declaration || ''}
                        onChange={(e) => actions.updateAgenda({ id: currentAgenda.id, declaration: e.target.value })}
                        disabled={!isEditingDeclaration}
                        placeholder={isEditingDeclaration ? "선포문구를 입력하세요..." : "편집 버튼을 클릭하면 자동 생성됩니다."}
                        className={`w-full p-3 border rounded-lg outline-none text-xl font-serif resize-none h-40 leading-relaxed transition-colors ${isEditingDeclaration
                            ? 'border-blue-300 bg-white text-slate-700 focus:ring-2 focus:ring-blue-500'
                            : 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed'
                            }`}
                    />
                </Card>
            </section>
        </div>
    );
}
