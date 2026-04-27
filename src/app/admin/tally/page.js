'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    AlertTriangle,
    ArrowLeft,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    ClipboardCheck,
    FileText,
    PenLine,
    Printer,
    RotateCcw,
    Save,
    Search,
    ShieldCheck,
    Table2,
    Ticket,
    Users
} from 'lucide-react';
import DashboardLayout from '@/components/admin/DashboardLayout';
import AuthStatus from '@/components/ui/AuthStatus';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import FullscreenToggle from '@/components/ui/FullscreenToggle';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import {
    ATTENDANCE_TYPE_LABELS,
    CONFIRMATION_SOURCE_LABELS,
    VOTE_CHOICE_LABELS,
    applyManualResults,
    buildAgendaGroups,
    buildManualResultsFromAgendaResults,
    buildTallyAudit,
    formatKoreanDate,
    getDefaultMeetingId
} from '@/lib/tallyCalculations';
import {
    getElectionRule
} from '@/lib/electionRules';

const EMPTY_INACTIVE_MEMBER_IDS = [];
const DEFAULT_COMMITTEE_MEMBERS = [
    { role: '선거관리위원장', name: '한재호' },
    { role: '선거관리위원', name: '전경분' },
    { role: '선거관리위원', name: '최인순' }
];
const TAB_ITEMS = [
    { id: 'summary', label: '집계 현황', icon: ClipboardCheck },
    { id: 'matrix', label: '조합원별 검산표', icon: Table2 },
    { id: 'manual', label: '수기 보정/확정', icon: PenLine },
    { id: 'certificate', label: '선관위 확인서', icon: FileText }
];

const numberFormatter = new Intl.NumberFormat('ko-KR');
const formatNumber = (value) => numberFormatter.format(Number(value) || 0);
const toNumber = (value) => {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
};

const getStatusClass = (hasProblem) => (
    hasProblem
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
);

const getResultClass = (result) => {
    if (result === '상정 철회') return 'bg-slate-100 text-slate-700 border-slate-300';
    if (result === '조건부 가결') return 'bg-amber-50 text-amber-700 border-amber-200';
    if (['가결', '당선', '1차 당선권', '다득표 확인'].includes(result)) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (result === '결선 확인') return 'bg-amber-50 text-amber-700 border-amber-200';
    if (result?.includes('성원 미달') || result?.includes('유회')) return 'bg-amber-50 text-amber-600 border-amber-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
};

const getChoiceLabel = (choice) => VOTE_CHOICE_LABELS[choice] || '-';

const getChoiceClass = (choice) => {
    if (choice === 'yes') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (choice === 'no') return 'bg-rose-50 text-rose-700 border-rose-200';
    if (choice === 'abstain') return 'bg-slate-100 text-slate-700 border-slate-200';
    if (choice === 'onsite') return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    return 'bg-amber-50 text-amber-700 border-amber-200';
};

const getAttendanceClass = (type, isIssued) => {
    if (isIssued) return 'bg-blue-600 text-white border-blue-700 shadow-md ring-1 ring-blue-400 ring-offset-0';
    if (type === 'direct') return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    if (type === 'proxy') return 'bg-blue-50 text-blue-700 border-blue-200';
    if (type === 'written') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    return 'bg-slate-50 text-slate-500 border-slate-200';
};

const getElectionStatusClass = (status) => {
    if (status === 'mail') return 'bg-indigo-600 text-white border-indigo-700 shadow-sm';
    if (status === 'onsite') return 'border-cyan-200 bg-cyan-50 text-cyan-700';
    if (status === 'none') return 'bg-slate-100/50 text-slate-400 border-slate-100';
    return 'bg-amber-50 text-amber-600 border-amber-200';
};

const ELECTION_STATUS_LABELS = {
    none: '투표권없음',
    mail: '우편투표',
    onsite: '현장투표',
    missing: '미투표'
};

function NumberInput({ value, onChange }) {
    return (
        <input
            type="number"
            min="0"
            value={value ?? 0}
            onChange={(event) => onChange(toNumber(event.target.value))}
            className="h-10 w-24 rounded-lg border border-slate-300 bg-white px-3 text-right text-sm font-semibold text-slate-900 outline-none focus:border-blue-500"
        />
    );
}

