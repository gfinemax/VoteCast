'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/store';
import { Play, ClipboardList, Monitor, Settings } from 'lucide-react';
import FullscreenToggle from '@/components/ui/FullscreenToggle';
import Button from '@/components/ui/Button';
import DashboardLayout from '@/components/admin/DashboardLayout';
import AgendaList from '@/components/admin/AgendaList';
import LiveMonitor from '@/components/admin/LiveMonitor';
import VoteControl from '@/components/admin/VoteControl';
import AuthStatus from '@/components/ui/AuthStatus';

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
                    <div className="flex gap-2 items-center flex-grow">
                        <div className="flex-grow"></div>

                        <FullscreenToggle />
                        <AuthStatus />
                    </div>
                </>
            }
        >
            <div className="grid grid-cols-12 gap-8">
                <div className="col-span-12">
                    {/* Read-Only Live Monitor (Safety) */}
                    <LiveMonitor mode="commission" />
                </div>

                <div className="col-span-12">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">


                        <VoteControl />
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
