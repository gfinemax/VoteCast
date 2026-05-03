'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Edit2, FolderOpen, Plus, Save, UserPlus, Users, X, Lock } from 'lucide-react';
import { useStore, getInactiveMemberIds } from '@/lib/store';
import { getMemberJoinedMeetingId } from '@/lib/storeHelpers';
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

export default function AdminMembersPage() {
    const { state, actions } = useStore();
    const { members, agendas, voteData } = state;

    const [searchTerm, setSearchTerm] = useState('');
    const [newMember, setNewMember] = useState(EMPTY_MEMBER_FORM);
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState(EMPTY_MEMBER_FORM);
    const [pendingId, setPendingId] = useState(null);

    // Meeting (folder) selection for per-meeting member management
    const meetingFolders = useMemo(
        () => agendas.filter((agenda) => agenda.type === 'folder'),
        [agendas]
    );
    const [selectedMeetingId, setSelectedMeetingId] = useState(
        () => meetingFolders[0]?.id || null
    );

    // Build ordered list of meeting IDs for determining "added after this meeting"
    const meetingIdOrder = useMemo(() => {
        return meetingFolders.map((folder) => folder.id);
    }, [meetingFolders]);

    const selectedMeetingIndex = useMemo(
        () => meetingIdOrder.indexOf(selectedMeetingId),
        [meetingIdOrder, selectedMeetingId]
    );

    // Get inactive member IDs for the selected meeting
    const inactiveMemberIds = useMemo(
        () => selectedMeetingId
            ? getInactiveMemberIds(voteData, selectedMeetingId)
            : (Array.isArray(voteData?.inactiveMemberIds) ? voteData.inactiveMemberIds : []),
        [voteData, selectedMeetingId]
    );
    const inactiveMemberIdSet = useMemo(
        () => new Set(inactiveMemberIds),
        [inactiveMemberIds]
    );

    // Determine which members were added AFTER the selected meeting
    const memberJoinedAfterSet = useMemo(() => {
        if (!selectedMeetingId || selectedMeetingIndex === -1) return new Set();

        const afterSet = new Set();
        members.forEach((member) => {
            const joinedMeetingId = getMemberJoinedMeetingId(voteData, member.id);
            if (!joinedMeetingId) return; // Original member — existed before tracking

            const joinedIndex = meetingIdOrder.indexOf(joinedMeetingId);
            if (joinedIndex === -1) return;
            if (joinedIndex > selectedMeetingIndex) {
                afterSet.add(member.id);
            }
        });
        return afterSet;
    }, [members, voteData, selectedMeetingId, selectedMeetingIndex, meetingIdOrder]);

    const activeMembers = useMemo(
        () => members.filter((member) =>
            member.is_active !== false
            && !inactiveMemberIdSet.has(member.id)
            && !memberJoinedAfterSet.has(member.id)
        ),
        [inactiveMemberIdSet, memberJoinedAfterSet, members]
    );
    const excludedCount = useMemo(
        () => members.filter((member) =>
            member.is_active !== false
            && !memberJoinedAfterSet.has(member.id)
            && inactiveMemberIdSet.has(member.id)
        ).length,
        [inactiveMemberIdSet, memberJoinedAfterSet, members]
    );
    const addedAfterCount = memberJoinedAfterSet.size;

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
            await actions.addMember({
                ...newMember,
                contextMeetingId: selectedMeetingId || null
            });
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
        const selectedMeetingName = meetingFolders.find((f) => f.id === selectedMeetingId)?.title || '현재 총회';
        const message = isExcluded
            ? `"${member.unit} ${member.name}" 조합원을 [${selectedMeetingName}] 명부에 다시 포함하시겠습니까?\n복원하면 해당 총회의 전체 조합원 수에 즉시 반영됩니다.`
            : `"${member.unit} ${member.name}" 조합원을 [${selectedMeetingName}] 명부에서 제외하시겠습니까?\n제외하면 해당 총회의 전체 조합원 수 계산과 입구안내 목록에서 바로 빠집니다.\n다른 총회의 명부에는 영향을 주지 않습니다.`;

        if (!confirm(message)) {
            return;
        }

        setPendingId(member.id);
        try {
            await actions.setMemberActive(member.id, isExcluded, selectedMeetingId || null);
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

    const selectedMeetingFolder = useMemo(() => meetingFolders.find((f) => f.id === selectedMeetingId), [meetingFolders, selectedMeetingId]);
    const selectedMeetingName = selectedMeetingFolder?.title || '-';

    // Roster lock logic
    const admissionStatus = voteData?.meetingAdmissionStatus?.[selectedMeetingId] || 'idle';
    const isHardLocked = admissionStatus === 'closed';
    const isRosterConfirmed = voteData?.rosterConfirmedStatus?.[selectedMeetingId] || false;
    const isLocked = isHardLocked || isRosterConfirmed;

    const handleToggleRosterLock = async () => {
        if (isHardLocked) {
            alert('입장이 마감된 총회는 명부를 수정할 수 없습니다. 대시보드에서 입장 마감을 해제해야 합니다.');
            return;
        }
        try {
            await actions.setRosterConfirmedStatus(selectedMeetingId, !isRosterConfirmed);
        } catch (error) {
            console.error('Failed to update roster lock status:', error);
            alert('명부 확정 상태 업데이트에 실패했습니다.');
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
                        <div className="text-xs text-slate-500">총회별로 명단을 분리 관리할 수 있습니다.</div>
                    </div>
                </div>
            </Card>

            {/* Meeting selector */}
            <Card className="p-4 space-y-3">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">총회 선택</div>
                <div className="space-y-1">
                    {meetingFolders.map((folder) => {
                        const fAdmissionStatus = voteData?.meetingAdmissionStatus?.[folder.id] || 'idle';
                        const fIsHardLocked = fAdmissionStatus === 'closed';
                        const fIsRosterConfirmed = voteData?.rosterConfirmedStatus?.[folder.id] || false;
                        
                        return (
                            <button
                                key={folder.id}
                                type="button"
                                onClick={() => setSelectedMeetingId(folder.id)}
                                className={`group flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-all ${
                                    selectedMeetingId === folder.id
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                                }`}
                            >
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <FolderOpen size={14} className="shrink-0" />
                                    <span className="truncate">{folder.title}</span>
                                </div>
                                {fIsHardLocked ? (
                                    <X size={14} className={`shrink-0 ${selectedMeetingId === folder.id ? 'text-white/80' : 'text-rose-500'}`} title="입장 및 명부 마감" />
                                ) : fIsRosterConfirmed ? (
                                    <Lock size={14} className={`shrink-0 ${selectedMeetingId === folder.id ? 'text-white/80' : 'text-slate-400'}`} title="명부 확정됨" />
                                ) : null}
                            </button>
                        );
                    })}
                    {meetingFolders.length === 0 && (
                        <div className="text-xs text-slate-400 py-2">등록된 총회가 없습니다.</div>
                    )}
                </div>
            </Card>

            <Card className="p-4 space-y-3">
                <div>
                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Roster Status</div>
                    <div className="mt-2 text-2xl font-black text-slate-900">{activeMembers.length}</div>
                    <div className="text-xs text-slate-500">{selectedMeetingName} 기준 조합원 수</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="text-[11px] font-semibold text-slate-500">검색 결과</div>
                    <div className="mt-1 text-lg font-bold text-slate-900">{filteredMembers.length}명</div>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3 text-xs leading-relaxed text-emerald-700">
                    현재 {excludedCount}명이 이 총회 명부에서 제외되어 있으며{addedAfterCount > 0 ? `, ${addedAfterCount}명은 이후 총회에서 추가된 조합원` : ''}입니다.
                    제외된 조합원은 해당 총회의 입구안내 목록과 전체 조합원 수 계산에서 빠집니다.
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
            }
        >
            <div className="space-y-6">
                {/* Current meeting context banner */}
                {selectedMeetingId && selectedMeetingFolder && (
                    <div className={`flex flex-col items-start gap-1 rounded-2xl border px-5 py-3 text-sm font-semibold transition-colors ${
                        isHardLocked ? 'border-rose-200 bg-rose-50 text-rose-800' :
                        isRosterConfirmed ? 'border-slate-300 bg-slate-50 text-slate-800' :
                        'border-blue-200 bg-blue-50 text-blue-800'
                    }`}>
                        <div className="flex w-full items-center justify-between">
                            <div className="flex items-center gap-2">
                                <FolderOpen size={16} className={
                                    isHardLocked ? 'text-rose-500' :
                                    isRosterConfirmed ? 'text-slate-500' : 'text-blue-500'
                                } />
                                <span>
                                    현재 <span className="font-black">[{selectedMeetingName}]</span>
                                    {isHardLocked ? (
                                        <>
                                            {selectedMeetingFolder?.meeting_date ? (
                                                ` ${selectedMeetingFolder.meeting_date.replace(/-/g, '.')} `
                                            ) : selectedMeetingFolder?.updated_at ? (
                                                ` ${new Date(selectedMeetingFolder.updated_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric' }).replace(/\s/g, '').replace(/\.$/, '')} `
                                            ) : ''}
                                            종료되었습니다.
                                        </>
                                    ) : 
                                     isRosterConfirmed ? '의 명부가 확정되었습니다.' : 
                                     '의 명부를 편집 중입니다.'}
                                </span>
                                
                                {isHardLocked && (
                                    <span className="ml-2 flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-0.5 text-xs font-bold text-white shadow-sm" title="입장이 마감된 총회는 명부를 수정할 수 없습니다. 대시보드에서 입장 마감을 해제해야 합니다.">
                                        <X size={12} />
                                        입장 및 명부 마감
                                    </span>
                                )}
                                {!isHardLocked && isRosterConfirmed && (
                                    <span className="ml-2 flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-bold text-white shadow-sm">
                                        <Lock size={12} />
                                        명부 확정됨
                                    </span>
                                )}
                            </div>
                            
                            <button 
                                className={`text-xs font-bold underline underline-offset-2 transition-colors ${
                                    isHardLocked ? 'text-rose-400 cursor-not-allowed opacity-50' : 
                                    isRosterConfirmed ? 'text-slate-500 hover:text-slate-800' : 
                                    'text-blue-600 hover:text-blue-800'
                                }`}
                                onClick={handleToggleRosterLock}
                                title={isHardLocked ? "입장 마감 상태에서는 확정을 해제할 수 없습니다." : ""}
                                disabled={isHardLocked}
                            >
                                {isRosterConfirmed ? '확정 해제하기' : '명부 확정하기'}
                            </button>
                        </div>
                        
                        <span className={`ml-6 text-xs font-normal ${
                            isHardLocked ? 'text-rose-600' :
                            isRosterConfirmed ? 'text-slate-500' : 'text-blue-600'
                        }`}>
                            {isHardLocked 
                                ? '입장이 마감된 총회는 명부를 수정할 수 없습니다. 대시보드에서 입장 마감을 해제해야 합니다.'
                                : isRosterConfirmed 
                                    ? '이 총회의 명부가 최종 확정되어 조합원 추가/제외/수정 작업이 잠금 처리되었습니다.' 
                                    : '여기서 제외/복원 처리를 하더라도 다른 총회의 명부에는 영향을 주지 않습니다.'}
                        </span>
                    </div>
                )}

                <Card className="p-5">
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="min-w-[120px] flex-1">
                            <label className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">동/호수</label>
                            <input
                                value={newMember.unit}
                                onChange={(e) => setNewMember((prev) => ({ ...prev, unit: e.target.value }))}
                                placeholder="예: 116"
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                                disabled={isLocked}
                            />
                        </div>
                        <div className="min-w-[160px] flex-1">
                            <label className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">성명</label>
                            <input
                                value={newMember.name}
                                onChange={(e) => setNewMember((prev) => ({ ...prev, name: e.target.value }))}
                                placeholder="홍길동"
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                                disabled={isLocked}
                            />
                        </div>
                        <div className="min-w-[160px] flex-1">
                            <label className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">대리인</label>
                            <input
                                value={newMember.proxy}
                                onChange={(e) => setNewMember((prev) => ({ ...prev, proxy: e.target.value }))}
                                placeholder="없으면 비워두기"
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                                disabled={isLocked}
                            />
                        </div>
                        <Button
                            variant="primary"
                            className="h-[46px] min-w-[140px] bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500"
                            onClick={handleCreateMember}
                            disabled={isCreating || isLocked}
                            title={isLocked ? "명부가 확정되어 조합원을 추가할 수 없습니다." : ""}
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
                            <div className="text-xs text-slate-500">
                                [{selectedMeetingName}] 기준 총 {activeMembers.length}명이 전체 조합원 수로 계산됩니다.
                            </div>
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
                                    <th className="px-5 py-3">대리인</th>
                                    <th className="px-5 py-3 text-right">관리</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredMembers.map((member) => {
                                    const isEditing = editingId === member.id;
                                    const isPending = pendingId === member.id;
                                    const isExcluded = inactiveMemberIdSet.has(member.id) || member.is_active === false;
                                    const isAddedAfter = memberJoinedAfterSet.has(member.id);

                                    return (
                                        <tr key={member.id} className={`border-t border-slate-100 ${isAddedAfter ? 'bg-slate-50/80' : isExcluded ? 'bg-amber-50/60' : ''}`}>
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
                                                        {isAddedAfter && (
                                                            <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
                                                                미가입(이후 추가됨)
                                                            </span>
                                                        )}
                                                        {!isAddedAfter && isExcluded && (
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
                                                    {isAddedAfter ? (
                                                        <span className="text-xs text-slate-400">이 총회 이후 가입</span>
                                                    ) : isEditing ? (
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
                                                                className="h-9 px-3 text-xs disabled:opacity-50"
                                                                onClick={() => startEdit(member)}
                                                                disabled={isLocked}
                                                                title={isLocked ? "명부 확정 상태에서는 수정할 수 없습니다." : ""}
                                                            >
                                                                <Edit2 size={14} />
                                                                수정
                                                            </Button>
                                                            <Button
                                                                variant={isExcluded ? 'secondary' : 'danger'}
                                                                className="h-9 px-3 text-xs disabled:opacity-50"
                                                                onClick={() => handleToggleMemberActive(member)}
                                                                disabled={isPending || isLocked}
                                                                title={isLocked ? "명부 확정 상태에서는 제외/복원할 수 없습니다." : ""}
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
                    조합원 명부를 추가하거나 제외/복원하면 해당 총회의 입구안내요원 화면 전체 조합원 수와 성원 계산 기준이 즉시 바뀝니다.
                    제외는 DB 레코드를 지우지 않고 운영 기준에서만 빼므로, 과거 출석 기록이 있는 조합원도 안전하게 인원 수에서 제외할 수 있습니다.
                    각 총회마다 독립적으로 제외/복원 관리가 가능하며, 다른 총회의 명부에는 영향을 주지 않습니다.
                </div>
            </div>
        </DashboardLayout>
    );
}
