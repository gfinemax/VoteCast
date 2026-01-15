'use client';

import React, { useMemo, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { FileText, Monitor, Settings, Trash2, Plus, CheckCircle2, AlertTriangle, Play, Pause } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

export default function AdminPage() {
    const { state, actions } = useStore();
    const { voteData, members, currentAgendaId, agendas, projectorMode } = state;

    const currentAgenda = agendas.find(a => a.id === currentAgendaId);

    // Derived Real-time Stats
    const liveDirectAttendance = useMemo(() => {
        return members.filter(m => m.isCheckedIn).length;
    }, [members]);

    // Sync live attendance to vote data automatically
    // In a real app, this might be a manual sync or useEffect sync
    useEffect(() => {
        if (voteData.directAttendance !== liveDirectAttendance) {
            actions.updateVoteData('directAttendance', liveDirectAttendance);
        }
    }, [liveDirectAttendance, voteData.directAttendance, actions]);

    const totalAttendance = (parseInt(voteData.writtenAttendance) || 0) + (parseInt(voteData.directAttendance) || 0);

    const totalVotesCast = (parseInt(voteData.votesYes) || 0) + (parseInt(voteData.votesNo) || 0) + (parseInt(voteData.votesAbstain) || 0);
    const isVoteCountValid = totalAttendance === totalVotesCast;
    const isPassed = voteData.votesYes >= (totalAttendance / 2);

    const handlePublish = () => {
        if (!isVoteCountValid) {
            if (!confirm("참석자 수와 투표 수 합계가 일치하지 않습니다. 그래도 송출하시겠습니까?")) return;
        }

        actions.setProjectorMode('RESULT', {
            ...voteData,
            totalAttendance,
            agendaTitle: currentAgenda.title,
            isPassed,
            timestamp: new Date().toLocaleTimeString()
        });
        alert("결과 화면 송출을 시작했습니다.");
    };

    const handleProjectorPPT = () => {
        actions.setProjectorMode('PPT', { agendaTitle: currentAgenda.title });
    };

    return (
        <div className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden">
            {/* Sidebar */}
            <aside className="w-80 bg-white border-r border-slate-200 flex flex-col shadow-lg z-10">
                <div className="p-6 border-b border-slate-100">
                    <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
                            <FileText size={18} />
                        </div>
                        RHA VoteCast
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">지역주택조합 총회 관리 시스템</p>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">진행 안건 목록</div>
                    {agendas.map(agenda => (
                        <button
                            key={agenda.id}
                            onClick={() => actions.setAgenda(agenda.id)}
                            className={`w-full text-left p-3 rounded-lg text-sm font-medium transition-colors border ${currentAgendaId === agenda.id
                                    ? "bg-slate-900 text-white border-slate-900 shadow-md"
                                    : "bg-white text-slate-600 border-slate-100 hover:bg-slate-50 hover:border-slate-300"
                                }`}
                        >
                            <div className="line-clamp-2">{agenda.title}</div>
                        </button>
                    ))}
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Header */}
                <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Settings size={20} className="text-slate-400" />
                        안건 설정 및 투표 집계
                    </h2>
                    <div className="flex gap-2">
                        <div className="text-xs text-slate-400 flex flex-col items-end justify-center mr-2">
                            <span>현재 송출 상태</span>
                            <span className={`font-bold ${projectorMode === 'RESULT' ? 'text-emerald-500' : 'text-blue-500'}`}>{projectorMode} MODE</span>
                        </div>
                        <Button variant={projectorMode === 'PPT' ? 'primary' : 'secondary'} onClick={handleProjectorPPT}>
                            <Monitor size={16} /> 안건 설명 (PPT)
                        </Button>
                        <Button variant={projectorMode === 'RESULT' ? 'success' : 'secondary'} onClick={handlePublish}>
                            <Play size={16} /> 결과 발표
                        </Button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-5xl mx-auto space-y-6">

                        {/* Agenda Info */}
                        <section>
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">01. 선택된 안건 정보</h3>
                            <Card className="p-6 bg-gradient-to-r from-slate-800 to-slate-900 text-white border-none">
                                <div className="text-slate-300 text-sm mb-1">Current Agenda</div>
                                <div className="text-2xl font-bold">{currentAgenda?.title}</div>
                            </Card>
                        </section>

                        <div className="grid grid-cols-12 gap-6">

                            {/* Attendance Input */}
                            <div className="col-span-12 md:col-span-4 space-y-6">
                                <section>
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">02. 성원(참석) 집계</h3>
                                    <Card className="p-6 space-y-4">
                                        <div className="bg-slate-50 p-3 rounded border border-slate-100 mb-2">
                                            <div className="flex justify-between items-center text-sm mb-1">
                                                <span className="text-slate-500">실시간 입장 확인 (Auto)</span>
                                                <span className="text-emerald-600 font-bold flex items-center gap-1">
                                                    <span className="relative flex h-2 w-2">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                                    </span>
                                                    Live Sync
                                                </span>
                                            </div>
                                            <div className="text-3xl font-mono font-bold text-slate-800">{liveDirectAttendance}명</div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-600 mb-1">서면결의 (수동)</label>
                                                <input
                                                    type="number"
                                                    value={voteData.writtenAttendance}
                                                    onChange={(e) => actions.updateVoteData('writtenAttendance', parseInt(e.target.value) || 0)}
                                                    className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-slate-500 outline-none text-right font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-400 mb-1">현장참석 (자동)</label>
                                                <div className="w-full p-2 bg-slate-100 border border-slate-200 rounded text-right font-mono text-slate-600">
                                                    {voteData.directAttendance}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="pt-4 border-t border-slate-100">
                                            <div className="flex justify-between items-center">
                                                <span className="font-bold text-slate-700">총 참석자(성원)</span>
                                                <span className="text-2xl font-bold text-blue-700">{totalAttendance.toLocaleString()}명</span>
                                            </div>
                                        </div>
                                    </Card>
                                </section>
                            </div>

                            {/* Vote Input */}
                            <div className="col-span-12 md:col-span-8 space-y-6">
                                <section>
                                    <div className="flex justify-between items-end mb-3">
                                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">03. 투표 결과 입력</h3>
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

                                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-sm text-indigo-800 flex items-start gap-3">
                                    <Monitor className="shrink-0 mt-0.5" size={16} />
                                    <div>
                                        <span className="font-bold block mb-1">송출 제어 팁</span>
                                        [안건 설명 (PPT)] 버튼을 누르면 대기 화면이 나갑니다.<br />
                                        집계가 끝나면 [결과 발표]를 눌러 애니메이션을 보여주세요.
                                    </div>
                                </div>

                            </div>
                        </div>

                    </div>
                </div>
            </main>
        </div>
    );
}
