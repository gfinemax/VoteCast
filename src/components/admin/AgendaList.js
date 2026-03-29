'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import { Plus, Trash2, Edit2, FolderOpen, ChevronDown, ChevronRight, FolderPlus, CheckCircle2, Play, Link2, FileText, Upload, Loader2, AlertTriangle, GripVertical, Lock, Unlock } from 'lucide-react';
import Button from '@/components/ui/Button';

const GHOST_GROUP_ID = 'ghost';

const buildAgendaGroups = (agendas = []) => {
    const groups = [];
    let currentGroup = { folder: null, items: [] };

    agendas.forEach((agenda) => {
        if (agenda.type === 'folder') {
            if (currentGroup.folder || currentGroup.items.length > 0) {
                groups.push(currentGroup);
            }
            currentGroup = { folder: agenda, items: [] };
            return;
        }

        currentGroup.items.push(agenda);
    });

    if (currentGroup.folder || currentGroup.items.length > 0) {
        groups.push(currentGroup);
    }

    return groups;
};

const getAgendaRowDropPosition = (element, clientY) => {
    const rect = element.getBoundingClientRect();
    return clientY < rect.top + (rect.height / 2) ? 'before' : 'after';
};

export default function AgendaList() {
    const { state, actions } = useStore();
    const { agendas, currentAgendaId, voteData } = state;

    const [isAddingFolder, setIsAddingFolder] = useState(false);
    const [newFolderTitle, setNewFolderTitle] = useState("");
    const [addingAgendaFolderId, setAddingAgendaFolderId] = useState(null);
    const [newAgendaTitle, setNewAgendaTitle] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [editTitle, setEditTitle] = useState("");
    const [editPresentationType, setEditPresentationType] = useState('URL');
    const [editPresentationSource, setEditPresentationSource] = useState("");
    const [editStartPage, setEditStartPage] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [expandedFolders, setExpandedFolders] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deletePopoverStyle, setDeletePopoverStyle] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [draggedAgendaId, setDraggedAgendaId] = useState(null);
    const [dropTarget, setDropTarget] = useState(null);
    const [isReordering, setIsReordering] = useState(false);

    const rowRefs = useRef(new Map());
    const deletePopoverRef = useRef(null);

    const groupedAgendas = useMemo(() => buildAgendaGroups(agendas).reverse(), [agendas]);
    const flatAgendaIds = useMemo(
        () => [...agendas].sort((a, b) => a.order_index - b.order_index).map((agenda) => agenda.id),
        [agendas]
    );
    const isAgendaOrderLocked = !!voteData?.agendaOrderLocked;
    const canDragAgendas = editingId === null && !isSubmitting && !isDeleting && !isUploading && !deleteTarget && !isReordering && !isAgendaOrderLocked;

    const setRowRef = (id, node) => {
        if (node) {
            rowRefs.current.set(String(id), node);
            return;
        }

        rowRefs.current.delete(String(id));
    };

    const closeDeleteConfirm = () => {
        if (isDeleting) return;
        setDeleteTarget(null);
        setDeletePopoverStyle(null);
    };

    const toggleAgendaOrderLock = async () => {
        try {
            await actions.setAgendaOrderLock(!isAgendaOrderLocked);
        } catch (error) {
            console.error('Failed to persist agenda order lock:', error);
            alert(error.message || '안건 정렬 잠금 저장에 실패했습니다.');
        }
    };

    const resetDragState = () => {
        setDraggedAgendaId(null);
        setDropTarget(null);
    };

    const toggleFolder = (folderId) => {
        setDeleteTarget(null);
        setExpandedFolders((prev) => ({
            ...prev,
            [folderId]: prev[folderId] === undefined ? false : !prev[folderId]
        }));
    };

    const isFolderExpanded = (id) => {
        return expandedFolders[id] !== false;
    };

    const handleAddFolder = () => {
        if (!newFolderTitle.trim()) return;
        actions.addAgenda({ title: newFolderTitle, type: 'folder' });
        setNewFolderTitle("");
        setIsAddingFolder(false);
    };

    const handleAddAgenda = async () => {
        if (!newAgendaTitle.trim() || isSubmitting) return;
        setIsSubmitting(true);

        try {
            const folderId = addingAgendaFolderId;
            const group = groupedAgendas.find((g) => (g.folder ? g.folder.id : 'ghost') === folderId);
            let targetIndex = null;

            if (group) {
                const lastItem = group.items.length > 0 ? group.items[group.items.length - 1] : group.folder;
                targetIndex = lastItem ? lastItem.order_index : 0;
            }

            await actions.addAgenda({ title: newAgendaTitle, type: 'general' }, targetIndex);
            setNewAgendaTitle("");
            setAddingAgendaFolderId(null);
        } catch (error) {
            console.error("Add Agenda Failed:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const startEdit = (agenda) => {
        setDeleteTarget(null);
        setShowAdvanced(!!agenda.presentation_source);
        setEditingId(agenda.id);
        setEditTitle(agenda.title);
        setEditPresentationType(agenda.presentation_type || 'URL');
        setEditPresentationSource(agenda.presentation_source || "");
        setEditStartPage(agenda.start_page || "");
    };

    const getDisplayFileName = (url) => {
        if (!url) return '';

        try {
            const urlObj = new URL(url);
            const queryName = urlObj.searchParams.get('filename');
            if (queryName) return queryName;

            const decoded = decodeURIComponent(url);
            const filename = decoded.split('/').pop().split('?')[0];
            const parts = filename.split('_');
            if (parts.length > 1 && /^\d+$/.test(parts[0])) {
                return parts.slice(1).join('_');
            }
            return filename;
        } catch (e) {
            const filename = url.split('/').pop().split('?')[0];
            return filename || '파일';
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const sanitizedName = file.name.replace(/[^a-zA-Z0-9.\-_ㄱ-ㅎㅏ-ㅣ가-힣]/g, '');
            const safeFileName = `${Date.now()}_${Math.random().toString(36).substr(2, 5)}.pdf`;

            const { error } = await supabase.storage
                .from('agenda-materials')
                .upload(safeFileName, file, {
                    contentType: 'application/pdf',
                    upsert: true
                });

            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage
                .from('agenda-materials')
                .getPublicUrl(safeFileName);

            setEditPresentationSource(`${publicUrl}?filename=${encodeURIComponent(sanitizedName)}`);
        } catch (error) {
            console.error('Upload failed:', error);
            alert('파일 업로드에 실패했습니다.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleEdit = () => {
        if (!editTitle.trim()) return;

        actions.updateAgenda({
            id: editingId,
            title: editTitle,
            presentation_type: editPresentationType,
            presentation_source: editPresentationSource,
            start_page: parseInt(editStartPage) || null
        });

        setEditingId(null);
    };

    const openDeleteConfirm = (e, agenda) => {
        e.stopPropagation();
        setDeleteTarget({
            id: agenda.id,
            title: agenda.title,
            type: agenda.type
        });
    };

    const confirmDelete = async () => {
        if (!deleteTarget || isDeleting) return;

        setIsDeleting(true);
        try {
            await actions.deleteAgenda(deleteTarget.id);
            setDeleteTarget(null);
            setDeletePopoverStyle(null);
        } finally {
            setIsDeleting(false);
        }
    };

    const buildNextAgendaOrder = (target) => {
        if (!draggedAgendaId || !target) return null;

        const nextIds = flatAgendaIds.filter((id) => id !== draggedAgendaId);
        let insertIndex = -1;

        if (target.type === 'before' || target.type === 'after') {
            if (target.agendaId === draggedAgendaId) return null;

            const targetIndex = nextIds.indexOf(target.agendaId);
            if (targetIndex === -1) return null;
            insertIndex = target.type === 'before' ? targetIndex : targetIndex + 1;
        }

        if (target.type === 'group-start' || target.type === 'group-end') {
            const group = groupedAgendas.find((candidate) => (candidate.folder ? candidate.folder.id : GHOST_GROUP_ID) === target.folderId);
            if (!group) return null;

            if (target.type === 'group-start') {
                if (target.folderId === GHOST_GROUP_ID) {
                    insertIndex = 0;
                } else {
                    const folderIndex = nextIds.indexOf(target.folderId);
                    if (folderIndex === -1) return null;
                    insertIndex = folderIndex + 1;
                }
            } else {
                const remainingItemIds = group.items
                    .map((item) => item.id)
                    .filter((id) => id !== draggedAgendaId && nextIds.includes(id));
                const anchorId = remainingItemIds[remainingItemIds.length - 1] ?? group.folder?.id ?? null;

                if (anchorId === null) {
                    insertIndex = 0;
                } else {
                    const anchorIndex = nextIds.indexOf(anchorId);
                    if (anchorIndex === -1) return null;
                    insertIndex = anchorIndex + 1;
                }
            }
        }

        if (insertIndex < 0) return null;

        nextIds.splice(insertIndex, 0, draggedAgendaId);
        const unchanged = flatAgendaIds.every((id, index) => id === nextIds[index]);

        return unchanged ? null : nextIds;
    };

    const handleAgendaDragStart = (agendaId) => (e) => {
        if (!canDragAgendas) {
            e.preventDefault();
            return;
        }

        setDeleteTarget(null);
        setDraggedAgendaId(agendaId);
        setDropTarget(null);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(agendaId));
    };

    const handleAgendaDragEnd = () => {
        resetDragState();
    };

    const handleAgendaDragOver = (agendaId) => (e) => {
        if (!draggedAgendaId || draggedAgendaId === agendaId) return;

        e.preventDefault();
        const position = getAgendaRowDropPosition(e.currentTarget, e.clientY);
        setDropTarget((prev) => (
            prev?.type === position && prev?.agendaId === agendaId
                ? prev
                : { type: position, agendaId }
        ));
    };

    const handleGroupDragOver = (type, folderId) => (e) => {
        if (!draggedAgendaId) return;

        e.preventDefault();
        setDropTarget((prev) => (
            prev?.type === type && prev?.folderId === folderId
                ? prev
                : { type, folderId }
        ));
    };

    const commitAgendaReorder = async (target) => {
        const nextAgendaOrder = buildNextAgendaOrder(target);
        resetDragState();

        if (!nextAgendaOrder) return;

        setIsReordering(true);

        try {
            await actions.reorderAgendas(nextAgendaOrder);
        } catch (error) {
            console.error('Failed to reorder agendas:', error);
            alert(error.message || '안건 순서 변경에 실패했습니다.');
        } finally {
            setIsReordering(false);
        }
    };

    const handleAgendaDrop = (agendaId) => async (e) => {
        if (!draggedAgendaId || draggedAgendaId === agendaId) return;

        e.preventDefault();
        const position = getAgendaRowDropPosition(e.currentTarget, e.clientY);
        await commitAgendaReorder({ type: position, agendaId });
    };

    const handleGroupDrop = (type, folderId) => async (e) => {
        if (!draggedAgendaId) return;

        e.preventDefault();
        await commitAgendaReorder({ type, folderId });
    };

    useEffect(() => {
        if (!deleteTarget) return;

        const updatePopoverPosition = () => {
            const anchor = rowRefs.current.get(String(deleteTarget.id));

            if (!anchor) {
                setDeleteTarget(null);
                setDeletePopoverStyle(null);
                return;
            }

            const rect = anchor.getBoundingClientRect();
            const width = Math.min(360, Math.max(300, rect.width));
            const estimatedHeight = deleteTarget.type === 'folder' ? 210 : 184;
            const gap = 10;
            const showAbove = rect.top > estimatedHeight + gap + 16;
            const idealLeft = rect.left + (rect.width / 2) - (width / 2);
            const clampedLeft = Math.min(window.innerWidth - width - 16, Math.max(16, idealLeft));
            const arrowLeft = Math.min(width - 24, Math.max(24, rect.left + (rect.width / 2) - clampedLeft));

            setDeletePopoverStyle({
                top: showAbove ? rect.top - gap : rect.bottom + gap,
                left: clampedLeft,
                width,
                placement: showAbove ? 'top' : 'bottom',
                arrowLeft
            });
        };

        updatePopoverPosition();
        window.addEventListener('resize', updatePopoverPosition);
        window.addEventListener('scroll', updatePopoverPosition, true);

        return () => {
            window.removeEventListener('resize', updatePopoverPosition);
            window.removeEventListener('scroll', updatePopoverPosition, true);
        };
    }, [deleteTarget]);

    useEffect(() => {
        if (!deleteTarget) return;

        const handlePointerDown = (e) => {
            if (deletePopoverRef.current?.contains(e.target)) return;
            if (isDeleting) return;
            setDeleteTarget(null);
            setDeletePopoverStyle(null);
        };

        const handleKeyDown = (e) => {
            if (e.key !== 'Escape' || isDeleting) return;
            setDeleteTarget(null);
            setDeletePopoverStyle(null);
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [deleteTarget, isDeleting]);

    useEffect(() => {
        const currentIndex = agendas.findIndex((agenda) => agenda.id === currentAgendaId);
        if (currentIndex < 0) return;

        for (let i = currentIndex; i >= 0; i--) {
            const candidate = agendas[i];
            if (candidate.type !== 'folder') continue;

            setExpandedFolders((prev) => {
                if (prev[candidate.id] !== false) return prev;
                return { ...prev, [candidate.id]: true };
            });
            break;
        }
    }, [agendas, currentAgendaId]);

    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            const currentRow = rowRefs.current.get(String(currentAgendaId));
            currentRow?.scrollIntoView({
                block: 'nearest',
                behavior: 'smooth'
            });
        });

        return () => window.cancelAnimationFrame(frame);
    }, [currentAgendaId, expandedFolders]);

    useEffect(() => {
        if (canDragAgendas) return;
        resetDragState();
    }, [canDragAgendas]);

    return (
        <>
            <div className="flex-1 overflow-y-auto p-4 space-y-0.5">
                <div className="flex justify-between items-center mb-1.5 px-1">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">총회 및 안건 목록</div>
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={toggleAgendaOrderLock}
                            className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors ${isAgendaOrderLocked ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'}`}
                            title={isAgendaOrderLocked ? '안건 순서 잠금 해제' : '안건 순서 잠금'}
                        >
                            {isAgendaOrderLocked ? <Lock size={13} /> : <Unlock size={13} />}
                            {isAgendaOrderLocked ? '정렬 잠금' : '정렬 열림'}
                        </button>
                        <button
                            onClick={() => setIsAddingFolder(true)}
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium px-2 py-0.5 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                        >
                            <FolderPlus size={14} /> 총회 추가
                        </button>
                    </div>
                </div>

                {isAgendaOrderLocked && (
                    <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800">
                        안건 순서가 잠겨 있습니다. 헤더의 잠금 버튼을 눌러야 드래그 정렬을 할 수 있습니다.
                    </div>
                )}

                {isAddingFolder && (
                    <div className="mb-2 p-2 bg-blue-50/50 rounded-lg border border-blue-100 animate-in fade-in slide-in-from-top-2">
                        <div className="text-xs font-semibold text-blue-800 mb-1">새로운 총회(폴더) 만들기</div>
                        <input
                            autoFocus
                            className="w-full text-xs p-1.5 mb-1.5 border border-blue-200 rounded focus:ring-2 focus:ring-blue-100 outline-none"
                            placeholder="예: 2027년 정기총회"
                            value={newFolderTitle}
                            onChange={(e) => setNewFolderTitle(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.nativeEvent.isComposing) return;
                                if (e.key === 'Enter') handleAddFolder();
                                if (e.key === 'Escape') setIsAddingFolder(false);
                            }}
                        />
                        <div className="flex gap-2 justify-end">
                            <Button variant="ghost" className="h-6 text-[10px]" onClick={() => setIsAddingFolder(false)}>취소</Button>
                            <Button variant="primary" className="h-6 text-[10px] bg-blue-600 hover:bg-blue-700" onClick={handleAddFolder}>만들기</Button>
                        </div>
                    </div>
                )}

                {groupedAgendas.map((group) => (
                    <AgendaGroup
                        key={group.folder ? group.folder.id : 'ghost'}
                        group={group}
                        state={state}
                        actions={actions}
                        currentAgendaId={currentAgendaId}
                        editingId={editingId}
                        editTitle={editTitle}
                        setEditTitle={setEditTitle}
                        editPresentationType={editPresentationType}
                        setEditPresentationType={setEditPresentationType}
                        editPresentationSource={editPresentationSource}
                        setEditPresentationSource={setEditPresentationSource}
                        editStartPage={editStartPage}
                        setEditStartPage={setEditStartPage}
                        isUploading={isUploading}
                        showAdvanced={showAdvanced}
                        setShowAdvanced={setShowAdvanced}
                        setEditingId={setEditingId}
                        addingAgendaFolderId={addingAgendaFolderId}
                        setAddingAgendaFolderId={setAddingAgendaFolderId}
                        newAgendaTitle={newAgendaTitle}
                        setNewAgendaTitle={setNewAgendaTitle}
                        isSubmitting={isSubmitting}
                        deleteTarget={deleteTarget}
                        setDeleteTarget={setDeleteTarget}
                        setRowRef={setRowRef}
                        toggleFolder={toggleFolder}
                        isFolderExpanded={isFolderExpanded}
                        startEdit={startEdit}
                        handleEdit={handleEdit}
                        handleAddAgenda={handleAddAgenda}
                        handleFileUpload={handleFileUpload}
                        openDeleteConfirm={openDeleteConfirm}
                        getDisplayFileName={getDisplayFileName}
                        draggedAgendaId={draggedAgendaId}
                        dropTarget={dropTarget}
                        canDragAgendas={canDragAgendas}
                        isReordering={isReordering}
                        handleAgendaDragStart={handleAgendaDragStart}
                        handleAgendaDragEnd={handleAgendaDragEnd}
                        handleAgendaDragOver={handleAgendaDragOver}
                        handleAgendaDrop={handleAgendaDrop}
                        handleGroupDragOver={handleGroupDragOver}
                        handleGroupDrop={handleGroupDrop}
                    />
                ))}
            </div>

            <DeleteConfirmPopover
                deleteTarget={deleteTarget}
                deletePopoverStyle={deletePopoverStyle}
                deletePopoverRef={deletePopoverRef}
                closeDeleteConfirm={closeDeleteConfirm}
                confirmDelete={confirmDelete}
                isDeleting={isDeleting}
            />
        </>
    );
}

