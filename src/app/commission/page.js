'use client';

import React from 'react';
import { useStore } from '@/lib/store';
import { Play, ClipboardList, Monitor, Settings } from 'lucide-react';
import Button from '@/components/ui/Button';
import DashboardLayout from '@/components/admin/DashboardLayout';
import AgendaList from '@/components/admin/AgendaList';
import LiveMonitor from '@/components/admin/LiveMonitor';
import VoteControl from '@/components/admin/VoteControl';

export default function CommissionPage() {
    const { state, actions } = useStore();
    const { voteData, currentAgendaId, agendas } = state;
    const currentAgenda = agendas.find(a => a.id === currentAgendaId);

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

    const handleProjectorWaiting = () => {
        actions.setProjectorMode('WAITING', {
            ...voteData,
            totalAttendance
        });
    };

    const handleProjectorPPT = () => {
        actions.setProjectorMode('PPT', { agendaTitle: currentAgenda.title });
    };

    const openProjectorWindow = () => {
        const width = 1200;
        const height = 800;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;

        window.open(
            '/projector',
            'VoteCastProjector',
            `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
        );
    };

    return (
        <DashboardLayout
            title="선거관리위원회"
            subtitle="Vote Input & Result Management"
            sidebarContent={<AgendaList />}
            headerContent={
                <>
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mr-8">
                        <ClipboardList size={20} className="text-emerald-500" />
                        Commission Panel
                    </h2>
                    <div className="flex gap-1 items-center flex-grow">
                        {/* 1. Vote Result */}
                        <Button
                            variant={state.projectorMode === 'RESULT' ? 'success' : 'secondary'}
                            onClick={handlePublish}
                            className="text-sm px-3 py-1.5"
                        >
                            <Play size={14} /> 투표 결과
                        </Button>

                        {/* 2. Agenda PPT */}
                        <Button
                            variant={state.projectorMode === 'PPT' ? 'success' : 'secondary'}
                            onClick={handleProjectorPPT}
                            className="text-sm px-3 py-1.5"
                        >
                            <Monitor size={14} /> 안건 설명
                        </Button>

                        {/* 3. Waiting Board */}
                        <Button
                            variant={state.projectorMode === 'WAITING' ? 'success' : 'secondary'}
                            onClick={handleProjectorWaiting}
                            className="text-sm px-3 py-1.5"
                        >
                            <Settings size={14} /> 성원현황
                        </Button>

                        <div className="flex-grow"></div>
                        <Button
                            className="bg-red-600 text-white hover:bg-red-700 border-0 shadow-lg text-sm px-3 py-1.5 ml-auto"
                            onClick={openProjectorWindow}
                        >
                            <Monitor size={14} className="mr-1" />
                            송출창
                        </Button>
                    </div>
                </>
            }
        >
            <div className="grid grid-cols-12 gap-8">
                <div className="col-span-12">
                    {/* Read-Only Live Monitor (Safety) */}
                    <LiveMonitor />
                </div>

                <div className="col-span-12">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <div className="text-2xl font-bold text-slate-800">{currentAgenda?.title}</div>
                            </div>
                        </div>

                        <VoteControl />
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
