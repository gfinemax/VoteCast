'use client';

import React from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { getAgendaVoteBuckets, getMeetingAttendanceStats } from '@/lib/store';
import { Settings, Users } from 'lucide-react';
import FullscreenToggle from '@/components/ui/FullscreenToggle';
import DashboardLayout from '@/components/admin/DashboardLayout';
import AgendaList from '@/components/admin/AgendaList';
import LiveMonitor from '@/components/admin/LiveMonitor';
import VoteControl from '@/components/admin/VoteControl';
import AudioPlayer from '@/components/admin/AudioPlayer';
import AuthStatus from '@/components/ui/AuthStatus';

export default function AdminPage() {
    const { state, actions } = useStore();
    const { voteData, currentAgendaId, agendas, projectorMode, attendance, members } = state;
    const inactiveMemberIds = React.useMemo(
        () => Array.isArray(voteData?.inactiveMemberIds) ? voteData.inactiveMemberIds : [],
        [voteData?.inactiveMemberIds]
    );
    const activeMemberIdSet = React.useMemo(() => {
        const inactiveMemberIdLookup = new Set(inactiveMemberIds);
        return new Set(
            members
                .filter((member) => member.is_active !== false && !inactiveMemberIdLookup.has(member.id))
                .map((member) => member.id)
        );
    }, [inactiveMemberIds, members]);
    const currentAgenda = agendas.find(a => a.id === currentAgendaId);

    // 1. Identify Context (Meeting/Folder) for stats
    const meetingId = React.useMemo(() => {
        if (!currentAgenda) return null;
        if (currentAgenda.type === 'folder') return currentAgenda.id;
        const currentIndex = agendas.findIndex(a => a.id === currentAgendaId);
        for (let i = currentIndex - 1; i >= 0; i--) {
            if (agendas[i].type === 'folder') return agendas[i].id;
        }
        return null;
    }, [agendas, currentAgendaId, currentAgenda]);

    // 2. Derive LIVE stats (Instead of relying on voteData)
    const meetingStats = React.useMemo(() => {
        return getMeetingAttendanceStats(attendance, meetingId, activeMemberIdSet);
    }, [activeMemberIdSet, attendance, meetingId]);

    // Pass Logic based on Vote Type
    const normalizeType = (type) => {
        if (type === 'general') return 'majority';
        if (type === 'special') return 'twoThirds';
        return type || 'majority';
    };
    const currentAgendaType = normalizeType(currentAgenda?.type);
    const isSpecialVote = currentAgendaType === 'twoThirds';
    const totalAttendance = meetingStats.total;
    const passThreshold = isSpecialVote ? Math.ceil(totalAttendance * (2 / 3)) : (totalAttendance / 2);
    const voteBuckets = getAgendaVoteBuckets(currentAgenda);
    const votesYes = voteBuckets.final.yes;
    const isPassed = votesYes >= passThreshold;

    const totalVotesCast = voteBuckets.final.yes + voteBuckets.final.no + voteBuckets.final.abstain;
    const isVoteCountValid = totalAttendance === totalVotesCast;

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
            title="총회관리자"
            subtitle="Total Control & Monitor System"
            sidebarContent={<AgendaList />}
            sidebarFooter={<AudioPlayer />}
            headerContent={
                <>
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mr-6">
                        <Settings size={20} className="text-slate-400" />
                        Main Control
                    </h2>
                    <div className="flex gap-2 items-center flex-grow">
                        <div className="flex-grow"></div>
                        <Link
                            href="/admin/members"
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        >
                            <Users size={14} />
                            조합원 관리
                        </Link>

                        <FullscreenToggle />
                        <AuthStatus />
                    </div>
                </>
            }
        >
            <div className="grid grid-cols-12 gap-8">
                <div className="col-span-12">
                    <LiveMonitor />
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