function DeleteConfirmPopover({
    deleteTarget,
    deletePopoverStyle,
    deletePopoverRef,
    closeDeleteConfirm,
    confirmDelete,
    isDeleting
}) {
    if (!deleteTarget || !deletePopoverStyle) return null;

    return (
        <div className="fixed inset-0 z-[60] pointer-events-none">
            <div
                ref={deletePopoverRef}
                role="alertdialog"
                aria-modal="false"
                style={{
                    top: deletePopoverStyle.top,
                    left: deletePopoverStyle.left,
                    width: deletePopoverStyle.width
                }}
                className="fixed pointer-events-auto rounded-2xl border border-red-200 bg-white shadow-2xl shadow-red-950/10"
            >
                <div className="rounded-t-2xl border-b border-red-100 bg-gradient-to-r from-red-50 to-orange-50 px-4 py-3">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-600">
                            <AlertTriangle size={18} />
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs font-bold uppercase tracking-[0.18em] text-red-500">Danger Zone</div>
                            <h3 className="mt-1 text-sm font-bold text-slate-900">
                                {deleteTarget.type === 'folder' ? '총회를 삭제합니다' : '안건을 삭제합니다'}
                            </h3>
                        </div>
                    </div>
                </div>

                <div className="space-y-3 px-4 py-4">
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3">
                        <div className="text-[11px] font-semibold text-red-700">삭제 대상</div>
                        <div className="mt-1 break-words text-sm font-bold text-slate-900">{deleteTarget.title}</div>
                    </div>

                    <p className="text-xs leading-relaxed text-slate-600">
                        {deleteTarget.type === 'folder'
                            ? '총회를 삭제하면 하위 안건은 유지되지만 그룹이 해제될 수 있습니다. 구조가 바뀌므로 삭제 전 다시 확인하세요.'
                            : '삭제한 안건은 목록에서 즉시 사라집니다. 잘못 삭제하면 다시 직접 추가해야 합니다.'}
                    </p>

                    <div className="flex items-center justify-end gap-2 pt-1">
                        <Button variant="secondary" className="h-8 px-3 text-xs" onClick={closeDeleteConfirm} disabled={isDeleting}>
                            취소
                        </Button>
                        <Button variant="danger" className="h-8 px-3 text-xs border-red-300 bg-red-600 text-white hover:bg-red-700" onClick={confirmDelete} disabled={isDeleting}>
                            {isDeleting ? '삭제 중...' : '삭제'}
                        </Button>
                    </div>
                </div>

                <div
                    style={{ left: deletePopoverStyle.arrowLeft }}
                    className={`absolute h-3 w-3 -translate-x-1/2 rotate-45 bg-white ${deletePopoverStyle.placement === 'top' ? '-bottom-1.5 border-b border-r border-red-200' : '-top-1.5 border-l border-t border-red-200'}`}
                />
            </div>
        </div>
    );
}

