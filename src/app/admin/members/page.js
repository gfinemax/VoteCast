'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Edit2, Plus, Save, UserPlus, Users, X } from 'lucide-react';
import { useStore } from '@/lib/store';
import DashboardLayout from '@/components/admin/DashboardLayout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import FullscreenToggle from '@/components/ui/FullscreenToggle';
import AuthStatus from '@/components/ui/AuthStatus';

const EMPTY_MEMBER_FORM = {
    unit: '',
    name: '',
    proxy: ''
};
const EMPTY_INACTIVE_MEMBER_IDS = [];

export default function AdminMembersPage() {
    const { state, actions } = useStore();
    const { members } = state;

    const [searchTerm, setSearchTerm] = useState('');
    const [newMember, setNewMember] = useState(EMPTY_MEMBER_FORM);
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState(EMPTY_MEMBER_FORM);
    const [pendingId, setPendingId] = useState(null);

    const inactiveMemberIds = useMemo(
        () => Array.isArray(state.voteData?.inactiveMemberIds) ? state.voteData.inactiveMemberIds : EMPTY_INACTIVE_MEMBER_IDS,
        [state.voteData?.inactiveMemberIds]
    );
    const inactiveMemberIdSet = useMemo(
        () => new Set(inactiveMemberIds),
        [inactiveMemberIds]
    );
    const activeMembers = useMemo(
        () => members.filter((member) => member.is_active !== false && !inactiveMemberIdSet.has(member.id)),
        [inactiveMemberIdSet, members]
    );
    const excludedCount = members.length - activeMembers.length;

    const filteredMembers = useMemo(() => {
        const keyword = searchTerm.trim();
        if (!keyword) return members;

        return members.filter((member) => {
            const target = [
                member.id,
                member.unit,
                member.name,
                member.proxy
            ]
                .map((value) => String(value || '').toLowerCase())
                .join(' ');

            return target.includes(keyword.toLowerCase());
        });
    }, [members, searchTerm]);

    const startEdit = (member) => {
        setEditingId(member.id);
        setEditForm({
            unit: member.unit || '',
            name: member.name || '',
            proxy: member.proxy || ''
        });
    };

    const resetEdit = () => {
        setEditingId(null);
        setEditForm(EMPTY_MEMBER_FORM);
    };

    const handleCreateMember = async () => {
        if (!newMember.unit.trim() || !newMember.name.trim()) {
            alert('동/호수와 성명은 필수입니다.');
            return;
        }

        setIsCreating(true);
        try {
            await actions.addMember(newMember);
            setNewMember(EMPTY_MEMBER_FORM);
        } catch (error) {
            console.error('Failed to add member:', error);
            alert(error.message || '조합원 추가에 실패했습니다.');
        } finally {
            setIsCreating(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!editingId) return;

        setPendingId(editingId);
        try {
            await actions.updateMember({
                id: editingId,
                ...editForm
            });
            resetEdit();
        } catch (error) {
            console.error('Failed to update member:', error);
            alert(error.message || '조합원 수정에 실패했습니다.');
        } finally {
            setPendingId(null);
        }
    };

    const handleToggleMemberActive = async (member) => {
        const isExcluded = inactiveMemberIdSet.has(member.id) || member.is_active === false;
        const message = isExcluded
            ? `"${member.unit} ${member.name}" 조합원을 명부에 다시 포함하시겠습니까?\n복원하면 전체 조합원 수에 즉시 반영됩니다.`
            : `"${member.unit} ${member.name}" 조합원을 명부에서 제외하시겠습니까?\n제외하면 전체 조합원 수 계산과 입구안내 목록에서 바로 빠집니다.`;

        if (!confirm(message)) {
            return;
        }

        setPendingId(member.id);
        try {
            await actions.setMemberActive(member.id, isExcluded);
            if (editingId === member.id) {
                resetEdit();
            }
        } catch (error) {
            console.error('Failed to update member visibility:', error);
            alert(error.message || '조합원 제외/복원에 실패했습니다.');
        } finally {
            setPendingId(null);
        }
    };

    const sidebarContent = (
        <div className="p-4 space-y-4">
            <Card className="p-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                        <Users size={20} />
                    </div>
                    <div>
                        <div className="text-sm font-bold text-slate-900">조합원 명부 관리</div>
                        <div className="text-xs text-slate-500">명단 수정 시 입구안내와 성원 계산에 바로 반영됩니다.</div>
                    </div>
                </div>
            </Card>

            <div className="space-y-2">
                <Link
                    href="/admin"
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                >
                    <ArrowLeft size={16} />
                    메인 제어로 돌아가기
                </Link>
            </div>

            <Card className="p-4 space-y-3">
                <div>
                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Roster Status</div>
                    <div className="mt-2 text-2xl font-black text-slate-900">{activeMembers.length}</div>
                    <div className="text-xs text-slate-500">현재 전체 조합원 수</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="text-[11px] font-semibold text-slate-500">검색 결과</div>
                    <div className="mt-1 text-lg font-bold text-slate-900">{filteredMembers.length}명</div>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3 text-xs leading-relaxed text-emerald-700">
                    현재 {excludedCount}명이 명부에서 제외되어 있으며, 제외된 조합원은 입구안내 목록과 전체 조합원 수 계산에서 빠집니다.
                </div>
            </Card>
        </div>
    );

    return (
        <DashboardLayout
            title="조합원 관리"
            subtitle="Member Roster Management"
            sidebarContent={sidebarContent}
            headerContent={
                <>
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                            <Users size={18} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">조합원 명부 편집</h2>
                            <p className="text-xs text-slate-500">추가, 수정, 제외/복원 결과가 모든 화면에 실시간 반영됩니다.</p>
                        </div>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                        <FullscreenToggle />
                        <AuthStatus />
                    </div>
                </>
            }
        >
            <div className="space-y-6">
                <Card className="p-5">
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="min-w-[120px] flex-1">
                            <label className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">동/호수</label>
                            <input
                                value={newMember.unit}
                                onChange={(e) => setNewMember((prev) => ({ ...prev, unit: e.target.value }))}
                                placeholder="예: 116"
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500"
                            />
                        </div>
                        <div className="min-w-[160px] flex-1">
                            <label className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">성명</label>
                            <input
                                value={newMember.name}
                                onChange={(e) => setNewMember((prev) => ({ ...prev, name: e.target.value }))}
                                placeholder="홍길동"
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500"
                            />
                        </div>
                        <div className="min-w-[160px] flex-1">
                            <label className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">대리인 기본명</label>
                            <input
                                value={newMember.proxy}
                                onChange={(e) => setNewMember((prev) => ({ ...prev, proxy: e.target.value }))}
                                placeholder="없으면 비워두기"
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500"
                            />
                        </div>
                        <Button
                            variant="primary"
                            className="h-[46px] min-w-[140px] bg-blue-600 hover:bg-blue-700"
                            onClick={handleCreateMember}
                            disabled={isCreating}
                        >
                            <UserPlus size={16} />
                            {isCreating ? '추가 중...' : '조합원 추가'}
                        </Button>
                    </div>
                </Card>

                <Card className="overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                        <div>
                            <div className="text-sm font-bold text-slate-900">조합원 명부</div>
                            <div className="text-xs text-slate-500">현재 총 {activeMembers.length}명이 전체 조합원 수로 계산됩니다.</div>
                        </div>
                        <input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="번호, 동/호수, 성명, 대리인 검색"
                            className="w-full max-w-xs rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500"
                        />
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                                <tr>
                                    <th className="px-5 py-3">ID</th>
                                    <th className="px-5 py-3">동/호수</th>
                                    <th className="px-5 py-3">성명</th>
                                    <th className="px-5 py-3">대리인 기본명</th>
                                    <th className="px-5 py-3 text-right">관리</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredMembers.map((member) => {
                                    const isEditing = editingId === member.id;
                                    const isPending = pendingId === member.id;
                                    const isExcluded = inactiveMemberIdSet.has(member.id) || member.is_active === false;

                                    return (
                                        <tr key={member.id} className={`border-t border-slate-100 ${isExcluded ? 'bg-amber-50/60' : ''}`}>
                                            <td className="px-5 py-3 font-mono text-slate-500">{member.id}</td>
                                            <td className="px-5 py-3">
                                                {isEditing ? (
                                                    <input
                                                        value={editForm.unit}
                                                        onChange={(e) => setEditForm((prev) => ({ ...prev, unit: e.target.value }))}
                                                        className="w-full min-w-[100px] rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                                                    />
                                                ) : (
                                                    <span className="font-semibold text-slate-700">{member.unit || '-'}</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3">
                                                {isEditing ? (
                                                    <input
                                                        value={editForm.name}
                                                        onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                                                        className="w-full min-w-[140px] rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                                                    />
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-slate-900">{member.name}</span>
                                                        {isExcluded && (
                                                            <span className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                                                                제외됨
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-5 py-3">
                                                {isEditing ? (
                                                    <input
                                                        value={editForm.proxy}
                                                        onChange={(e) => setEditForm((prev) => ({ ...prev, proxy: e.target.value }))}
                                                        className="w-full min-w-[160px] rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                                                    />
                                                ) : (
                                                    <span className="text-slate-600">{member.proxy || '-'}</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="flex items-center justify-end gap-2">
                                                    {isEditing ? (
                                                        <>
                                                            <Button
                                                                variant="primary"
                                                                className="h-9 px-3 text-xs bg-emerald-600 hover:bg-emerald-700"
                                                                onClick={handleSaveEdit}
                                                                disabled={isPending}
                                                            >
                                                                <Save size={14} />
                                                                저장
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                className="h-9 px-3 text-xs"
                                                                onClick={resetEdit}
                                                                disabled={isPending}
                                                            >
                                                                <X size={14} />
                                                                취소
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Button
                                                                variant="secondary"
                                                                className="h-9 px-3 text-xs"
                                                                onClick={() => startEdit(member)}
                                                            >
                                                                <Edit2 size={14} />
                                                                수정
                                                            </Button>
                                                            <Button
                                                                variant={isExcluded ? 'secondary' : 'danger'}
                                                                className="h-9 px-3 text-xs"
                                                                onClick={() => handleToggleMemberActive(member)}
                                                                disabled={isPending}
                                                            >
                                                                {isExcluded ? '복원' : '제외'}
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {filteredMembers.length === 0 && (
                        <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center text-slate-400">
                            <Plus size={22} />
                            <div className="text-sm font-medium">검색 결과가 없습니다.</div>
                        </div>
                    )}
                </Card>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-xs leading-relaxed text-slate-500">
                    조합원 명부를 추가하거나 제외/복원하면 입구안내요원 화면의 전체 조합원 수와 성원 계산 기준이 즉시 바뀝니다.
                    제외는 DB 레코드를 지우지 않고 운영 기준에서만 빼므로, 과거 출석 기록이 있는 조합원도 안전하게 인원 수에서 제외할 수 있습니다.
                </div>
            </div>
        </DashboardLayout>
    );
}
