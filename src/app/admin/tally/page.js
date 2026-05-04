'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
    Plus,
    Printer,
    RotateCcw,
    Save,
    Search,
    ShieldCheck,
    Table2,
    Ticket,
    Trash2,
    Users
} from 'lucide-react';
import DashboardLayout from '@/components/admin/DashboardLayout';
import AuthStatus from '@/components/ui/AuthStatus';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import FullscreenToggle from '@/components/ui/FullscreenToggle';
import { supabase } from '@/lib/supabase';
import { useStore, getInactiveMemberIds } from '@/lib/store';
import { normalizeAgendaType } from '@/lib/voteCalculations';
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
const SELECTED_TALLY_MEETING_KEY = 'votecast_tally_selected_meeting_id';
const ACTIVE_TALLY_TAB_KEY = 'votecast_tally_active_tab';
const TALLY_DRAFTS_KEY = 'votecast_tally_drafts';
const DEFAULT_COMMITTEE_MEMBERS = [
    { role: '선거관리위원장', name: '한재호' },
    { role: '선거관리위원', name: '전경분' },
    { role: '선거관리위원', name: '최인순' }
];

const normalizeCommitteeMembers = (members = []) => {
    const sourceMembers = Array.isArray(members) ? members : [];
    const memberCount = Math.max(DEFAULT_COMMITTEE_MEMBERS.length, sourceMembers.length);

    return Array.from({ length: memberCount }, (_, index) => {
        const defaultMember = DEFAULT_COMMITTEE_MEMBERS[index] || { role: '선거관리위원', name: '' };
        return {
            role: sourceMembers[index]?.role || defaultMember.role,
            name: sourceMembers[index]?.name ?? defaultMember.name
        };
    });
};
const TAB_ITEMS = [
    { id: 'summary', label: '집계 현황', icon: ClipboardCheck },
    { id: 'matrix', label: '조합원별 검산표', icon: Table2 },
    { id: 'manual', label: '수기 보정/확정', icon: PenLine },
    { id: 'certificate', label: '선관위 확인서', icon: FileText }
];

const getMeetingIdKey = (id) => (id == null ? '' : String(id));

const isSameMeetingId = (left, right) => (
    getMeetingIdKey(left) !== '' && getMeetingIdKey(left) === getMeetingIdKey(right)
);

const isValidTallyTab = (tabId) => TAB_ITEMS.some((tab) => tab.id === tabId);

const readTallyDrafts = () => {
    if (typeof window === 'undefined') return {};
    try {
        return JSON.parse(window.localStorage.getItem(TALLY_DRAFTS_KEY) || '{}');
    } catch (error) {
        console.error('Failed to read tally drafts:', error);
        return {};
    }
};

const readLocalStorageValue = (key) => {
    if (typeof window === 'undefined') return null;
    try {
        return window.localStorage.getItem(key);
    } catch (error) {
        console.error(`Failed to read localStorage key ${key}:`, error);
        return null;
    }
};

const writeLocalStorageValue = (key, value) => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(key, value);
    } catch (error) {
        console.error(`Failed to save localStorage key ${key}:`, error);
    }
};

const writeTallyDrafts = (drafts) => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(TALLY_DRAFTS_KEY, JSON.stringify(drafts));
    } catch (error) {
        console.error('Failed to save tally drafts:', error);
    }
};

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