function AgendaGroup({
    group,
    state,
    actions,
    currentAgendaId,
    editingId,
    editTitle,
    setEditTitle,
    editPresentationType,
    setEditPresentationType,
    editPresentationSource,
    setEditPresentationSource,
    editStartPage,
    setEditStartPage,
    isUploading,
    showAdvanced,
    setShowAdvanced,
    setEditingId,
    addingAgendaFolderId,
    setAddingAgendaFolderId,
    newAgendaTitle,
    setNewAgendaTitle,
    isSubmitting,
    deleteTarget,
    setDeleteTarget,
    setRowRef,
    toggleFolder,
    isFolderExpanded,
    startEdit,
    handleEdit,
    handleAddAgenda,
    handleFileUpload,
    openDeleteConfirm,
    getDisplayFileName,
    draggedAgendaId,
    dropTarget,
    canDragAgendas,
    isReordering,
    handleAgendaDragStart,
    handleAgendaDragEnd,
    handleAgendaDragOver,
    handleAgendaDrop,
    handleGroupDragOver,
    handleGroupDrop
}) {
    const isGhost = !group.folder;
    const folderId = group.folder ? group.folder.id : GHOST_GROUP_ID;
    const expanded = isFolderExpanded(folderId);
    const isFolderDeleteTarget = deleteTarget?.id === group.folder?.id;
    const isGroupStartDropTarget = dropTarget?.type === 'group-start' && dropTarget.folderId === folderId;
    const isGroupEndDropTarget = dropTarget?.type === 'group-end' && dropTarget.folderId === folderId;

    return (
        <div className="relative">
            {!isGhost && (
                <div
                    ref={(node) => setRowRef(group.folder.id, node)}
                    className={`group flex items-center gap-2 mb-0 px-2 py-0.5 rounded-sm border cursor-pointer transition-colors select-none ${state.activeMeetingId === group.folder.id ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 hover:bg-slate-100 border-slate-200'} ${isFolderDeleteTarget ? 'bg-red-50 border-red-200 ring-2 ring-red-200 shadow-sm' : ''} ${isGroupStartDropTarget ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200 shadow-sm' : ''}`}
                    onClick={() => toggleFolder(folderId)}
                    onDragOver={canDragAgendas ? handleGroupDragOver('group-start', folderId) : undefined}
                    onDrop={canDragAgendas ? handleGroupDrop('group-start', folderId) : undefined}
                >
                    {expanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                    <FolderOpen size={16} className={isFolderDeleteTarget ? "text-red-500" : state.activeMeetingId === group.folder.id ? "text-emerald-500" : "text-blue-500"} />

                    {editingId === group.folder.id ? (
                        <div className="flex-1 bg-white border border-blue-200 rounded p-2 shadow-md my-1 z-20 cursor-default" onClick={(e) => e.stopPropagation()}>
                            <div className="mb-2">
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">총회(폴더) 명칭</label>
                                <input
                                    className="w-full rounded border border-slate-300 bg-white p-1.5 text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:border-blue-500 outline-none"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div className="mb-2">
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">총회 통합 자료 (Master PPT)</label>
                                <div className="flex gap-1 mb-1">
                                    <button
                                        onClick={() => setEditPresentationType('URL')}
                                        className={`flex-1 py-1 text-[10px] rounded border ${editPresentationType === 'URL' ? 'bg-blue-100 border-blue-300 text-blue-800 font-bold' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                                    >웹 링크</button>
                                    <button
                                        onClick={() => setEditPresentationType('FILE')}
                                        className={`flex-1 py-1 text-[10px] rounded border ${editPresentationType === 'FILE' ? 'bg-blue-100 border-blue-300 text-blue-800 font-bold' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                                    >파일 업로드</button>
                                </div>

                                {editPresentationType === 'URL' ? (
                                    <input
                                        className="w-full text-xs p-1.5 rounded border border-slate-300 outline-none"
                                        placeholder="https://..."
                                        value={editPresentationSource}
                                        onChange={(e) => setEditPresentationSource(e.target.value)}
                                    />
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <label className={`flex-1 flex items-center gap-2 cursor-pointer p-1.5 border border-dashed rounded bg-slate-50 hover:bg-white ${isUploading ? 'opacity-50' : ''}`}>
                                            <Upload size={12} className="text-slate-400" />
                                            <span className="text-[10px] text-slate-600 truncate">{editPresentationSource ? '파일 변경' : 'PDF 선택'}</span>
                                            <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                                        </label>
                                        {isUploading && <Loader2 size={12} className="animate-spin text-blue-500" />}
                                    </div>
                                )}

                                {editPresentationSource && (
                                    <div className="text-[10px] text-emerald-600 mt-1 truncate flex items-center gap-1">
                                        <CheckCircle2 size={10} />
                                        {getDisplayFileName(editPresentationSource)}
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-1 mt-1 border-t border-slate-100 pt-1">
                                <Button variant="ghost" className="h-6 text-[10px]" onClick={() => setEditingId(null)}>취소</Button>
                                <Button variant="primary" className="h-6 text-[10px] bg-emerald-600" onClick={handleEdit}>저장</Button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex-1 flex flex-row items-center justify-between">
                                <span className={`text-sm font-bold ${isFolderDeleteTarget ? 'text-red-700' : 'text-slate-700'}`}>{group.folder.title}</span>
                                {state.activeMeetingId === group.folder.id ? (
                                    <span className="text-[10px] font-semibold text-orange-600 flex items-center gap-1">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                                        </span>
                                        입장 접수 중
                                    </span>
                                ) : (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm(`'${group.folder.title}'의 입장을 시작하시겠습니까?\n기존에 진행 중인 입장은 중단됩니다.`)) {
                                                actions.setActiveMeeting(group.folder.id);
                                            }
                                        }}
                                        className="w-fit text-[10px] text-slate-400 hover:text-blue-600 hover:underline flex items-center gap-0.5"
                                    >
                                        <Play size={8} /> 입장 시작
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button className="p-1 text-slate-400 hover:text-blue-600" onClick={(e) => { e.stopPropagation(); startEdit(group.folder); }}>
                                    <Edit2 size={12} />
                                </button>
                                <button className="p-1 text-slate-400 hover:text-red-600" onClick={(e) => openDeleteConfirm(e, group.folder)}>
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {(expanded || isGhost) && (
                <div className={`${!isGhost ? 'pl-4 md:pl-6 border-l-[1.5px] border-slate-200 ml-2.5 space-y-0' : 'space-y-0'} animate-in fade-in duration-200`}>
                    {group.items.map((agenda) => (
                        <AgendaItem
                            key={agenda.id}
                            agenda={agenda}
                            group={group}
                            currentAgendaId={currentAgendaId}
                            editingId={editingId}
                            editTitle={editTitle}
                            setEditTitle={setEditTitle}
                            editPresentationType={editPresentationType}
                            setEditPresentationType={setEditPresentationType}
                            editPresentationSource={editPresentationSource}
                            setEditPresentationSource={setEditPresentationSource}
                            editStartPage={editStartPage}
                            setEditStartPage={setEditStartPage}
                            isUploading={isUploading}
                            showAdvanced={showAdvanced}
                            setShowAdvanced={setShowAdvanced}
                            setEditingId={setEditingId}
                            deleteTarget={deleteTarget}
                            setDeleteTarget={setDeleteTarget}
                            setRowRef={setRowRef}
                            actions={actions}
                            startEdit={startEdit}
                            handleEdit={handleEdit}
                            handleFileUpload={handleFileUpload}
                            openDeleteConfirm={openDeleteConfirm}
                            getDisplayFileName={getDisplayFileName}
                            draggedAgendaId={draggedAgendaId}
                            dropTarget={dropTarget}
                            canDragAgendas={canDragAgendas}
                            isReordering={isReordering}
                            handleAgendaDragStart={handleAgendaDragStart}
                            handleAgendaDragEnd={handleAgendaDragEnd}
                            handleAgendaDragOver={handleAgendaDragOver}
                            handleAgendaDrop={handleAgendaDrop}
                        />
                    ))}

                    <div
                        className={`pt-0.5 rounded-lg transition-colors ${isGroupEndDropTarget ? 'bg-blue-50/80 ring-2 ring-blue-200 ring-inset' : ''}`}
                        onDragOver={canDragAgendas ? handleGroupDragOver('group-end', folderId) : undefined}
                        onDrop={canDragAgendas ? handleGroupDrop('group-end', folderId) : undefined}
                    >
                        {addingAgendaFolderId === folderId ? (
                            <div className="mb-1 p-2 bg-slate-50 rounded border border-slate-200 animate-in fade-in slide-in-from-top-1">
                                <input
                                    autoFocus
                                    className="w-full text-xs p-1.5 mb-1.5 border border-slate-300 rounded focus:ring-2 focus:ring-slate-200 outline-none"
                                    placeholder="안건 제목 입력..."
                                    value={newAgendaTitle}
                                    onChange={(e) => setNewAgendaTitle(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.nativeEvent.isComposing) return;
                                        if (e.key === 'Enter') handleAddAgenda();
                                        if (e.key === 'Escape') setAddingAgendaFolderId(null);
                                    }}
                                />
                                <div className="flex gap-1 justify-end">
                                    <Button variant="ghost" className="h-6 text-[11px]" onClick={() => setAddingAgendaFolderId(null)} disabled={isSubmitting}>취소</Button>
                                    <Button variant="primary" className="h-6 text-[11px] bg-slate-800" onClick={handleAddAgenda} disabled={isSubmitting}>
                                        {isSubmitting ? '추가 중...' : '추가'}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => {
                                    setAddingAgendaFolderId(folderId);
                                    setNewAgendaTitle("");
                                }}
                                disabled={isReordering}
                                className="w-full py-1.5 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 border border-dashed border-slate-300 rounded-md flex items-center justify-center gap-1 transition-colors group/btn"
                                title="이 총회에 안건 추가"
                            >
                                <Plus size={12} className="group-hover/btn:scale-110 transition-transform" /> {isGroupEndDropTarget ? '여기에 놓아 마지막 순서로 이동' : '안건 추가'}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function AgendaItem({
    agenda,
    group,
    currentAgendaId,
    editingId,
    editTitle,
    setEditTitle,
    editPresentationType,
    setEditPresentationType,
    editPresentationSource,
    setEditPresentationSource,
    editStartPage,
    setEditStartPage,
    isUploading,
    showAdvanced,
    setShowAdvanced,
    setEditingId,
    deleteTarget,
    setDeleteTarget,
    setRowRef,
    actions,
    startEdit,
    handleEdit,
    handleFileUpload,
    openDeleteConfirm,
    getDisplayFileName,
    draggedAgendaId,
    dropTarget,
    canDragAgendas,
    isReordering,
    handleAgendaDragStart,
    handleAgendaDragEnd,
    handleAgendaDragOver,
    handleAgendaDrop
}) {
    const isAgendaDeleteTarget = deleteTarget?.id === agenda.id;
    const isDragged = draggedAgendaId === agenda.id;
    const isDropBefore = dropTarget?.type === 'before' && dropTarget.agendaId === agenda.id;
    const isDropAfter = dropTarget?.type === 'after' && dropTarget.agendaId === agenda.id;

    return (
        <div
            ref={(node) => setRowRef(agenda.id, node)}
            className={`group w-full text-left p-1.5 text-sm font-medium transition-all relative flex items-center gap-2 ${currentAgendaId === agenda.id ? "bg-slate-900 text-white border border-slate-900 rounded-md z-10 shadow-md my-1 scale-[1.02]" : "bg-white text-slate-600 hover:bg-slate-50 border-b border-x border-slate-100 first:border-t rounded-none first:rounded-t-md last:rounded-b-md"} ${isAgendaDeleteTarget ? 'ring-2 ring-red-300 ring-offset-1 border-red-200 shadow-lg' : ''} ${isDragged ? 'opacity-45' : ''}`}
            onClick={() => {
                if (editingId !== agenda.id) {
                    setDeleteTarget(null);
                    actions.setAgenda(agenda.id);
                }
            }}
            onDragOver={canDragAgendas ? handleAgendaDragOver(agenda.id) : undefined}
            onDrop={canDragAgendas ? handleAgendaDrop(agenda.id) : undefined}
        >
            {isDropBefore && <div className="pointer-events-none absolute -top-1 left-3 right-3 h-0.5 rounded-full bg-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.16)]" />}
            {isDropAfter && <div className="pointer-events-none absolute -bottom-1 left-3 right-3 h-0.5 rounded-full bg-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.16)]" />}
            {editingId === agenda.id ? (
                <div className="w-full bg-slate-50 border border-blue-200 rounded p-3 space-y-3 shadow-md my-1 z-20 cursor-default" onClick={(e) => e.stopPropagation()}>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">안건 제목</label>
                        <input
                            className="w-full rounded border border-slate-300 bg-white p-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 outline-none"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            autoFocus
                            placeholder="안건 제목"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleEdit();
                                if (e.key === 'Escape') setEditingId(null);
                            }}
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">시작 페이지 (번호)</label>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">P.</span>
                            <input
                                type="number"
                                className="w-16 text-lg p-1 rounded-lg border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-center font-mono font-bold text-slate-900 bg-white"
                                value={editStartPage}
                                onChange={(e) => setEditStartPage(e.target.value)}
                                placeholder="0"
                                autoComplete="off"
                            />
                            <span className="text-[10px] text-slate-400 font-medium">페이지 이동 설정</span>
                        </div>
                    </div>

                    {!editPresentationSource && group.folder?.presentation_source && (
                        <div className="mt-1 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg text-[10px] text-blue-700 flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
                            <FileText size={14} className="text-blue-400" />
                            <div className="flex flex-col">
                                <span className="font-bold opacity-70">총회 통합 자료 연동 중</span>
                                <span className="truncate max-w-[180px]">{getDisplayFileName(group.folder.presentation_source)}</span>
                            </div>
                            {editStartPage && (
                                <div className="ml-auto flex items-center gap-1 bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold font-mono text-[11px] shadow-sm">
                                    <Play size={8} fill="currentColor" />
                                    P.{editStartPage}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="border-t border-slate-200 pt-2">
                        <button
                            className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-800 font-medium mb-2"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                        >
                            {showAdvanced ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            개별 자료 설정 (고급)
                        </button>

                        {showAdvanced && (
                            <div className="bg-white p-2 rounded border border-slate-200 space-y-2">
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => setEditPresentationType('URL')}
                                        className={`flex-1 flex items-center justify-center gap-1 py-1 text-[10px] rounded border transition-colors ${editPresentationType === 'URL' ? 'bg-blue-100 border-blue-300 text-blue-800 font-bold' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}
                                    >
                                        <Link2 size={10} /> 웹 링크
                                    </button>
                                    <button
                                        onClick={() => setEditPresentationType('FILE')}
                                        className={`flex-1 flex items-center justify-center gap-1 py-1 text-[10px] rounded border transition-colors ${editPresentationType === 'FILE' ? 'bg-blue-100 border-blue-300 text-blue-800 font-bold' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}
                                    >
                                        <Upload size={10} /> 파일 업로드
                                    </button>
                                </div>

                                {editPresentationType === 'URL' ? (
                                    <input
                                        className="w-full text-xs p-1.5 rounded border border-slate-300 focus:border-blue-500 outline-none"
                                        placeholder="https://docs.google.com/presentation/..."
                                        value={editPresentationSource}
                                        onChange={(e) => setEditPresentationSource(e.target.value)}
                                    />
                                ) : (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <label className={`flex-1 flex items-center gap-2 cursor-pointer p-1.5 border border-dashed rounded transition-colors bg-white ${isUploading ? 'opacity-50 pointer-events-none' : 'hover:bg-blue-50 border-slate-300 hover:border-blue-400'}`}>
                                                <Upload size={14} className="text-slate-400" />
                                                <span className="text-xs text-slate-600 truncate">
                                                    {isUploading ? '업로드 중...' : (editPresentationSource ? '파일 변경' : '파일 선택...')}
                                                </span>
                                                <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                                            </label>
                                            {isUploading && <Loader2 size={16} className="animate-spin text-blue-500 flex-shrink-0" />}
                                        </div>
                                        {editPresentationSource && (
                                            <div className="text-[10px] text-emerald-600 mt-1 truncate flex items-center gap-1">
                                                <CheckCircle2 size={10} />
                                                {getDisplayFileName(editPresentationSource)}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-1 border-t border-slate-100 mt-2">
                        <Button variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>취소</Button>
                        <Button variant="primary" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 shadow-sm" onClick={handleEdit}>
                            저장
                        </Button>
                    </div>
                </div>
            ) : (
                <>
                    <button
                        type="button"
                        draggable={canDragAgendas}
                        disabled={!canDragAgendas || isReordering}
                        onDragStart={handleAgendaDragStart(agenda.id)}
                        onDragEnd={handleAgendaDragEnd}
                        onClick={(e) => e.stopPropagation()}
                        className={`flex h-6 w-5 flex-shrink-0 cursor-grab items-center justify-center rounded transition-colors active:cursor-grabbing ${currentAgendaId === agenda.id ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'text-slate-300 hover:bg-slate-100 hover:text-slate-500'} ${!canDragAgendas || isReordering ? 'cursor-not-allowed opacity-40' : ''}`}
                        title={canDragAgendas ? '드래그해서 순서 변경' : '편집 중에는 순서를 변경할 수 없습니다.'}
                    >
                        <GripVertical size={12} />
                    </button>
                    {agenda.declaration ? (
                        <CheckCircle2 size={14} className={`${isAgendaDeleteTarget ? 'text-red-500' : 'text-emerald-500'} flex-shrink-0`} />
                    ) : (
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isAgendaDeleteTarget ? 'bg-red-400' : currentAgendaId === agenda.id ? 'bg-emerald-400' : 'bg-slate-300 group-hover:bg-slate-400'}`}></div>
                    )}
                    <span className={`line-clamp-1 flex-1 text-xs leading-normal ${agenda.declaration ? 'text-slate-400 line-through decoration-slate-300' : ''} ${currentAgendaId === agenda.id ? '!text-white !no-underline' : ''} ${isAgendaDeleteTarget && currentAgendaId !== agenda.id ? '!text-red-700' : ''}`}>
                        {agenda.title}
                    </span>
                    <div className={`flex gap-0.5 transition-opacity ${currentAgendaId === agenda.id ? 'text-slate-400 opacity-100' : 'text-slate-300 opacity-0 group-hover:opacity-100'}`}>
                        <button className="p-1 hover:text-white hover:bg-slate-700/50 rounded" onClick={(e) => { e.stopPropagation(); startEdit(agenda); }}><Edit2 size={10} /></button>
                        <button className="p-1 hover:text-red-400 hover:bg-red-900/20 rounded" onClick={(e) => openDeleteConfirm(e, agenda)}><Trash2 size={10} /></button>
                    </div>
                </>
            )}
        </div>
    );
}