function SidebarContent({ groups, selectedMeetingId, setSelectedMeetingId, audit, confirmation }) {
    return (
        <div className="p-4 space-y-4">
            <Card className="p-4">
                <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                        <ShieldCheck size={21} />
                    </div>
                    <div>
                        <div className="text-sm font-bold text-slate-900">검산 및 확인서</div>
                        <div className="mt-1 text-xs leading-relaxed text-slate-500">
                            자동 집계를 검토하고 필요 시 수기 확정 후 선관위 확인서를 출력합니다.
                        </div>
                    </div>
                </div>
            </Card>

            <Card className="p-4 space-y-3">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Meeting</div>
                <div className="space-y-2">
                    {groups.filter((group) => group.folder).map((group) => (
                        <button
                            key={group.folder.id}
                            type="button"
                            onClick={() => setSelectedMeetingId(group.folder.id)}
                            className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${selectedMeetingId === group.folder.id ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                        >
                            <div className="text-sm font-bold">{group.folder.title}</div>
                            <div className="mt-1 text-xs text-slate-500">{group.items.length}개 안건</div>
                        </button>
                    ))}
                    {groups.filter((group) => group.folder).length === 0 && (
                        <div className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-400">
                            등록된 총회 폴더가 없습니다.
                        </div>
                    )}
                </div>
            </Card>

            <Card className="p-4 space-y-3">
                <div>
                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Audit Status</div>
                    <div className="mt-2 text-2xl font-black text-slate-900">{formatNumber(audit.activeMembers.length)}</div>
                    <div className="text-xs text-slate-500">검산 대상 조합원</div>
                </div>
                <div className={`rounded-xl border px-3 py-3 text-xs font-bold ${getStatusClass(audit.hasIssues)}`}>
                    {audit.hasIssues ? `확인 필요 ${audit.issueList.length}건` : '현재 감지된 문제 없음'}
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-relaxed text-slate-500">
                    최종 확정: {confirmation?.confirmedAt ? formatKoreanDate(confirmation.confirmedAt) : '아직 없음'}
                </div>
            </Card>
        </div>
    );
}

function TallyStats({ audit }) {
    const stats = audit.meetingStats;
    const hasElection = audit.electionAgendas?.length > 0;
    let mailVoteCount = 0;
    
    if (hasElection) {
        const uniqueMailVoteMembers = new Set();
        audit.memberRows?.forEach((row) => {
            if (row.electionVotes?.some((vote) => !!vote.choice)) {
                uniqueMailVoteMembers.add(row.member.id);
            }
        });
        mailVoteCount = uniqueMailVoteMembers.size;
    }

    return (
        <div className="flex flex-col xl:flex-row gap-4">
            {/* 기초 데이터 영역 - 형광 파랑 */}
            <Card className="flex flex-col items-center justify-center p-6 border-cyan-400 bg-cyan-50 shadow-md xl:w-48 shrink-0 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-cyan-200 rounded-bl-full -mr-8 -mt-8 opacity-50 pointer-events-none"></div>
                <div className="text-sm font-extrabold text-cyan-700 relative z-10">전체 조합원</div>
                <div className="mt-2 text-4xl font-black text-cyan-900 relative z-10">{formatNumber(audit.activeMembers.length)}</div>
            </Card>

            <div className="flex-1 flex flex-col md:flex-row gap-4">
                {/* 의결 안건 성원 영역 */}
                <Card className="flex-1 p-4 border-slate-200 bg-white flex flex-col">
                    <div className="flex items-center gap-2 mb-3 px-1">
                        <div className="w-1.5 h-4 bg-slate-400 rounded-full"></div>
                        <h3 className="text-sm font-bold text-slate-700">일반 안건 성원 집계</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
                        <Card className="p-4 text-center border-lime-400 bg-[#f4ffcc] shadow-sm col-span-2 md:col-span-1 flex flex-col justify-center relative overflow-hidden">
                            <div className="absolute bottom-0 right-0 w-16 h-16 bg-lime-200 rounded-tl-full -mr-6 -mb-6 opacity-40 pointer-events-none"></div>
                            <div className="text-[11px] font-extrabold text-lime-700 relative z-10">성원(의결)</div>
                            <div className="mt-1 text-3xl font-black text-lime-900 relative z-10">{formatNumber(stats.total)}</div>
                        </Card>
                        <Card className="p-4 text-center border-slate-100 bg-slate-50 flex flex-col justify-center">
                            <div className="text-[11px] font-bold text-slate-400">직접 출석</div>
                            <div className="mt-1 text-xl font-black text-slate-700">{formatNumber(stats.direct)}</div>
                        </Card>
                        <Card className="p-4 text-center border-slate-100 bg-slate-50 flex flex-col justify-center">
                            <div className="text-[11px] font-bold text-slate-400">대리 참석</div>
                            <div className="mt-1 text-xl font-black text-slate-700">{formatNumber(stats.proxy)}</div>
                        </Card>
                        <Card className="p-4 text-center border-slate-100 bg-slate-50 flex flex-col justify-center">
                            <div className="text-[11px] font-bold text-slate-400">서면결의서</div>
                            <div className="mt-1 text-xl font-black text-slate-700">{formatNumber(stats.written)}</div>
                        </Card>
                    </div>
                </Card>

                {/* 선거 안건 성원 영역 */}
                {hasElection && (
                    <Card className="flex-[0.75] p-4 border-slate-200 bg-white flex flex-col">
                        <div className="flex items-center gap-2 mb-3 px-1">
                            <div className="w-1.5 h-4 bg-slate-400 rounded-full"></div>
                            <h3 className="text-sm font-bold text-slate-700">선거 안건 성원 집계</h3>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 flex-1">
                            <Card className="p-4 text-center border-fuchsia-400 bg-fuchsia-50 shadow-sm col-span-2 lg:col-span-1 flex flex-col justify-center relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-16 h-16 bg-fuchsia-200 rounded-br-full -ml-8 -mt-8 opacity-40 pointer-events-none"></div>
                                <div className="text-[11px] font-extrabold text-fuchsia-700 relative z-10">성원(선거)</div>
                                <div className="mt-1 text-3xl font-black text-fuchsia-900 relative z-10">{formatNumber(stats.election)}</div>
                            </Card>
                            <Card className="p-4 text-center border-slate-100 bg-slate-50 flex flex-col justify-center">
                                <div className="text-[11px] font-bold text-slate-400">우편투표</div>
                                <div className="mt-1 text-xl font-black text-slate-700">{formatNumber(mailVoteCount)}</div>
                            </Card>
                            <Card className="p-4 text-center border-slate-100 bg-slate-50 flex flex-col justify-center">
                                <div className="text-[11px] font-bold text-slate-400">현장 투표</div>
                                <div className="mt-1 text-xl font-black text-slate-700">{formatNumber(stats.election - mailVoteCount)}</div>
                            </Card>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
}

function SummaryTab({ audit, finalResults }) {
    const hasElection = audit.electionAgendas?.length > 0;
    const standardResults = finalResults.filter((r) => !r.isElection);
    const electionResults = finalResults.filter((r) => r.isElection);

    const renderTable = (results, isElection) => (
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
                <thead className={`text-left text-xs font-bold uppercase tracking-[0.12em] ${isElection ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-50 text-slate-500'}`}>
                    <tr>
                        <th className="px-5 py-3">{isElection ? '후보자/선거' : '안건'}</th>
                        <th className="px-5 py-3 text-center">출석</th>
                        <th className="px-5 py-3 text-center">{isElection ? '득표/찬성' : '찬성'}</th>
                        <th className="px-5 py-3 text-center">{isElection ? '미선택/반대' : '반대'}</th>
                        <th className="px-5 py-3 text-center">기권/무효</th>
                        <th className="px-5 py-3 text-center">결과</th>
                        <th className="px-5 py-3 text-center">상태</th>
                    </tr>
                </thead>
                <tbody>
                    {results.map((result) => (
                        <tr key={result.id} className="border-t border-slate-100">
                            <td className="px-5 py-3">
                                <div className="font-bold text-slate-900">{result.title}</div>
                                <div className="mt-1 text-xs text-slate-500">{result.thresholdLabel}</div>
                                {result.resultReason && (
                                    <div className="mt-1 text-xs font-semibold text-slate-600">사유: {result.resultReason}</div>
                                )}
                            </td>
                            <td className="px-5 py-3 text-center font-semibold">{formatNumber(result.attendanceCount)}</td>
                            <td className="px-5 py-3 text-center font-semibold text-emerald-700">{formatNumber(result.final.yes)}</td>
                            <td className="px-5 py-3 text-center font-semibold text-rose-700">{formatNumber(result.final.no)}</td>
                            <td className="px-5 py-3 text-center font-semibold text-slate-700">{formatNumber(result.final.abstain)}</td>
                            <td className="px-5 py-3 text-center">
                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${getResultClass(result.result)}`}>
                                    {result.result}
                                </span>
                            </td>
                            <td className="px-5 py-3 text-center">
                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${getStatusClass(result.mismatch)}`}>
                                    {result.mismatch ? '불일치' : '정상'}
                                </span>
                            </td>
                        </tr>
                    ))}
                    {results.length === 0 && (
                        <tr>
                            <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-400">
                                해당되는 안건이 없습니다.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="space-y-4">
            <TallyStats audit={audit} />

            <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <div>
                        <div className="text-sm font-bold text-slate-900">일반 의결 안건 집계 현황</div>
                        <div className="text-xs text-slate-500">프로그램 집계와 수기 확정값을 비교합니다. (기준: 일반 안건 출석)</div>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClass(audit.hasIssues)}`}>
                        {audit.hasIssues ? '확인 필요' : '정상'}
                    </span>
                </div>
                {renderTable(standardResults, false)}
            </Card>

            {hasElection && (
                <Card className="overflow-hidden">
                    <div className="border-b border-slate-200 px-5 py-4">
                        <div className="text-sm font-bold text-slate-900">임원 선거 투표 결과 현황</div>
                        <div className="text-xs text-slate-500">프로그램 집계와 수기 확정값을 비교합니다. (기준: 선거 참여 출석)</div>
                    </div>
                    {renderTable(electionResults, true)}
                </Card>
            )}

            <Card className="overflow-hidden">
                <div className="border-b border-slate-200 px-5 py-4">
                    <div className="text-sm font-bold text-slate-900">문제 감지 목록</div>
                    <div className="text-xs text-slate-500">입력 누락, 중복, 집계 불일치를 먼저 확인합니다.</div>
                </div>
                <div className="divide-y divide-slate-100">
                    {audit.issueList.map((issue, index) => (
                        <div key={`${issue.title}-${index}`} className="flex items-start gap-3 px-5 py-4">
                            <AlertTriangle size={18} className={issue.level === 'danger' ? 'mt-0.5 text-rose-500' : 'mt-0.5 text-amber-500'} />
                            <div>
                                <div className="text-sm font-bold text-slate-900">{issue.title}</div>
                                <div className="mt-1 text-xs text-slate-500">{issue.detail}</div>
                            </div>
                        </div>
                    ))}
                    {audit.issueList.length === 0 && (
                        <div className="flex items-center gap-3 px-5 py-6 text-emerald-700">
                            <CheckCircle2 size={18} />
                            <div className="text-sm font-bold">현재 감지된 문제가 없습니다.</div>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}

function MatrixTab({ audit }) {
    const [searchTerm, setSearchTerm] = useState('');
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();
    const [sortConfig, setSortConfig] = useState({ key: 'attendanceType', direction: null }); // null, 'asc', 'desc'

    const toggleSort = (key) => {
        setSortConfig((prev) => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : (prev.key === key && prev.direction === 'desc' ? null : 'asc')
        }));
    };

    const rows = useMemo(() => {
        let filtered = audit.memberRows;
        if (normalizedSearchTerm) {
            filtered = filtered.filter((row) => (
                [
                    row.member.id,
                    row.member.unit,
                    row.member.name,
                    row.member.proxy,
                    row.proxyName
                ]
                    .map((value) => String(value || '').toLowerCase())
                    .join(' ')
                    .includes(normalizedSearchTerm)
            ));
        }

        if (!sortConfig.direction) return filtered;

        const ATTENDANCE_SORT_ORDER = {
            'written': 1,
            'direct': 2,
            'proxy': 3,
            'none': 4
        };

        const ELECTION_SORT_ORDER = {
            'mail': 1,
            'onsite': 2,
            'missing': 3,
            'none': 4
        };

        const getElectionStatus = (row) => {
            if (!row.hasElection) return 'none';
            if (row.electionVotes.some((v) => !!v.choice)) return 'mail';
            if (row.record?.ballot_issued) return 'onsite';
            return 'missing';
        };

        return [...filtered].sort((left, right) => {
            if (sortConfig.key === 'attendanceType') {
                const leftOrder = ATTENDANCE_SORT_ORDER[left.attendanceType] || 99;
                const rightOrder = ATTENDANCE_SORT_ORDER[right.attendanceType] || 99;

                return sortConfig.direction === 'asc' ? leftOrder - rightOrder : rightOrder - leftOrder;
            }

            if (sortConfig.key === 'electionStatus') {
                const leftOrder = ELECTION_SORT_ORDER[getElectionStatus(left)] || 99;
                const rightOrder = ELECTION_SORT_ORDER[getElectionStatus(right)] || 99;

                return sortConfig.direction === 'asc' ? leftOrder - rightOrder : rightOrder - leftOrder;
            }

            if (sortConfig.key === 'unit') {
                const leftUnit = String(left.member.unit || '');
                const rightUnit = String(right.member.unit || '');
                return sortConfig.direction === 'asc' 
                    ? leftUnit.localeCompare(rightUnit, undefined, { numeric: true }) 
                    : rightUnit.localeCompare(leftUnit, undefined, { numeric: true });
            }

            return 0;
        });
    }, [audit.memberRows, normalizedSearchTerm, sortConfig]);
    const agendaShortLabelById = useMemo(() => {
        const labels = new Map();
        audit.standardAgendas.forEach((agenda, index) => {
            labels.set(agenda.id, `제${index + 1}호`);
        });
        return labels;
    }, [audit.standardAgendas]);

    return (
        <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <div>
                    <div className="text-sm font-bold text-slate-900">조합원별 검산표</div>
                    <div className="text-xs text-slate-500">서면결의서, 우편투표, 참석 방식의 조합원별 입력 상태를 확인합니다.</div>
                </div>
                <div className="relative w-full max-w-xs">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="동호수, 성명, 대리인 검색"
                        className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
                    />
                </div>
            </div>
            <div className="max-h-[calc(100vh-240px)] overflow-auto">
                <table className="w-full table-fixed text-sm">
                    <thead className="sticky top-0 z-30 bg-slate-100 text-left text-[11px] font-black uppercase text-slate-600 shadow-lg">
                        <tr>
                            <th 
                                onClick={() => toggleSort('unit')}
                                className="sticky left-0 top-0 z-40 w-10 cursor-pointer bg-slate-100 px-0.5 py-2 text-center whitespace-nowrap hover:bg-slate-200"
                            >
                                <div className="flex items-center justify-center gap-0.5">
                                    ID
                                    <div className="flex flex-col text-[10px] leading-[0.6]">
                                        <ChevronUp size={10} className={sortConfig.key === 'unit' && sortConfig.direction === 'asc' ? 'text-blue-600' : 'text-slate-400'} />
                                        <ChevronDown size={10} className={sortConfig.key === 'unit' && sortConfig.direction === 'desc' ? 'text-blue-600' : 'text-slate-400'} />
                                    </div>
                                </div>
                            </th>
                            <th className="sticky left-10 top-0 z-40 w-16 bg-slate-100 px-0.5 py-2 text-center whitespace-nowrap border-r border-slate-200/50">상태</th>
                            <th className="sticky left-[104px] top-0 z-40 w-[92px] bg-slate-100 px-0.5 py-2 text-center whitespace-nowrap">조합원(대리인)</th>
                            <th
                                onClick={() => toggleSort('attendanceType')}
                                className="sticky left-[196px] top-0 z-40 w-[72px] cursor-pointer bg-slate-100 px-0.5 py-2 text-center whitespace-nowrap hover:bg-slate-200"
                            >
                                <div className="flex items-center justify-center gap-0.5 text-[11px] font-black">
                                    안건의결
                                    <div className="flex flex-col text-[10px] leading-[0.6]">
                                        <ChevronUp size={10} className={sortConfig.key === 'attendanceType' && sortConfig.direction === 'asc' ? 'text-blue-600' : 'text-slate-400'} />
                                        <ChevronDown size={10} className={sortConfig.key === 'attendanceType' && sortConfig.direction === 'desc' ? 'text-blue-600' : 'text-slate-400'} />
                                    </div>
                                </div>
                            </th>
                            <th 
                                onClick={() => toggleSort('electionStatus')}
                                className="sticky left-[268px] top-0 z-40 w-[72px] cursor-pointer bg-slate-100 px-0.5 py-2 text-center whitespace-nowrap hover:bg-slate-200"
                            >
                                <div className="flex items-center justify-center gap-0.5 text-[11px] font-black">
                                    선거
                                    <div className="flex flex-col text-[10px] leading-[0.6]">
                                        <ChevronUp size={10} className={sortConfig.key === 'electionStatus' && sortConfig.direction === 'asc' ? 'text-blue-600' : 'text-slate-400'} />
                                        <ChevronDown size={10} className={sortConfig.key === 'electionStatus' && sortConfig.direction === 'desc' ? 'text-blue-600' : 'text-slate-400'} />
                                    </div>
                                </div>
                            </th>
                            {audit.standardAgendas.map((agenda) => (
                                <th key={agenda.id} className="w-[54px] px-0.5 py-1 text-center text-[11px] font-black border-r border-slate-100 leading-tight">{agendaShortLabelById.get(agenda.id)}</th>
                            ))}
                            {audit.electionAgendas.map((agenda) => {
                                const fullLabel = agenda.title || getElectionRule(agenda, audit.electionAgendas).label;
                                const shortLabel = fullLabel.replace(/^(조합장후보|이사후보\d+)\s+.*\s+찬반투표$/, '$1');
                                
                                return (
                                    <th key={agenda.id} className="w-[54px] bg-slate-100 px-0.5 py-1 text-center text-[11px] font-black text-indigo-700 border-r border-slate-200 leading-tight">
                                        <span className="block truncate font-black" title={fullLabel}>
                                            {shortLabel}
                                        </span>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, idx) => (
                            <tr key={row.member.id} className={`group border-t border-slate-100 hover:bg-blue-100/30 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/20' : ''}`}>
                                <td className="sticky left-0 z-20 w-10 bg-slate-50 group-hover:bg-blue-100/40 px-0.5 py-2.5 text-center font-mono text-[11px] font-bold text-slate-600">
                                    {row.member.unit || '-'}
                                </td>
                                <td className="sticky left-10 z-20 w-16 bg-slate-50 group-hover:bg-blue-100/40 px-0.5 py-2.5 text-center border-r border-slate-200/30">
                                    {row.issues.length > 0 ? (
                                        <div className="space-y-0.5">
                                            {row.issues.map((issue) => (
                                                <div key={issue} className="mx-auto w-fit rounded-full border border-amber-200 bg-amber-50 px-1 py-0 text-[9px] font-bold text-amber-700 leading-none">
                                                    {issue}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="inline-flex rounded-full border border-lime-200 bg-lime-50 px-1.5 py-0 text-[9px] font-bold text-lime-700">
                                            정상
                                        </span>
                                    )}
                                </td>
                                <td className="sticky left-[104px] z-20 w-[92px] bg-slate-50 group-hover:bg-blue-100/40 px-0.5 py-2.5 text-center">
                                    <div className="mx-auto max-w-[84px] truncate whitespace-nowrap text-[12px] font-bold text-slate-800" title={row.proxyName ? `${row.member.name} (${row.proxyName})` : row.member.name}>
                                        {row.member.name}
                                        {row.proxyName && <span className="ml-0.5 text-[12px] font-normal text-slate-500">({row.proxyName})</span>}
                                    </div>
                                </td>
                                <td className="sticky left-[196px] z-20 w-[72px] bg-slate-50 group-hover:bg-blue-100/40 px-0.5 py-2.5 text-center">
                                    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-black transition-all ${getAttendanceClass(row.attendanceType, false)}`}>
                                        {ATTENDANCE_TYPE_LABELS[row.attendanceType] || '-'}
                                    </span>
                                </td>
                                <td className="sticky left-[268px] z-20 w-[72px] bg-slate-50 group-hover:bg-blue-100/40 px-0.5 py-2.5 text-center">
                                    {(() => {
                                        const hasMail = row.electionVotes.some((v) => !!v.choice);
                                        const isIssued = !!row.record?.ballot_issued;
                                        const status = !row.hasElection ? 'none' : (hasMail ? 'mail' : (isIssued ? 'onsite' : 'missing'));
                                        
                                        return (
                                            <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0 text-[9px] font-bold transition-all ${getElectionStatusClass(status)}`}>
                                                {ELECTION_STATUS_LABELS[status]}
                                            </span>
                                        );
                                    })()}
                                </td>
                                {row.standardVotes.map((vote) => {
                                    const isOnsite = row.attendanceType === 'direct' || row.attendanceType === 'proxy';
                                    const displayChoice = vote.choice || (isOnsite ? 'onsite' : 'missing');
                                    const isOnlyOnsite = displayChoice === 'onsite';
                                    
                                    return (
                                        <td key={`${row.member.id}-${vote.agendaId}`} className="w-[54px] px-0.5 py-1.5 text-center bg-lime-50/20 group-hover:bg-lime-200/40 border-r border-lime-100/20 transition-colors">
                                            <span className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0 text-[10px] font-bold ${getChoiceClass(displayChoice)}`}>
                                                {getChoiceLabel(displayChoice)}
                                            </span>
                                        </td>
                                    );
                                })}
                                {row.electionVotes.map((vote) => {
                                    const hasMailVote = !!vote.choice;
                                    const hasOnsiteBallot = !!row.record?.ballot_issued;
                                    
                                    return (
                                        <td key={`${row.member.id}-${vote.agendaId}`} className="w-[54px] px-0.5 py-1.5 text-center bg-sky-50/30 group-hover:bg-sky-200/50 border-r border-sky-100/20 transition-colors">
                                            {hasMailVote ? (
                                                <span className="inline-flex items-center gap-0.5 rounded-full border border-emerald-200 bg-emerald-50 px-1 py-0 text-[10px] font-bold text-emerald-700">
                                                    우편✓
                                                </span>
                                            ) : hasOnsiteBallot ? (
                                                <span className="inline-flex items-center gap-0.5 rounded-full border border-cyan-200 bg-cyan-50 px-1 py-0 text-[10px] font-bold text-cyan-700">
                                                    현장✓
                                                </span>
                                            ) : (
                                                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-1 py-0 text-[10px] font-bold text-slate-400">
                                                    –
                                                </span>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={5 + audit.standardAgendas.length + audit.electionAgendas.length} className="px-5 py-12 text-center text-sm text-slate-400">
                                    검색 결과가 없습니다.
                                </td>
                            </tr>
                        )}
                    </tbody>
                    <tfoot className="sticky bottom-0 z-30 bg-slate-100 font-bold text-slate-700 shadow-[0_-6px_15px_-3px_rgba(0,0,0,0.25)]">
                        <tr className="border-t-2 border-slate-200">
                            <td className="sticky left-0 z-40 bg-slate-100 px-0.5 py-2 align-top"></td>
                            <td colSpan={2} className="sticky left-10 z-40 bg-slate-100 px-1 py-2 text-center border-r border-slate-200/60 align-top">
                                <div className="flex flex-col items-center leading-tight">
                                    <span className="text-[12px] font-black text-slate-900">검산 합계</span>
                                    <span className="text-[9px] font-medium text-slate-400 uppercase tracking-tighter">Audit Total</span>
                                </div>
                            </td>
                            {(() => {
                                const stats = rows.reduce((acc, row) => {
                                    acc.agenda[row.attendanceType] = (acc.agenda[row.attendanceType] || 0) + 1;
                                    if (row.hasElection) {
                                        const hasMail = row.electionVotes.some(v => !!v.choice);
                                        const isAttending = row.attendanceType === 'direct' || row.attendanceType === 'proxy';
                                        
                                        if (hasMail) {
                                            acc.election.mail += 1;
                                        } else if (isAttending) {
                                            acc.election.onsite += 1;
                                        }
                                    }
                                    return acc;
                                }, { agenda: {}, election: { mail: 0, onsite: 0 } });

                                return (
                                    <>
                                        <td className="sticky left-[196px] z-40 bg-slate-100 px-0.5 py-2 text-center border-x border-slate-200/60 align-top">
                                            <div className="flex flex-col gap-0.5 text-center text-[10px] leading-tight">
                                                <div className="mb-0.5 border-b border-slate-300 pb-0.5 font-black text-slate-900 leading-none">
                                                    총 {(stats.agenda.written || 0) + (stats.agenda.direct || 0) + (stats.agenda.proxy || 0)}
                                                </div>
                                                <span className="text-indigo-600 font-bold">서면 {stats.agenda.written || 0}</span>
                                                <span className="text-cyan-600 font-bold">직접 {stats.agenda.direct || 0}</span>
                                                <span className="text-blue-600 font-bold">대리 {stats.agenda.proxy || 0}</span>
                                            </div>
                                        </td>
                                        <td className="sticky left-[268px] z-40 bg-slate-100 px-0.5 py-2 text-center align-top">
                                            <div className="flex flex-col gap-0.5 text-center text-[10px] leading-tight text-indigo-700 font-bold">
                                                <div className="mb-0.5 border-b border-slate-300 pb-0.5 font-black text-indigo-900 leading-none">
                                                    총 {stats.election.mail + stats.election.onsite}
                                                </div>
                                                <span>우편 {stats.election.mail}</span>
                                                <span>현장 {stats.election.onsite}</span>
                                            </div>
                                        </td>
                                        {audit.standardAgendas.map((agenda) => {
                                            const result = audit.agendaResults.find((r) => r.id === agenda.id);
                                            const totalVoted = (result?.final.yes || 0) + (result?.final.no || 0) + (result?.final.abstain || 0);
                                            const notVoted = Math.max(0, (result?.attendanceCount || 0) - totalVoted);
                                            
                                            return (
                                                <td key={agenda.id} className="w-[54px] px-0.5 py-2 text-center border-r border-slate-200 bg-slate-100 align-top">
                                                    <div className="flex flex-col gap-0.5 text-center text-[10px] leading-tight">
                                                        <div className="mb-0.5 border-b border-slate-300 pb-0.5 font-black text-slate-900 leading-none">
                                                            총 {result?.attendanceCount || 0}
                                                        </div>
                                                        <span className="text-lime-700 font-bold">찬 {result?.final.yes || 0}</span>
                                                        <span className="text-rose-700 font-bold">반 {result?.final.no || 0}</span>
                                                        <span className="text-slate-600 font-medium">기 {result?.final.abstain || 0}</span>
                                                        <span className="mt-0.5 border-t border-slate-200 pt-0.5 text-[9px] font-bold text-amber-600">
                                                            미 {notVoted}
                                                        </span>
                                                    </div>
                                                </td>
                                            );
                                        })}
                                        {audit.electionAgendas.map((agenda) => {
                                            const result = audit.agendaResults.find((r) => r.id === agenda.id);
                                            const totalVoted = (result?.final.yes || 0) + (result?.final.no || 0) + (result?.final.abstain || 0);
                                            const notVoted = Math.max(0, (result?.attendanceCount || 0) - totalVoted);
                                            
                                            return (
                                                <td key={agenda.id} className="w-[54px] px-0.5 py-2 text-center border-r border-slate-200 bg-slate-100 align-top">
                                                    <div className="flex flex-col gap-0.5 text-center text-[10px] leading-tight">
                                                        <div className="mb-0.5 border-b border-slate-300 pb-0.5 font-black text-indigo-900 leading-none">
                                                            총 {result?.attendanceCount || 0}
                                                        </div>
                                                        <span className="text-indigo-700 font-bold">찬 {result?.final.yes || 0}</span>
                                                        <span className="text-rose-700 font-bold">반 {result?.final.no || 0}</span>
                                                        <span className="text-slate-600 font-medium">기 {result?.final.abstain || 0}</span>
                                                        <span className="mt-0.5 border-t border-slate-200 pt-0.5 text-[9px] font-bold text-amber-600">
                                                            미 {notVoted}
                                                        </span>
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </>
                                );
                            })()}
                        </tr>
                    </tfoot>
                </table>
            </div>
        </Card>
    );
}

function ManualTab({
    sourceType,
    setSourceType,
    manualResults,
    setManualResults,
    finalResults,
    overrideReason,
    setOverrideReason,
    onConfirm,
    isSaving
}) {
    const updateManualResult = (agendaId, field, value) => {
        setManualResults((prev) => ({
            ...prev,
            [agendaId]: {
                ...(prev[agendaId] || {}),
                [field]: value
            }
        }));
    };

    const standardResults = finalResults.filter((r) => !r.isElection);
    const electionResults = finalResults.filter((r) => r.isElection);
    const hasElection = electionResults.length > 0;

    const renderTable = (results, isElection) => (
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
                <thead className={`text-left text-xs font-bold uppercase tracking-[0.12em] ${isElection ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-50 text-slate-500'}`}>
                    <tr>
                        <th className="px-5 py-3">{isElection ? '후보자/선거' : '안건'}</th>
                        <th className="px-5 py-3 text-center">출석</th>
                        <th className="px-5 py-3 text-center">{isElection ? '득표/찬성' : '찬성'}</th>
                        <th className="px-5 py-3 text-center">{isElection ? '미선택/반대' : '반대'}</th>
                        <th className="px-5 py-3 text-center">기권/무효</th>
                        <th className="px-5 py-3 text-center">결과</th>
                    </tr>
                </thead>
                <tbody>
                    {results.map((result) => {
                        const manual = manualResults[result.id] || {};
                        const editable = sourceType === 'manual';

                        return (
                            <tr key={result.id} className="border-t border-slate-100">
                                <td className="px-5 py-3">
                                    <div className="font-bold text-slate-900">{result.title}</div>
                                    {result.resultReason && (
                                        <div className="mt-1 text-xs font-semibold text-slate-600">사유: {result.resultReason}</div>
                                    )}
                                </td>
                                {['attendanceCount', 'yes', 'no', 'abstain'].map((field) => (
                                    <td key={field} className="px-5 py-3 text-center">
                                        {editable ? (
                                            <NumberInput
                                                value={manual[field]}
                                                onChange={(value) => updateManualResult(result.id, field, value)}
                                            />
                                        ) : (
                                            <span className="font-semibold text-slate-800">
                                                {formatNumber(field === 'attendanceCount' ? result.attendanceCount : result.final[field])}
                                            </span>
                                        )}
                                    </td>
                                ))}
                                <td className="px-5 py-3 text-center">
                                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${getResultClass(result.result)}`}>
                                        {result.result}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                    {results.length === 0 && (
                        <tr>
                            <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-400">
                                해당되는 안건이 없습니다.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="space-y-4">
            <Card className="p-5">
                <div className="text-sm font-bold text-slate-900">집계 방식 선택</div>
                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    {Object.entries(CONFIRMATION_SOURCE_LABELS).map(([value, label]) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setSourceType(value)}
                            className={`rounded-xl border px-4 py-4 text-left transition-colors ${sourceType === value ? 'border-blue-300 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                        >
                            <div className="text-sm font-bold text-slate-900">{label}</div>
                            <div className="mt-1 text-xs leading-relaxed text-slate-500">
                                {value === 'auto' && '안내데스크와 관리자 입력 합산값을 그대로 사용합니다.'}
                                {value === 'matrix' && '검산표를 눈으로 확인한 뒤 동일 집계값으로 확정합니다.'}
                                {value === 'manual' && '안건별 숫자를 직접 입력해 최종값으로 사용합니다.'}
                            </div>
                        </button>
                    ))}
                </div>
            </Card>

            <Card className="overflow-hidden">
                <div className="border-b border-slate-200 px-5 py-4">
                    <div className="text-sm font-bold text-slate-900">일반 의결 안건 최종 확정 현황</div>
                    <div className="text-xs text-slate-500">일반 안건의 수기 확정 모드에서만 숫자를 직접 수정할 수 있습니다.</div>
                </div>
                {renderTable(standardResults, false)}
            </Card>

            {hasElection && (
                <Card className="overflow-hidden">
                    <div className="border-b border-slate-200 px-5 py-4">
                        <div className="text-sm font-bold text-slate-900">임원 선거 투표 최종 확정 현황</div>
                        <div className="text-xs text-slate-500">선거 안건의 수기 확정 모드에서만 숫자를 직접 수정할 수 있습니다.</div>
                    </div>
                    {renderTable(electionResults, true)}
                </Card>
            )}

            <Card className="p-5 space-y-4">
                <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">보정 및 확인 메모</label>
                    <textarea
                        value={overrideReason}
                        onChange={(event) => setOverrideReason(event.target.value)}
                        rows={4}
                        placeholder="예: 제2호 안건 서면결의서 1건을 원본 확인 후 기권으로 수기 확정"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-blue-500"
                    />
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                        variant="primary"
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={onConfirm}
                        disabled={isSaving}
                    >
                        <Save size={16} />
                        {isSaving ? '저장 중...' : '최종 확정 저장'}
                    </Button>
                </div>
            </Card>
        </div>
    );
}

function CertificatePreview({
    audit,
    finalResults,
    sourceType,
    meetingDetails,
    setMeetingDetails,
    committeeMembers,
    setCommitteeMembers,
    confirmation,
    onPrint
}) {
    const updateCommitteeMember = (index, field, value) => {
        setCommitteeMembers((prev) => prev.map((member, currentIndex) => (
            currentIndex === index ? { ...member, [field]: value } : member
        )));
    };

    const standardResults = finalResults.filter((r) => !r.isElection);
    const electionResults = finalResults.filter((r) => r.isElection);
    const hasElection = electionResults.length > 0;

    return (
        <div className="space-y-4">
            <div className="no-print grid gap-4 xl:grid-cols-[1fr_360px]">
                <Card className="p-5">
                    <div className="grid gap-3 md:grid-cols-3">
                        <div>
                            <label className="mb-1 block text-xs font-bold text-slate-400">총회 명칭</label>
                            <input
                                value={meetingDetails.title}
                                onChange={(event) => setMeetingDetails((prev) => ({ ...prev, title: event.target.value }))}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-bold text-slate-400">개최 일시</label>
                            <input
                                value={meetingDetails.heldAt}
                                onChange={(event) => setMeetingDetails((prev) => ({ ...prev, heldAt: event.target.value }))}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-bold text-slate-400">개최 장소</label>
                            <input
                                value={meetingDetails.location}
                                onChange={(event) => setMeetingDetails((prev) => ({ ...prev, location: event.target.value }))}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>
                </Card>
                <Card className="p-5">
                    <div className="text-sm font-bold text-slate-900">출력</div>
                    <div className="mt-2 text-xs leading-relaxed text-slate-500">
                        브라우저 인쇄에서 PDF 저장을 선택하면 확인서 파일로 보관할 수 있습니다.
                    </div>
                    <Button variant="primary" className="mt-4 w-full bg-blue-600 hover:bg-blue-700" onClick={onPrint}>
                        <Printer size={16} />
                        인쇄 / PDF 저장
                    </Button>
                </Card>
            </div>

            <div id="certificate-print-area" className="bg-white px-8 py-10 text-slate-950 shadow-sm ring-1 ring-slate-200 print:shadow-none print:ring-0">
                <div className="text-center">
                    <div className="text-sm font-bold text-slate-700">대방동 지역주택조합</div>
                    <h1 className="mt-[6px] text-[28px] font-black tracking-normal">선거관리위원회 투표결과 확인서</h1>
                </div>

                <section className="mt-8">
                    <h2 className="border-b-2 border-slate-900 pb-2 text-base font-black">총회 기본사항</h2>
                    <table className="mt-3 w-full border-collapse text-sm">
                        <tbody>
                            {[
                                ['총회 명칭', meetingDetails.title || '-'],
                                ['개최 일시', meetingDetails.heldAt || '-'],
                                ['개최 장소', meetingDetails.location || '-'],
                                ['선거관리위원장', committeeMembers[0]?.name || '-']
                            ].map(([label, value]) => (
                                <tr key={label}>
                                    <th className="w-40 border border-slate-400 bg-slate-100 px-3 py-2 text-left font-bold">{label}</th>
                                    <td className="border border-slate-400 px-3 py-2">{value}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>

                <section className="mt-7">
                    <h2 className="border-b-2 border-slate-900 pb-2 text-base font-black">참석 현황</h2>
                    <table className="mt-3 w-full border-collapse text-center text-sm">
                        <thead>
                            <tr className="bg-slate-50">
                                <th className="border border-slate-400 px-2 py-2">전체 조합원 수</th>
                                <th className="border border-slate-400 px-2 py-2">직접 출석</th>
                                <th className="border border-slate-400 px-2 py-2">대리 참석</th>
                                <th className="border border-slate-400 px-2 py-2">서면결의서 제출</th>
                                <th className="border border-slate-400 px-2 py-2">출석 인정 합계</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="border border-slate-400 px-2 py-2">{formatNumber(audit.activeMembers.length)}명</td>
                                <td className="border border-slate-400 px-2 py-2">{formatNumber(audit.meetingStats.direct)}명</td>
                                <td className="border border-slate-400 px-2 py-2">{formatNumber(audit.meetingStats.proxy)}명</td>
                                <td className="border border-slate-400 px-2 py-2">{formatNumber(audit.meetingStats.written)}명</td>
                                <td className="border border-slate-400 px-2 py-2">{formatNumber(audit.meetingStats.total)}명</td>
                            </tr>
                        </tbody>
                    </table>
                </section>

                <section className="mt-7">
                    <h2 className="border-b-2 border-slate-900 pb-2 text-base font-black">일반 안건 의결 결과</h2>
                    <table className="mt-3 w-full border-collapse text-center text-sm table-fixed">
                        <thead>
                            <tr className="bg-slate-50">
                                <th className="border border-slate-400 px-2 py-2 w-[43%]">안건</th>
                                <th className="border border-slate-400 px-1 py-2 w-[8%]">출석</th>
                                <th className="border border-slate-400 px-1 py-2 w-[8%]">찬성</th>
                                <th className="border border-slate-400 px-1 py-2 w-[8%]">반대</th>
                                <th className="border border-slate-400 px-1 py-2 w-[8%]">무효</th>
                                <th className="border border-slate-400 px-2 py-2 w-[13%]">결과</th>
                                <th className="border border-slate-400 px-2 py-2 w-[12%]">비고</th>
                            </tr>
                        </thead>
                        <tbody>
                            {standardResults.map((result, index) => (
                                <tr key={result.id}>
                                    <td className="border border-slate-400 px-2 py-2 text-left">
                                        제{index + 1}호 {result.title}
                                        <div className="mt-1 text-xs text-slate-600">{result.thresholdLabel}</div>
                                    </td>
                                    <td className="border border-slate-400 px-2 py-2">{formatNumber(result.attendanceCount)}명</td>
                                    <td className="border border-slate-400 px-2 py-2">{formatNumber(result.final.yes)}표</td>
                                    <td className="border border-slate-400 px-2 py-2">{formatNumber(result.final.no)}표</td>
                                    <td className="border border-slate-400 px-2 py-2">{formatNumber(result.final.abstain)}표</td>
                                    <td className="border border-slate-400 px-2 py-2 font-bold whitespace-pre-line">
                                        {result.result === '유회 (성원 미달)' ? '유회\n(성원 미달)' : result.result}
                                    </td>
                                    <td className="border border-slate-400 px-2 py-2 text-center text-xs leading-relaxed">{result.resultReason || '-'}</td>
                                </tr>
                            ))}
                            {standardResults.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="border border-slate-400 px-2 py-4 text-slate-400">
                                        일반 의결 안건이 없습니다.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </section>

                {hasElection && (
                    <section className="mt-7">
                        <h2 className="border-b-2 border-slate-900 pb-2 text-base font-black">임원 선거 투표 결과</h2>
                        <table className="mt-3 w-full border-collapse text-center text-sm table-fixed">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className="border border-slate-400 px-2 py-2 w-[43%]">후보자/선거</th>
                                    <th className="border border-slate-400 px-1 py-2 w-[8%]">출석</th>
                                    <th className="border border-slate-400 px-1 py-2 w-[8%]">찬성</th>
                                    <th className="border border-slate-400 px-1 py-2 w-[8%]">반대</th>
                                    <th className="border border-slate-400 px-1 py-2 w-[8%]">무효</th>
                                    <th className="border border-slate-400 px-2 py-2 w-[13%]">결과</th>
                                    <th className="border border-slate-400 px-2 py-2 w-[12%]">비고</th>
                                </tr>
                            </thead>
                            <tbody>
                                {electionResults.map((result) => (
                                    <tr key={result.id}>
                                        <td className="border border-slate-400 px-2 py-2 text-left font-bold text-slate-900">
                                            {result.title}
                                            <div className="mt-1 font-normal text-xs text-slate-600">{result.thresholdLabel}</div>
                                        </td>
                                        <td className="border border-slate-400 px-2 py-2">{formatNumber(result.attendanceCount)}명</td>
                                        <td className="border border-slate-400 px-2 py-2">{formatNumber(result.final.yes)}표</td>
                                        <td className="border border-slate-400 px-2 py-2">{formatNumber(result.final.no)}표</td>
                                        <td className="border border-slate-400 px-2 py-2">{formatNumber(result.final.abstain)}표</td>
                                        <td className="border border-slate-400 px-2 py-2 font-bold whitespace-pre-line">
                                            {result.result === '유회 (성원 미달)' ? '유회\n(성원 미달)' : result.result}
                                        </td>
                                        <td className="border border-slate-400 px-2 py-2 text-center text-xs leading-relaxed">{result.resultReason || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                )}

                <section className="mt-7 print:break-before-page">
                    <h2 className="border-b-2 border-slate-900 pb-2 text-base font-black">선거관리위원회 확인</h2>
                    <p className="mt-4 text-sm leading-7">
                        위 선거관리위원회는 본 총회의 참석 현황, 안건별 의결 결과 및 임원 선거 결과를 확인하였으며,
                        집계 과정이 공정하게 관리·운영되었고 위 기재된 집계 내용이 실제 투표 및 의결 결과와
                        다름이 없음을 확인합니다.
                    </p>
                    <div className="mt-[8cm] text-center text-base font-bold">{formatKoreanDate(confirmation?.certificateDate || new Date())}</div>


                    <table className="mt-5 w-2/3 mx-auto border-collapse text-center text-sm">
                        <thead>
                            <tr className="bg-slate-50">
                                <th className="border border-slate-400 px-2 py-2">직위</th>
                                <th className="border border-slate-400 px-2 py-2">성명</th>
                                <th className="border border-slate-400 px-2 py-2">서명 또는 날인</th>
                            </tr>
                        </thead>
                        <tbody>
                            {committeeMembers.map((member, index) => (
                                <tr key={`${member.role}-signature-${index}`}>
                                    <td className="border border-slate-400 px-2 py-4">{member.role || '-'}</td>
                                    <td className="border border-slate-400 px-2 py-4">{member.name || '-'}</td>
                                    <td className="border border-slate-400 px-2 py-4 text-center text-slate-300">(인)</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="mt-28 text-center text-[30px] font-black leading-tight">대방동 지역주택조합 선거관리위원회</div>
                </section>
            </div>
        </div>
    );
}

export default function AdminTallyPage() {
    const { state, actions } = useStore();
    const { agendas, members, attendance, mailElectionVotes, activeMeetingId, currentMeetingId, currentAgendaId, voteData } = state;
    const inactiveMemberIds = Array.isArray(voteData?.inactiveMemberIds) ? voteData.inactiveMemberIds : EMPTY_INACTIVE_MEMBER_IDS;
    const groups = useMemo(() => buildAgendaGroups(agendas), [agendas]);
    const initialMeetingId = useMemo(() => getDefaultMeetingId({
        agendas,
        activeMeetingId,
        currentMeetingId,
        currentAgendaId
    }), [activeMeetingId, agendas, currentAgendaId, currentMeetingId]);

    const [selectedMeetingId, setSelectedMeetingId] = useState(initialMeetingId);
    const [activeTab, setActiveTab] = useState('summary');
    const [writtenVotes, setWrittenVotes] = useState([]);
    const [writtenVoteError, setWrittenVoteError] = useState('');
    const [sourceType, setSourceType] = useState(voteData?.tallyConfirmation?.sourceType || 'auto');
    const [manualResults, setManualResults] = useState(voteData?.tallyConfirmation?.manualResults || {});
    const [overrideReason, setOverrideReason] = useState(voteData?.tallyConfirmation?.overrideReason || '');
    const [isSaving, setIsSaving] = useState(false);
    const [meetingDetails, setMeetingDetails] = useState({
        title: voteData?.tallyConfirmation?.meetingDetails?.title || '',
        heldAt: voteData?.tallyConfirmation?.meetingDetails?.heldAt || formatKoreanDate(new Date()),
        location: voteData?.tallyConfirmation?.meetingDetails?.location || ''
    });
    const [committeeMembers, setCommitteeMembers] = useState(
        voteData?.tallyConfirmation?.committeeMembers || DEFAULT_COMMITTEE_MEMBERS
    );

    useEffect(() => {
        if (!selectedMeetingId && initialMeetingId) {
            setSelectedMeetingId(initialMeetingId);
        }
    }, [initialMeetingId, selectedMeetingId]);

    const selectedMeeting = useMemo(
        () => agendas.find((agenda) => agenda.id === selectedMeetingId && agenda.type === 'folder') || null,
        [agendas, selectedMeetingId]
    );

    useEffect(() => {
        if (!meetingDetails.title && selectedMeeting?.title) {
            setMeetingDetails((prev) => ({ ...prev, title: selectedMeeting.title }));
        }
    }, [meetingDetails.title, selectedMeeting]);

    const meetingAgendaIds = useMemo(() => {
        const group = groups.find((item) => item.folder?.id === selectedMeetingId);
        return (group?.items || []).map((agenda) => agenda.id);
    }, [groups, selectedMeetingId]);

    useEffect(() => {
        let isMounted = true;

        const loadWrittenVotes = async () => {
            if (!selectedMeetingId || meetingAgendaIds.length === 0) {
                setWrittenVotes([]);
                setWrittenVoteError('');
                return;
            }

            const { data, error } = await supabase
                .from('written_votes')
                .select('meeting_id, agenda_id, member_id, choice')
                .eq('meeting_id', selectedMeetingId)
                .in('agenda_id', meetingAgendaIds);

            if (!isMounted) return;

            if (error) {
                setWrittenVoteError(error.message || '서면결의서 상세 데이터를 불러오지 못했습니다.');
                setWrittenVotes([]);
                return;
            }

            setWrittenVoteError('');
            setWrittenVotes(data || []);
        };

        loadWrittenVotes();

        return () => {
            isMounted = false;
        };
    }, [meetingAgendaIds, selectedMeetingId]);

    const audit = useMemo(() => buildTallyAudit({
        agendas,
        members,
        attendance,
        mailElectionVotes,
        writtenVotes,
        meetingId: selectedMeetingId,
        inactiveMemberIds
    }), [agendas, attendance, inactiveMemberIds, mailElectionVotes, members, selectedMeetingId, writtenVotes]);

    useEffect(() => {
        if (Object.keys(manualResults || {}).length === 0 && audit.agendaResults.length > 0) {
            setManualResults(buildManualResultsFromAgendaResults(audit.agendaResults));
        }
    }, [audit.agendaResults, manualResults]);

    const finalResults = useMemo(
        () => applyManualResults(audit.agendaResults, manualResults, sourceType),
        [audit.agendaResults, manualResults, sourceType]
    );

    const confirmation = voteData?.tallyConfirmation || null;

    const handleResetManualValues = () => {
        setManualResults(buildManualResultsFromAgendaResults(audit.agendaResults));
    };

    const handleConfirm = async () => {
        setIsSaving(true);
        try {
            const payload = {
                meetingId: selectedMeetingId,
                sourceType,
                manualResults,
                finalResults: finalResults.map((result) => ({
                    id: result.id,
                    title: result.title,
                    type: result.type,
                    attendanceCount: result.attendanceCount,
                    final: result.final,
                    result: result.result,
                    resultReason: result.resultReason || '',
                    isWithdrawn: !!result.isWithdrawn,
                    thresholdLabel: result.thresholdLabel
                })),
                meetingStats: audit.meetingStats,
                activeMemberCount: audit.activeMembers.length,
                overrideReason,
                meetingDetails,
                committeeMembers,
                certificateDate: new Date().toISOString(),
                confirmedAt: new Date().toISOString()
            };

            await actions.updateVoteData('tallyConfirmation', payload);
            alert('검산 결과와 확인서 정보가 최종 확정 저장되었습니다.');
        } catch (error) {
            console.error('Failed to save tally confirmation:', error);
            alert(error.message || '최종 확정 저장에 실패했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const headerContent = (
        <>
            <h2 className="mr-6 flex items-center gap-2 text-lg font-bold text-slate-800">
                <ShieldCheck size={20} className="text-blue-500" />
                Tally Audit
            </h2>
            <div className="flex flex-grow items-center gap-2">
                <div className="flex-grow"></div>
                <Link
                    href="/admin"
                    className="flex h-9 items-center gap-2 rounded-md border border-lime-500 bg-[#eaff00] px-3 text-xs font-bold text-slate-900 shadow-[0_0_15px_rgba(234,255,0,0.3)] transition-all hover:bg-[#f2ff4d] hover:shadow-[0_0_20px_rgba(234,255,0,0.5)]"
                >
                    <ArrowLeft size={14} />
                    메인 제어로 돌아가기
                </Link>
                <Button variant="secondary" className="h-9 px-3 text-xs" onClick={handleResetManualValues}>
                    <RotateCcw size={14} />
                    수기값 초기화
                </Button>
                <FullscreenToggle />
                <AuthStatus />
            </div>
        </>
    );

    return (
        <DashboardLayout
            title="검산 및 확인서"
            subtitle="Tally Audit & Certificate"
            sidebarContent={(
                <SidebarContent
                    groups={groups}
                    selectedMeetingId={selectedMeetingId}
                    setSelectedMeetingId={setSelectedMeetingId}
                    audit={audit}
                    confirmation={confirmation}
                />
            )}
            headerContent={headerContent}
        >
            <style jsx global>{`
                @media print {
                    /* Reset scroll containers for printing */
                    html, body {
                        height: auto !important;
                        overflow: visible !important;
                    }
                    
                    /* Reset dashboard layout constraints */
                    div[class*="h-screen"],
                    div[class*="h-full"],
                    main,
                    .overflow-hidden,
                    .overflow-y-auto {
                        height: auto !important;
                        overflow: visible !important;
                        position: static !important;
                    }

                    body * {
                        visibility: hidden !important;
                    }
                    
                    #certificate-print-area,
                    #certificate-print-area * {
                        visibility: visible !important;
                    }
                    
                    #certificate-print-area {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        box-shadow: none !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }

                    .no-print {
                        display: none !important;
                    }

                    @page {
                        size: A4;
                        margin: 15mm;
                    }
                }
            `}</style>

            <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                    {TAB_ITEMS.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors ${activeTab === tab.id ? 'border-blue-200 bg-blue-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                            >
                                <Icon size={16} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {writtenVoteError && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
                        서면결의서 상세 데이터를 불러오지 못했습니다. 안건별 합산 검산은 계속 가능하지만 조합원별 서면 선택 표시는 제한됩니다.
                    </div>
                )}

                {activeTab === 'summary' && (
                    <SummaryTab audit={audit} finalResults={finalResults} />
                )}

                {activeTab === 'matrix' && (
                    <MatrixTab audit={audit} />
                )}

                {activeTab === 'manual' && (
                    <ManualTab
                        sourceType={sourceType}
                        setSourceType={setSourceType}
                        manualResults={manualResults}
                        setManualResults={setManualResults}
                        finalResults={finalResults}
                        overrideReason={overrideReason}
                        setOverrideReason={setOverrideReason}
                        onConfirm={handleConfirm}
                        isSaving={isSaving}
                    />
                )}

                {activeTab === 'certificate' && (
                    <CertificatePreview
                        audit={audit}
                        finalResults={finalResults}
                        sourceType={sourceType}
                        meetingDetails={meetingDetails}
                        setMeetingDetails={setMeetingDetails}
                        committeeMembers={committeeMembers}
                        setCommitteeMembers={setCommitteeMembers}
                        confirmation={confirmation}
                        onPrint={handlePrint}
                    />
                )}
            </div>
        </DashboardLayout>
    );
}
