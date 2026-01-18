'use client';

import React from 'react';
import { useStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { Play, Pause, Monitor, Settings } from 'lucide-react';
import Button from '@/components/ui/Button';
import DashboardLayout from '@/components/admin/DashboardLayout';
import AgendaList from '@/components/admin/AgendaList';
import LiveMonitor from '@/components/admin/LiveMonitor';
import VoteControl from '@/components/admin/VoteControl';

export default function AdminPage() {
    const { state, actions } = useStore();
    const { voteData, currentAgendaId, agendas, projectorMode, attendance, members } = state;
    const currentAgenda = agendas.find(a => a.id === currentAgendaId);
    const projectorModeRef = React.useRef(projectorMode);
    projectorModeRef.current = projectorMode;

    // Remote PPT Keyboard Control
    React.useEffect(() => {
        const handleKeyDown = (e) => {
            // Allow control in both IDLE and PPT mode as both show the PDF base layer
            if (projectorModeRef.current !== 'PPT' && projectorModeRef.current !== 'IDLE') return;

            // Only trigger if focus is not in an input/textarea
            if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                actions.updatePresentationPage(1);
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                actions.updatePresentationPage(-1);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [actions]);


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
        if (!meetingId) return { direct: 0, proxy: 0, written: 0, total: 0 };
        const relevantRecords = attendance.filter(a => a.meeting_id === meetingId);
        return {
            direct: relevantRecords.filter(a => a.type === 'direct').length,
            proxy: relevantRecords.filter(a => a.type === 'proxy').length,
            written: relevantRecords.filter(a => a.type === 'written').length,
            total: relevantRecords.length
        };
    }, [attendance, meetingId]);

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
    const votesYes = currentAgenda?.votes_yes || 0;
    const isPassed = votesYes >= passThreshold;

    const totalVotesCast = (currentAgenda?.votes_yes || 0) + (currentAgenda?.votes_no || 0) + (currentAgenda?.votes_abstain || 0);
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
            title="총회관리자"
            subtitle="Total Control & Monitor System"
            sidebarContent={<AgendaList />}
            headerContent={
                <>
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mr-6">
                        <Settings size={20} className="text-slate-400" />
                        Main Control
                    </h2>
                    <div className="flex gap-1 items-center flex-grow">
                        {/* 1. Vote Result */}
                        <Button
                            variant={projectorMode === 'RESULT' ? 'success' : 'secondary'}
                            onClick={handlePublish}
                            className="text-sm px-3 py-1.5"
                        >
                            <Play size={14} /> 투표 결과
                        </Button>

                        {/* 2. Agenda PPT */}
                        <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
                            <Button
                                variant={projectorMode === 'PPT' ? 'success' : 'secondary'}
                                onClick={handleProjectorPPT}
                                className="text-sm px-3 py-1.5"
                            >
                                <Monitor size={14} /> 안건 설명
                            </Button>
                            {projectorMode === 'PPT' && (
                                <div className="px-3 py-1.5 text-xs font-black font-mono text-blue-600 bg-white rounded shadow-sm flex items-center gap-1.5">
                                    <span className="text-[10px] text-slate-400">PAGE</span>
                                    {voteData?.presentationPage || 1}
                                </div>
                            )}
                        </div>

                        {/* 3. Waiting Board */}
                        <Button
                            variant={projectorMode === 'WAITING' ? 'success' : 'secondary'}
                            onClick={handleProjectorWaiting}
                            className="text-sm px-3 py-1.5"
                        >
                            <Settings size={14} /> 성원현황
                        </Button>

                        <div className="flex-grow"></div>

                        {/* 4. Open Window - Red */}
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
