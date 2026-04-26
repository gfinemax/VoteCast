'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    AlertTriangle,
    ArrowLeft,
    CheckCircle2,
    ClipboardCheck,
    FileText,
    PenLine,
    Printer,
    RotateCcw,
    Save,
    Search,
    ShieldCheck,
    Table2
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
    getElectionChoiceLabel,
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
    return 'bg-rose-50 text-rose-700 border-rose-200';
};

const getChoiceLabel = (choice) => VOTE_CHOICE_LABELS[choice] || '-';

const getChoiceClass = (choice) => {
    if (choice === 'yes') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (choice === 'no') return 'bg-rose-50 text-rose-700 border-rose-200';
    if (choice === 'abstain') return 'bg-slate-100 text-slate-700 border-slate-200';
    return 'bg-amber-50 text-amber-700 border-amber-200';
};

const getElectionChoiceClass = (agenda, choice, electionAgendas = []) => {
    if (choice === 'no' && getElectionRule(agenda, electionAgendas).isContest) {
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
    return getChoiceClass(choice);
};

const getAttendanceClass = (type) => {
    if (type === 'direct') return 'border-cyan-200 bg-cyan-50 text-cyan-700';
    if (type === 'proxy') return 'border-sky-200 bg-sky-50 text-sky-700';
    if (type === 'written') return 'border-indigo-200 bg-indigo-50 text-indigo-700';
    return 'border-slate-200 bg-slate-100 text-slate-600';
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

function SummaryTab({ audit, finalResults }) {
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
            {/* 상단 통계 영역 */}
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
    const rows = useMemo(() => {
        if (!normalizedSearchTerm) return audit.memberRows;

        return audit.memberRows.filter((row) => (
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
    }, [audit.memberRows, normalizedSearchTerm]);
    const agendaShortLabelById = useMemo(() => {
        const labels = new Map();
        audit.standardAgendas.forEach((agenda, index) => {
            labels.set(agenda.id, `제${index + 1}호 안건`);
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
            <div className="overflow-x-auto">
                <table className="min-w-max table-fixed text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                        <tr>
                            <th rowSpan={2} className="sticky left-0 z-20 w-12 bg-slate-50 px-1 py-2 text-center whitespace-nowrap">ID</th>
                            <th rowSpan={2} className="sticky left-12 z-20 w-[72px] bg-slate-50 px-1 py-2 whitespace-nowrap">조합원</th>
                            <th rowSpan={2} className="sticky left-[120px] z-20 w-20 bg-slate-50 px-1 py-2 text-center whitespace-nowrap">참석방식</th>
                            <th rowSpan={2} className="sticky left-[200px] z-20 w-16 bg-slate-50 px-1 py-2 text-center whitespace-nowrap">대리인</th>
                            {audit.standardAgendas.length > 0 && (
                                <th colSpan={audit.standardAgendas.length} className="border-b border-slate-200 px-1 py-2 text-center text-slate-600">
                                    의결안건 {audit.standardAgendas.length}건
                                </th>
                            )}
                            {audit.electionAgendas.length > 0 && (
                                <th colSpan={audit.electionAgendas.length} className="border-b border-indigo-100 bg-indigo-50 px-1 py-2 text-center text-indigo-700">
                                    임원 선거 {audit.electionAgendas.length}건
                                </th>
                            )}
                            <th rowSpan={2} className="w-24 bg-slate-50 px-1 py-2 text-center">상태</th>
                        </tr>
                        <tr>
                            {audit.standardAgendas.map((agenda) => (
                                <th key={agenda.id} className="w-20 px-1 py-2 text-center">{agendaShortLabelById.get(agenda.id)}</th>
                            ))}
                            {audit.electionAgendas.map((agenda) => (
                                <th key={agenda.id} className="w-28 bg-indigo-50 px-1 py-2 text-center text-indigo-700">
                                    <span className="block truncate" title={agenda.title || getElectionRule(agenda, audit.electionAgendas).label}>
                                        {agenda.title || getElectionRule(agenda, audit.electionAgendas).label}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.member.id} className="border-t border-slate-100">
                                <td className="sticky left-0 z-20 w-12 bg-white px-1 py-3 text-center font-mono text-xs font-bold text-slate-500">
                                    {row.member.unit || '-'}
                                </td>
                                <td className="sticky left-12 z-20 w-[72px] bg-white px-1 py-3">
                                    <div className="max-w-[64px] truncate whitespace-nowrap font-bold text-slate-900" title={row.member.name}>{row.member.name}</div>
                                </td>
                                <td className="sticky left-[120px] z-20 w-20 bg-white px-1 py-3 text-center">
                                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${getAttendanceClass(row.attendanceType)}`}>
                                        {ATTENDANCE_TYPE_LABELS[row.attendanceType] || '-'}
                                    </span>
                                </td>
                                <td className="sticky left-[200px] z-20 w-16 bg-white px-1 py-3 text-center text-slate-600">
                                    <span className="inline-block max-w-14 truncate align-middle" title={row.proxyName || '-'}>
                                        {row.proxyName || '-'}
                                    </span>
                                </td>
                                {row.standardVotes.map((vote) => (
                                    <td key={`${row.member.id}-${vote.agendaId}`} className="w-20 px-1 py-3 text-center">
                                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${getChoiceClass(vote.choice || 'missing')}`}>
                                            {getChoiceLabel(vote.choice || 'missing')}
                                        </span>
                                    </td>
                                ))}
                                {row.electionVotes.map((vote) => (
                                    <td key={`${row.member.id}-${vote.agendaId}`} className="w-28 px-1 py-3 text-center">
                                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${getElectionChoiceClass(vote.agenda, vote.choice || 'missing', audit.electionAgendas)}`}>
                                            {getElectionChoiceLabel(vote.agenda, vote.choice || 'missing', audit.electionAgendas)}
                                        </span>
                                    </td>
                                ))}
                                <td className="w-24 px-1 py-3 text-center">
                                    {row.issues.length > 0 ? (
                                        <div className="space-y-1">
                                            {row.issues.map((issue) => (
                                                <div key={issue} className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                                                    {issue}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                                            정상
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={4 + audit.standardAgendas.length + audit.electionAgendas.length} className="px-5 py-12 text-center text-sm text-slate-400">
                                    검색 결과가 없습니다.
                                </td>
                            </tr>
                        )}
                    </tbody>
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
                    <h1 className="mt-3 text-2xl font-black tracking-normal">선거관리위원회 투표결과 확인서</h1>
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
                            <tr className="bg-slate-100">
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
                    <table className="mt-3 w-full border-collapse text-center text-sm">
                        <thead>
                            <tr className="bg-slate-100">
                                <th className="border border-slate-400 px-2 py-2">안건</th>
                                <th className="border border-slate-400 px-2 py-2">출석</th>
                                <th className="border border-slate-400 px-2 py-2">찬성</th>
                                <th className="border border-slate-400 px-2 py-2">반대</th>
                                <th className="border border-slate-400 px-2 py-2">기권·무효</th>
                                <th className="border border-slate-400 px-2 py-2">결과</th>
                                <th className="border border-slate-400 px-2 py-2">비고</th>
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
                                    <td className="border border-slate-400 px-2 py-2 font-bold">{result.result}</td>
                                    <td className="border border-slate-400 px-2 py-2 text-left text-xs leading-relaxed">{result.resultReason || '-'}</td>
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
                        <table className="mt-3 w-full border-collapse text-center text-sm">
                            <thead>
                                <tr className="bg-slate-100">
                                    <th className="border border-slate-400 px-2 py-2">후보자/선거</th>
                                    <th className="border border-slate-400 px-2 py-2">출석</th>
                                    <th className="border border-slate-400 px-2 py-2">득표/찬성</th>
                                    <th className="border border-slate-400 px-2 py-2">미선택/반대</th>
                                    <th className="border border-slate-400 px-2 py-2">무효·기권</th>
                                    <th className="border border-slate-400 px-2 py-2">결과</th>
                                    <th className="border border-slate-400 px-2 py-2">비고</th>
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
                                        <td className="border border-slate-400 px-2 py-2 font-bold">{result.result}</td>
                                        <td className="border border-slate-400 px-2 py-2 text-left text-xs leading-relaxed">{result.resultReason || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                )}

                <section className="mt-7">
                    <h2 className="border-b-2 border-slate-900 pb-2 text-base font-black">선거관리위원회 확인</h2>
                    <p className="mt-4 text-sm leading-7">
                        위 선거관리위원회는 본 총회의 참석 현황, 안건별 의결 결과 및 임원 선거 결과를 확인하였으며,
                        집계 과정이 공정하게 관리·운영되었고 위 기재된 집계 내용이 실제 투표 및 의결 결과와
                        다름이 없음을 확인합니다.
                    </p>
                    <div className="mt-4 text-sm text-slate-700">
                        집계 방식: {CONFIRMATION_SOURCE_LABELS[sourceType]} · 확정 시각: {confirmation?.confirmedAt ? new Date(confirmation.confirmedAt).toLocaleString('ko-KR') : '미확정'}
                    </div>
                    <div className="mt-8 text-center text-base font-bold">{formatKoreanDate(confirmation?.certificateDate || new Date())}</div>

                    <div className="no-print mt-5 grid gap-2">
                        {committeeMembers.map((member, index) => (
                            <div key={`${member.role}-${index}`} className="grid grid-cols-[160px_1fr] gap-2">
                                <input
                                    value={member.role}
                                    onChange={(event) => updateCommitteeMember(index, 'role', event.target.value)}
                                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                                />
                                <input
                                    value={member.name}
                                    onChange={(event) => updateCommitteeMember(index, 'name', event.target.value)}
                                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                                />
                            </div>
                        ))}
                    </div>

                    <table className="mt-5 w-full border-collapse text-center text-sm">
                        <thead>
                            <tr className="bg-slate-100">
                                <th className="border border-slate-400 px-2 py-2">직위</th>
                                <th className="border border-slate-400 px-2 py-2">성명</th>
                                <th className="border border-slate-400 px-2 py-2">서명</th>
                                <th className="border border-slate-400 px-2 py-2">날인</th>
                            </tr>
                        </thead>
                        <tbody>
                            {committeeMembers.map((member, index) => (
                                <tr key={`${member.role}-signature-${index}`}>
                                    <td className="border border-slate-400 px-2 py-4">{member.role || '-'}</td>
                                    <td className="border border-slate-400 px-2 py-4">{member.name || '-'}</td>
                                    <td className="border border-slate-400 px-2 py-4"></td>
                                    <td className="border border-slate-400 px-2 py-4">(인)</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="mt-8 text-center text-base font-bold">대방동 지역주택조합 선거관리위원회</div>
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
                    }
                    .no-print {
                        display: none !important;
                    }
                    @page {
                        size: A4;
                        margin: 14mm;
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