function SidebarContent({ groups, selectedMeetingId, setSelectedMeetingId, audit, confirmation, isMounted }) {
    const meetingGroups = groups.filter((group) => group.folder);

    return (
        <div className="space-y-3 p-4">
            <Card className="space-y-3 p-4">
                <div>
                    <div className="text-sm font-bold text-slate-900">총회 선택</div>
                    <div className="text-xs text-slate-500">검산할 총회와 안건 구성을 확인합니다.</div>
                </div>
                <div className="space-y-1.5">
                    {meetingGroups.map((group) => {
                        const standardCount = group.items.filter((item) => normalizeAgendaType(item?.type) !== 'election').length;
                        const electionCount = group.items.filter((item) => normalizeAgendaType(item?.type) === 'election').length;
                        const isSelected = isSameMeetingId(selectedMeetingId, group.folder.id);

                        return (
                            <button
                                key={group.folder.id}
                                type="button"
                                onClick={() => setSelectedMeetingId(group.folder.id)}
                                className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                                    isSelected
                                        ? 'border-blue-200 bg-blue-50 text-blue-800'
                                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="truncate text-sm font-bold">{group.folder.title}</div>
                                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                        isSelected ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        총 {group.items.length}건
                                    </span>
                                </div>
                                <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                                    <span className={`rounded-full px-2 py-0.5 ${isSelected ? 'bg-white/70 text-blue-700' : 'bg-slate-50 text-slate-500'}`}>
                                        일반 안건 {standardCount}
                                    </span>
                                    <span className={`rounded-full px-2 py-0.5 ${isSelected ? 'bg-indigo-100 text-indigo-700' : 'bg-indigo-50 text-indigo-600'}`}>
                                        선거 {electionCount}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                    {meetingGroups.length === 0 && (
                        <div className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-400">
                            등록된 총회 폴더가 없습니다.
                        </div>
                    )}
                </div>
            </Card>

            <Card className="space-y-3 p-4">
                <div>
                    <div className="text-sm font-bold text-slate-900">검산 상태</div>
                    <div className="mt-2 text-2xl font-black text-slate-900">{isMounted ? formatNumber(audit.activeMembers.length) : '-'}</div>
                    <div className="text-xs text-slate-500">검산 대상 조합원</div>
                </div>
                <div className={`rounded-xl border px-3 py-2.5 text-xs font-bold ${isMounted ? getStatusClass(audit.hasIssues) : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                    {isMounted
                        ? (audit.hasIssues ? `확인 필요 ${audit.issueList.length}건` : '현재 감지된 문제 없음')
                        : '검산 상태 확인 중'}
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-500">
                    최종 확정: {isMounted && confirmation?.confirmedAt ? formatKoreanDate(confirmation.confirmedAt) : '아직 없음'}
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

function MatrixTab({ audit, finalResults = audit.agendaResults }) {
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
    const visibleIssueCount = useMemo(() => rows.reduce((total, row) => total + row.issues.length, 0), [rows]);
    const resultByAgendaId = useMemo(() => {
        const resultMap = new Map();
        finalResults.forEach((result) => resultMap.set(result.id, result));
        return resultMap;
    }, [finalResults]);
    const renderVoteSourceRow = (label, counts = {}, className = 'text-slate-600') => (
        <div className={`flex items-center justify-between gap-1 ${className}`}>
            <span className="shrink-0 font-black">{label}</span>
            <span className="font-mono font-black tracking-tight">
                {formatNumber(counts.yes || 0)}/{formatNumber(counts.no || 0)}/{formatNumber(counts.abstain || 0)}
            </span>
        </div>
    );

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
                                <th key={agenda.id} className="w-[72px] px-0.5 py-1 text-center text-[11px] font-black border-r border-slate-100 leading-tight">{agendaShortLabelById.get(agenda.id)}</th>
                            ))}
                            {audit.electionAgendas.map((agenda) => {
                                const fullLabel = agenda.title || getElectionRule(agenda, audit.electionAgendas).label;
                                const shortLabel = fullLabel.replace(/^(조합장후보|이사후보\d+)\s+.*\s+찬반투표$/, '$1');
                                
                                return (
                                    <th key={agenda.id} className="w-[72px] bg-slate-100 px-0.5 py-1 text-center text-[11px] font-black text-indigo-700 border-r border-slate-200 leading-tight">
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
                                        <td key={`${row.member.id}-${vote.agendaId}`} className="w-[72px] px-0.5 py-1.5 text-center bg-lime-50/20 group-hover:bg-lime-200/40 border-r border-lime-100/20 transition-colors">
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
                                        <td key={`${row.member.id}-${vote.agendaId}`} className="w-[72px] px-0.5 py-1.5 text-center bg-sky-50/30 group-hover:bg-sky-200/50 border-r border-sky-100/20 transition-colors">
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
                    <tfoot className="sticky bottom-0 z-30 bg-slate-50 font-bold text-slate-700 shadow-[0_-10px_18px_-10px_rgba(15,23,42,0.35)]">
                        <tr className="border-t-[3px] border-slate-300">
                            <td className="sticky left-0 z-40 bg-slate-50 px-0.5 py-2.5 align-top">
                                <div className="mx-auto h-full min-h-[78px] w-1 rounded-full bg-slate-300" />
                            </td>
                            <td colSpan={2} className="sticky left-10 z-40 bg-slate-50 px-2 py-2.5 text-left border-r border-slate-200 align-top">
                                <div className="space-y-1.5 leading-tight">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-[12px] font-black text-slate-950">검산 합계</span>
                                        <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-black ${visibleIssueCount > 0 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                                            {visibleIssueCount > 0 ? `확인 ${visibleIssueCount}` : '정상'}
                                        </span>
                                    </div>
                                    <div className="text-[10px] font-semibold text-slate-500">
                                        표시 {formatNumber(rows.length)}명
                                        {rows.length !== audit.memberRows.length && (
                                            <span className="text-slate-400"> / 전체 {formatNumber(audit.memberRows.length)}명</span>
                                        )}
                                    </div>
                                    <div className="text-[9px] font-bold text-slate-400">
                                        숫자 순서: 찬성/반대/기권
                                    </div>
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
                                        <td className="sticky left-[196px] z-40 bg-slate-50 px-1 py-2.5 text-center border-x border-slate-200 align-top">
                                            <div className="rounded-md border border-slate-200 bg-white px-1.5 py-1.5 text-[10px] leading-tight shadow-sm">
                                                <div className="mb-1 text-[9px] font-black text-slate-400">안건의결</div>
                                                <div className="mb-1 rounded border border-slate-200 bg-slate-100 px-1 py-0.5 text-[11px] font-black text-slate-800">
                                                    총 {formatNumber((stats.agenda.written || 0) + (stats.agenda.direct || 0) + (stats.agenda.proxy || 0))}
                                                </div>
                                                <div className="grid grid-cols-1 gap-0.5">
                                                    <span className="font-bold text-indigo-600">서면 {formatNumber(stats.agenda.written || 0)}</span>
                                                    <span className="font-bold text-cyan-600">직접 {formatNumber(stats.agenda.direct || 0)}</span>
                                                    <span className="font-bold text-blue-600">대리 {formatNumber(stats.agenda.proxy || 0)}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="sticky left-[268px] z-40 bg-slate-50 px-1 py-2.5 text-center align-top">
                                            <div className="rounded-md border border-indigo-100 bg-white px-1.5 py-1.5 text-[10px] leading-tight shadow-sm">
                                                <div className="mb-1 text-[9px] font-black text-indigo-400">선거투표</div>
                                                <div className="mb-1 rounded border border-indigo-200 bg-indigo-50 px-1 py-0.5 text-[11px] font-black text-indigo-700">
                                                    총 {formatNumber(stats.election.mail + stats.election.onsite)}
                                                </div>
                                                <div className="grid grid-cols-1 gap-0.5 font-bold text-indigo-700">
                                                    <span>우편 {formatNumber(stats.election.mail)}</span>
                                                    <span>현장 {formatNumber(stats.election.onsite)}</span>
                                                </div>
                                            </div>
                                        </td>
                                        {audit.standardAgendas.map((agenda) => {
                                            const result = resultByAgendaId.get(agenda.id) || audit.agendaResults.find((r) => r.id === agenda.id);
                                            const totalVoted = (result?.final.yes || 0) + (result?.final.no || 0) + (result?.final.abstain || 0);
                                            const auditGap = Math.max(0, (result?.attendanceCount || 0) - totalVoted);
                                            const fixedLabel = result?.fixedLabel || '서면';
                                            
                                            return (
                                                <td key={agenda.id} className="w-[72px] border-r border-slate-200 bg-slate-50 px-0.5 py-2.5 text-center align-top">
                                                    <div className={`mx-auto rounded-md border bg-white px-1 py-1 text-[9px] leading-tight shadow-sm ${auditGap > 0 ? 'border-amber-200' : 'border-slate-200'}`}>
                                                        <div className="mb-1 rounded border border-slate-200 bg-slate-100 px-0.5 py-0.5 text-[10px] font-black text-slate-800">
                                                            총 {formatNumber(result?.attendanceCount || 0)}
                                                        </div>
                                                        <div className="mb-0.5 grid grid-cols-4 border-b border-slate-100 pb-0.5 text-[8px] font-black text-slate-400">
                                                            <span></span>
                                                            <span>찬</span>
                                                            <span>반</span>
                                                            <span>기</span>
                                                        </div>
                                                        <div className="space-y-0.5 text-left">
                                                            {renderVoteSourceRow('최종', result?.final, 'text-slate-900')}
                                                            {renderVoteSourceRow(fixedLabel, result?.fixed, 'text-indigo-600')}
                                                            {renderVoteSourceRow('현장', result?.onsite, 'text-cyan-700')}
                                                            <div className={`mt-0.5 flex items-center justify-between gap-1 rounded px-0.5 ${auditGap > 0 ? 'bg-amber-50 font-black text-amber-700' : 'font-semibold text-slate-400'}`}>
                                                                <span>차이</span>
                                                                <span>{formatNumber(auditGap)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            );
                                        })}
                                        {audit.electionAgendas.map((agenda) => {
                                            const result = resultByAgendaId.get(agenda.id) || audit.agendaResults.find((r) => r.id === agenda.id);
                                            const totalVoted = (result?.final.yes || 0) + (result?.final.no || 0) + (result?.final.abstain || 0);
                                            const auditGap = Math.max(0, (result?.attendanceCount || 0) - totalVoted);
                                            const fixedLabel = result?.fixedLabel || '우편';
                                            
                                            return (
                                                <td key={agenda.id} className="w-[72px] border-r border-slate-200 bg-indigo-50/50 px-0.5 py-2.5 text-center align-top">
                                                    <div className={`mx-auto rounded-md border bg-white px-1 py-1 text-[9px] leading-tight shadow-sm ${auditGap > 0 ? 'border-amber-200' : 'border-indigo-100'}`}>
                                                        <div className="mb-1 rounded border border-indigo-200 bg-indigo-50 px-0.5 py-0.5 text-[10px] font-black text-indigo-700">
                                                            총 {formatNumber(result?.attendanceCount || 0)}
                                                        </div>
                                                        <div className="mb-0.5 grid grid-cols-4 border-b border-indigo-100 pb-0.5 text-[8px] font-black text-indigo-300">
                                                            <span></span>
                                                            <span>찬</span>
                                                            <span>반</span>
                                                            <span>기</span>
                                                        </div>
                                                        <div className="space-y-0.5 text-left">
                                                            {renderVoteSourceRow('최종', result?.final, 'text-indigo-800')}
                                                            {renderVoteSourceRow(fixedLabel, result?.fixed, 'text-indigo-600')}
                                                            {renderVoteSourceRow('현장', result?.onsite, 'text-cyan-700')}
                                                            <div className={`mt-0.5 flex items-center justify-between gap-1 rounded px-0.5 ${auditGap > 0 ? 'bg-amber-50 font-black text-amber-700' : 'font-semibold text-slate-400'}`}>
                                                                <span>차이</span>
                                                                <span>{formatNumber(auditGap)}</span>
                                                            </div>
                                                        </div>
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
    const handleRestoreAutoValues = () => {
        setManualResults(buildManualResultsFromAgendaResults(finalResults));
    };

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
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="text-sm font-bold text-slate-900">집계 방식 선택</div>
                        <div className="mt-1 text-xs text-slate-500">수기 입력값은 이 탭의 최종 확정표에만 적용됩니다.</div>
                    </div>
                    <Button
                        variant="secondary"
                        className="h-8 px-3 text-xs"
                        onClick={handleRestoreAutoValues}
                        disabled={sourceType !== 'manual'}
                        title={sourceType !== 'manual' ? '수기 확정 모드에서 사용할 수 있습니다.' : '현재 자동 집계값으로 수기 입력값을 복원합니다.'}
                    >
                        <RotateCcw size={14} />
                        자동 집계로 복원
                    </Button>
                </div>
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
    sealImage,
    setSealImage,
    confirmation,
    onPrint,
    onSave,
    isSaving
}) {
    const updateCommitteeMember = (index, field, value) => {
        setCommitteeMembers((prev) => prev.map((member, currentIndex) => (
            currentIndex === index ? { ...member, [field]: value } : member
        )));
    };

    const addCommitteeMember = () => {
        setCommitteeMembers((prev) => [
            ...prev,
            { role: '선거관리위원', name: '' }
        ]);
    };

    const removeCommitteeMember = (index) => {
        if (index === 0) return;
        setCommitteeMembers((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
    };

    const standardResults = finalResults.filter((r) => !r.isElection);
    const electionResults = finalResults.filter((r) => r.isElection);
    const hasElection = electionResults.length > 0;
    const electionMailMemberIds = new Set();
    audit.memberRows?.forEach((row) => {
        if (row.electionVotes?.some((vote) => !!vote.choice)) {
            electionMailMemberIds.add(row.member.id);
        }
    });
    const electionMailCount = electionMailMemberIds.size;
    const electionOnsiteCount = Math.max((audit.meetingStats.election || 0) - electionMailCount, 0);

    return (
        <div className="space-y-4">
            <Card className="no-print overflow-hidden border-none shadow-xl ring-1 ring-slate-200/60 bg-white">
                <div className="grid lg:grid-cols-[1fr_300px]">
                    <div className="space-y-4 bg-slate-50/30 p-4">
                        <section>
                            <div className="mb-3 flex items-center gap-2">
                                <div className="h-3.5 w-1.5 rounded-full bg-blue-600"></div>
                                <h3 className="text-sm font-black text-slate-800">확인서 정보</h3>
                            </div>

                            <div className="grid gap-x-4 gap-y-2.5 md:grid-cols-2">
                                {[
                                    { label: '총회 명칭', key: 'title', placeholder: '총회 이름을 입력하세요' },
                                    { label: '개최 일시', key: 'heldAt', placeholder: '202X년 X월 X일' },
                                    { label: '개최 장소', key: 'location', placeholder: '장소를 입력하세요' },
                                    { label: '작성 일자', key: 'certificateDate', placeholder: '문서 작성일을 입력하세요' }
                                ].map((field) => (
                                    <div key={field.key} className="space-y-1">
                                        <label className="ml-1 text-[11px] font-bold text-slate-400">{field.label}</label>
                                        <input
                                            value={meetingDetails[field.key]}
                                            onChange={(event) => setMeetingDetails((prev) => ({ ...prev, [field.key]: event.target.value }))}
                                            className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none transition-all placeholder:text-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5"
                                            placeholder={field.placeholder}
                                        />
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="border-t border-slate-200 pt-3">
                            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-1.5 rounded-full bg-slate-400"></div>
                                    <h4 className="text-sm font-black text-slate-800">선거관리위원</h4>
                                </div>
                                <Button
                                    variant="secondary"
                                    className="h-7 rounded-md px-2.5 text-xs"
                                    onClick={addCommitteeMember}
                                >
                                    <Plus size={14} />
                                    선관위원 추가
                                </Button>
                            </div>

                            <div className="grid gap-x-3 gap-y-2.5 md:grid-cols-3">
                                {committeeMembers.map((member, index) => (
                                    <div key={`${member.role}-input-${index}`} className="space-y-1">
                                        <label className="ml-1 text-[11px] font-bold text-slate-400">
                                            {index === 0 ? '위원장' : `위원 ${index}`}
                                        </label>
                                        <div className="flex gap-1.5">
                                            <input
                                                value={member.name}
                                                onChange={(event) => updateCommitteeMember(index, 'name', event.target.value)}
                                                className="h-9 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none transition-all placeholder:text-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5"
                                                placeholder={index === 0 ? '위원장 성명' : '위원 성명'}
                                            />
                                            {index > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeCommitteeMember(index)}
                                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                                                    title="선관위원 삭제"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>

                    <aside className="flex flex-col justify-between border-l border-slate-100 bg-white p-4">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="h-3.5 w-1.5 rounded-full bg-indigo-600"></div>
                                <h3 className="text-sm font-black text-slate-800">작업</h3>
                            </div>

                            <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                                <div className="mb-2 text-[12px] font-black text-slate-800">직인 미리보기</div>
                                <div className="flex items-center gap-2.5">
                                    <div className="relative shrink-0">
                                        {sealImage ? (
                                            <div className="group relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white p-1 shadow-sm">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={sealImage} alt="직인" className="max-h-full max-w-full object-contain" />
                                                <button
                                                    onClick={() => setSealImage(null)}
                                                    className="absolute inset-0 flex items-center justify-center bg-slate-900/80 text-[10px] font-bold text-white opacity-0 backdrop-blur-[2px] transition-all group-hover:opacity-100"
                                                >
                                                    삭제
                                                </button>
                                            </div>
                                        ) : (
                                            <label className="group flex h-16 w-16 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-slate-300 bg-white transition-all hover:border-blue-400 hover:bg-slate-50">
                                                <RotateCcw size={17} className="text-slate-400 transition-colors group-hover:text-blue-500" />
                                                <span className="mt-1 text-[10px] font-black leading-tight text-slate-500">업로드</span>
                                                <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                                                    const file = e.target.files[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onloadend = () => setSealImage(reader.result);
                                                        reader.readAsDataURL(file);
                                                    }
                                                }} />
                                            </label>
                                        )}
                                    </div>
                                    <div className="text-[11px] leading-relaxed text-slate-500">
                                        확인서 하단 위원회명 옆에 표시
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 space-y-2">
                            <Button 
                                variant="primary" 
                                className="h-9 w-full rounded-md !bg-blue-600 text-xs font-black !text-white shadow-md shadow-blue-200 transition-all active:scale-[0.98] hover:!bg-blue-700"
                                onClick={onSave}
                                disabled={isSaving}
                            >
                                <Save size={16} className="mr-2" />
                                {isSaving ? '저장 중...' : '확인서 정보 저장'}
                            </Button>

                            <Button 
                                variant="secondary"
                                className="h-9 w-full rounded-md border-slate-200 text-xs font-black transition-all active:scale-[0.98] hover:bg-slate-50"
                                onClick={onPrint}
                            >
                                <Printer size={16} className="mr-2" />
                                확인서 PDF 저장 / 인쇄
                            </Button>
                        </div>
                    </aside>
                </div>
            </Card>

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
                    <h2 className="border-b-2 border-slate-900 pb-2 text-base font-black">참석 및 투표 현황</h2>
                    <table className="mt-3 w-full border-collapse text-sm">
                        <thead>
                            <tr className="bg-slate-50 text-center">
                                <th className="w-32 border border-slate-400 px-2 py-1.5">구분</th>
                                <th className="border border-slate-400 px-2 py-1.5">항목</th>
                                <th className="w-32 border border-slate-400 px-2 py-1.5">수량</th>
                                <th className="w-32 border border-slate-400 px-2 py-1.5">인정 합계</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                { category: '공통', label: '전체 조합원 수', value: `${formatNumber(audit.activeMembers.length)}명`, total: '-' },
                                { category: '일반 의결', label: '직접 출석', value: `${formatNumber(audit.meetingStats.direct)}명`, total: `${formatNumber(audit.meetingStats.total)}명`, totalRowSpan: 3 },
                                { category: '일반 의결', label: '대리 참석', value: `${formatNumber(audit.meetingStats.proxy)}명` },
                                { category: '일반 의결', label: '서면결의서 제출', value: `${formatNumber(audit.meetingStats.written)}명` },
                                ...(hasElection ? [
                                    { category: '선거', label: '선거 안건 수', value: `${formatNumber(electionResults.length)}건`, total: '-' },
                                    { category: '선거', label: '우편투표', value: `${formatNumber(electionMailCount)}명`, total: `${formatNumber(audit.meetingStats.election)}명`, totalRowSpan: 2 },
                                    { category: '선거', label: '현장 투표', value: `${formatNumber(electionOnsiteCount)}명` }
                                ] : [])
                            ].map((row, index, rows) => {
                                const { category, label, value, total, totalRowSpan } = row;
                                const isFirstInCategory = index === 0 || rows[index - 1].category !== category;
                                const rowSpan = rows.filter((item) => item.category === category).length;

                                return (
                                    <tr key={`${category}-${label}`}>
                                        {isFirstInCategory && (
                                            <th
                                                rowSpan={rowSpan}
                                                className="border border-slate-400 bg-slate-100 px-2 py-1.5 text-center font-bold"
                                            >
                                                {category}
                                            </th>
                                        )}
                                        <td className="border border-slate-400 px-3 py-1.5">{label}</td>
                                        <td className="border border-slate-400 px-3 py-1.5 text-center">{value}</td>
                                        {totalRowSpan ? (
                                            <td rowSpan={totalRowSpan} className="border border-slate-400 px-3 py-1.5 text-center font-bold">{total}</td>
                                        ) : total !== undefined ? (
                                            <td className="border border-slate-400 px-3 py-1.5 text-center text-slate-500">{total}</td>
                                        ) : null}
                                    </tr>
                                );
                            })}
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
                    <div className="mt-[8cm] text-center text-base font-bold">{meetingDetails.certificateDate || formatKoreanDate(new Date())}</div>


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

                    <div className="mt-28 text-center">
                        <div className="inline-block relative">
                            <span className="text-[30px] font-black leading-tight">
                                대방동 지역주택조합 선거관리위원회
                            </span>
                            {sealImage && (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img 
                                    src={sealImage} 
                                    alt="직인" 
                                    className="absolute left-[calc(100%-45px)] top-1/2 -translate-y-[75%] w-24 h-24 object-contain z-20 pointer-events-none opacity-90"
                                    style={{ mixBlendMode: 'multiply' }}
                                />
                            )}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}

export default function AdminTallyPage() {
    const { state, actions } = useStore();
    const { agendas, members, attendance, mailElectionVotes, activeMeetingId, currentMeetingId, currentAgendaId, voteData } = state;
    const groups = useMemo(() => buildAgendaGroups(agendas), [agendas]);
    const meetingGroups = useMemo(() => groups.filter((group) => group.folder), [groups]);
    const initialMeetingId = useMemo(() => getDefaultMeetingId({
        agendas,
        activeMeetingId,
        currentMeetingId,
        currentAgendaId
    }), [activeMeetingId, agendas, currentAgendaId, currentMeetingId]);

    const [selectedMeetingId, setSelectedMeetingId] = useState(null);
    const [activeTab, setActiveTab] = useState('summary');
    const [hasMounted, setHasMounted] = useState(false);
    const [writtenVotes, setWrittenVotes] = useState([]);
    const [writtenVoteError, setWrittenVoteError] = useState('');
    const hydratedDraftMeetingRef = useRef(null);
    const suppressNextDraftSaveRef = useRef(false);
    const activeTabReadyToSaveRef = useRef(false);
    const selectedMeeting = useMemo(
        () => meetingGroups.find((group) => isSameMeetingId(group.folder?.id, selectedMeetingId))?.folder || null,
        [meetingGroups, selectedMeetingId]
    );
    const inactiveMemberIds = useMemo(
        () => getInactiveMemberIds(voteData, selectedMeetingId),
        [voteData, selectedMeetingId]
    );

    const [sourceType, setSourceType] = useState('auto');
    const [manualResults, setManualResults] = useState({});
    const [overrideReason, setOverrideReason] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [meetingDetails, setMeetingDetails] = useState({
        title: '',
        heldAt: formatKoreanDate(new Date()),
        location: '',
        certificateDate: formatKoreanDate(new Date())
    });
    const [committeeMembers, setCommitteeMembers] = useState(normalizeCommitteeMembers());
    const [sealImage, setSealImage] = useState(null);

    useEffect(() => {
        setHasMounted(true);
    }, []);

    useEffect(() => {
        const savedTab = readLocalStorageValue(ACTIVE_TALLY_TAB_KEY);
        if (isValidTallyTab(savedTab)) {
            setActiveTab(savedTab);
        }
    }, []);

    useEffect(() => {
        if (meetingGroups.length === 0) {
            return;
        }

        const selectedMeetingGroup = selectedMeetingId != null
            ? meetingGroups.find((group) => isSameMeetingId(group.folder?.id, selectedMeetingId))
            : null;
        if (selectedMeetingGroup) {
            if (!Object.is(selectedMeetingId, selectedMeetingGroup.folder.id)) {
                setSelectedMeetingId(selectedMeetingGroup.folder.id);
            }
            return;
        }

        const savedMeetingId = readLocalStorageValue(SELECTED_TALLY_MEETING_KEY);
        const savedMeetingGroup = savedMeetingId
            ? meetingGroups.find((group) => isSameMeetingId(group.folder?.id, savedMeetingId))
            : null;
        const initialMeetingGroup = initialMeetingId
            ? meetingGroups.find((group) => isSameMeetingId(group.folder?.id, initialMeetingId))
            : null;
        const nextMeetingId = savedMeetingGroup?.folder?.id ?? initialMeetingGroup?.folder?.id ?? meetingGroups[0].folder.id;

        setSelectedMeetingId(nextMeetingId);
    }, [initialMeetingId, meetingGroups, selectedMeetingId]);

    useEffect(() => {
        const selectedMeetingGroup = meetingGroups.find((group) => isSameMeetingId(group.folder?.id, selectedMeetingId));
        if (!selectedMeetingGroup) return;

        writeLocalStorageValue(SELECTED_TALLY_MEETING_KEY, getMeetingIdKey(selectedMeetingGroup.folder.id));
    }, [meetingGroups, selectedMeetingId]);

    useEffect(() => {
        if (!isValidTallyTab(activeTab)) return;
        if (!activeTabReadyToSaveRef.current) {
            activeTabReadyToSaveRef.current = true;
            return;
        }

        writeLocalStorageValue(ACTIVE_TALLY_TAB_KEY, activeTab);
    }, [activeTab]);

    useEffect(() => {
        if (!selectedMeetingId) return;

        const meetingKey = getMeetingIdKey(selectedMeetingId);
        const draft = readTallyDrafts()[meetingKey];
        const conf = voteData?.tallyConfirmations?.[selectedMeetingId] || voteData?.tallyConfirmations?.[meetingKey] || voteData?.tallyConfirmation;
        const source = draft || conf;

        suppressNextDraftSaveRef.current = true;

        if (source) {
            setMeetingDetails({
                title: source.meetingDetails?.title || selectedMeeting?.title || '',
                heldAt: source.meetingDetails?.heldAt || formatKoreanDate(new Date()),
                location: source.meetingDetails?.location || '',
                certificateDate: source.meetingDetails?.certificateDate || formatKoreanDate(new Date())
            });
            setCommitteeMembers(normalizeCommitteeMembers(source.committeeMembers));
            setSealImage(source.sealImage || null);
            setSourceType(source.sourceType || 'auto');
            setManualResults(source.manualResults || {});
            setOverrideReason(source.overrideReason || '');
        } else {
            setMeetingDetails({
                title: selectedMeeting?.title || '',
                heldAt: formatKoreanDate(new Date()),
                location: '',
                certificateDate: formatKoreanDate(new Date())
            });
            setCommitteeMembers(normalizeCommitteeMembers());
            setSealImage(null);
            setSourceType('auto');
            setManualResults({});
            setOverrideReason('');
        }

        hydratedDraftMeetingRef.current = meetingKey;
    }, [selectedMeetingId, voteData?.tallyConfirmations, voteData?.tallyConfirmation, selectedMeeting?.title]);

    useEffect(() => {
        if (!selectedMeetingId) return;

        const meetingKey = getMeetingIdKey(selectedMeetingId);
        if (hydratedDraftMeetingRef.current !== meetingKey) return;
        if (suppressNextDraftSaveRef.current) {
            suppressNextDraftSaveRef.current = false;
            return;
        }

        const drafts = readTallyDrafts();
        writeTallyDrafts({
            ...drafts,
            [meetingKey]: {
                sourceType,
                manualResults,
                overrideReason,
                meetingDetails,
                committeeMembers,
                sealImage
            }
        });
    }, [committeeMembers, manualResults, meetingDetails, overrideReason, sealImage, selectedMeetingId, sourceType]);

    useEffect(() => {
        if (!meetingDetails.title && selectedMeeting?.title) {
            setMeetingDetails((prev) => ({ ...prev, title: selectedMeeting.title }));
        }
    }, [meetingDetails.title, selectedMeeting]);

    const meetingAgendaIds = useMemo(() => {
        const group = groups.find((item) => isSameMeetingId(item.folder?.id, selectedMeetingId));
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

    const confirmation = voteData?.tallyConfirmations?.[selectedMeetingId] || voteData?.tallyConfirmation || null;

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
                sealImage,
                certificateDate: new Date().toISOString(),
                confirmedAt: new Date().toISOString()
            };

            const updatedConfirmations = {
                ...(voteData.tallyConfirmations || {}),
                [selectedMeetingId]: payload
            };
            await actions.updateVoteData('tallyConfirmations', updatedConfirmations);
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
                    isMounted={hasMounted}
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
                    <MatrixTab audit={audit} finalResults={finalResults} />
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
                        sealImage={sealImage}
                        setSealImage={setSealImage}
                        confirmation={confirmation}
                        onPrint={handlePrint}
                        onSave={handleConfirm}
                        isSaving={isSaving}
                    />
                )}
            </div>
        </DashboardLayout>
    );
}
