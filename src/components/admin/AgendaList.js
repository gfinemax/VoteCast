'use client';

import React, { useState, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { Plus, Trash2, Edit2, Check, X, FolderOpen, ChevronDown, ChevronRight, FolderPlus, FileText } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function AgendaList() {
    const { state, actions } = useStore();
    const { agendas, currentAgendaId } = state;

    const [isAddingFolder, setIsAddingFolder] = useState(false);
    const [newFolderTitle, setNewFolderTitle] = useState("");

    // Changed from boolean to ID/string to support multiple add locations
    const [addingAgendaFolderId, setAddingAgendaFolderId] = useState(null);
    const [newAgendaTitle, setNewAgendaTitle] = useState("");

    const [editingId, setEditingId] = useState(null);
    const [editTitle, setEditTitle] = useState("");
    const [expandedFolders, setExpandedFolders] = useState({});

    // Grouping Logic
    const groupedAgendas = useMemo(() => {
        const groups = [];
        let currentGroup = { folder: null, items: [] };

        agendas.forEach(agenda => {
            if (agenda.type === 'folder') {
                if (currentGroup.folder || currentGroup.items.length > 0) {
                    groups.push(currentGroup);
                }
                currentGroup = { folder: agenda, items: [] };
            } else {
                currentGroup.items.push(agenda);
            }
        });
        if (currentGroup.folder || currentGroup.items.length > 0) {
            groups.push(currentGroup);
        }
        return groups.reverse();

    }, [agendas]);

    const toggleFolder = (folderId) => {
        setExpandedFolders(prev => ({
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

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAddAgenda = async () => {
        if (!newAgendaTitle.trim() || isSubmitting) return;
        setIsSubmitting(true);

        try {
            // Determine Insertion Index
            const folderId = addingAgendaFolderId;
            const group = groupedAgendas.find(g => (g.folder ? g.folder.id : 'ghost') === folderId);

            // Default to append if no group found (shouldn't happen)
            let targetIndex = null;

            if (group) {
                // We want to insert AFTER the last item of this group.
                const lastItem = group.items.length > 0 ? group.items[group.items.length - 1] : group.folder;
                targetIndex = lastItem ? lastItem.order_index : 0;
            }

            // Pass targetIndex to addAgenda (which will insert at targetIndex + 1)
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
        setEditingId(agenda.id);
        setEditTitle(agenda.title);
    };

    const handleEdit = () => {
        if (!editTitle.trim()) return;
        actions.updateAgenda({ id: editingId, title: editTitle });
        setEditingId(null);
    };

    const handleDelete = (e, id) => {
        e.stopPropagation();
        if (confirm("삭제하시겠습니까? (폴더 삭제 시 하위 안건은 유지되지만 그룹이 해제될 수 있습니다)")) {
            actions.deleteAgenda(id);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-0.5">
            {/* Global Header Actions */}
            <div className="flex justify-between items-center mb-1.5 px-1">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">총회 및 안건 목록</div>
                <button
                    onClick={() => setIsAddingFolder(true)}
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium px-2 py-0.5 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                >
                    <FolderPlus size={14} /> 총회 추가
                </button>
            </div>

            {/* Add Folder Form */}
            {isAddingFolder && (
                <div className="mb-2 p-2 bg-blue-50/50 rounded-lg border border-blue-100 animate-in fade-in slide-in-from-top-2">
                    <div className="text-xs font-semibold text-blue-800 mb-1">새로운 총회(폴더) 만들기</div>
                    <input
                        autoFocus
                        className="w-full text-xs p-1.5 mb-1.5 border border-blue-200 rounded focus:ring-2 focus:ring-blue-100 outline-none"
                        placeholder="예: 2027년 정기총회"
                        value={newFolderTitle}
                        onChange={e => setNewFolderTitle(e.target.value)}
                        onKeyDown={e => {
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

            {/* Groups Render */}
            {groupedAgendas.map((group, index) => {
                const isGhost = !group.folder;
                const folderId = group.folder ? group.folder.id : 'ghost';
                const expanded = isFolderExpanded(folderId);

                return (
                    <div key={folderId} className="relative">
                        {!isGhost && (
                            <div
                                className="flex items-center gap-2 mb-0 px-2 py-0.5 bg-slate-50 hover:bg-slate-100 rounded-sm border border-slate-200 group cursor-pointer transition-colors select-none"
                                onClick={() => toggleFolder(folderId)}
                            >
                                {expanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                                <FolderOpen size={16} className="text-blue-500" />

                                {/* Folder Title Editing */}
                                {editingId === group.folder.id ? (
                                    <div className="flex items-center gap-1 flex-1" onClick={e => e.stopPropagation()}>
                                        <input
                                            className="flex-1 text-sm text-slate-900 p-1 rounded border border-blue-300 focus:ring-2 focus:ring-blue-100 outline-none"
                                            value={editTitle}
                                            onChange={e => setEditTitle(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') handleEdit();
                                                if (e.key === 'Escape') setEditingId(null);
                                            }}
                                            autoFocus
                                        />
                                        <button onClick={handleEdit} className="text-emerald-500"><Check size={16} /></button>
                                        <button onClick={() => setEditingId(null)} className="text-red-500"><X size={16} /></button>
                                    </div>
                                ) : (
                                    <>
                                        <span className="text-sm font-bold text-slate-700 flex-1">{group.folder.title}</span>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button className="p-1 text-slate-400 hover:text-blue-600" onClick={(e) => { e.stopPropagation(); startEdit(group.folder); }}>
                                                <Edit2 size={12} />
                                            </button>
                                            <button className="p-1 text-slate-400 hover:text-red-600" onClick={(e) => handleDelete(e, group.folder.id)}>
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Items */}
                        {(expanded || isGhost) && (
                            <div className={`${!isGhost ? 'pl-4 md:pl-6 border-l-[1.5px] border-slate-200 ml-2.5 space-y-0' : 'space-y-0'} animate-in fade-in duration-200`}>
                                {group.items.map(agenda => (
                                    <div
                                        key={agenda.id}
                                        className={`group w-full text-left p-1.5 text-sm font-medium transition-all relative flex items-center gap-2 ${currentAgendaId === agenda.id
                                            ? "bg-slate-900 text-white border border-slate-900 rounded-md z-10 shadow-md my-1 scale-[1.02]"
                                            : "bg-white text-slate-600 hover:bg-slate-50 border-b border-x border-slate-100 first:border-t rounded-none first:rounded-t-md last:rounded-b-md"
                                            }`}
                                        onClick={() => {
                                            if (editingId !== agenda.id) actions.setAgenda(agenda.id);
                                        }}
                                    >
                                        {/* Edit/View Logic for Agenda Item */}
                                        {editingId === agenda.id ? (
                                            <div className="flex items-center gap-1 w-full" onClick={e => e.stopPropagation()}>
                                                <input
                                                    className="flex-1 text-slate-900 p-1 rounded border border-blue-300 focus:ring-2 focus:ring-blue-100 outline-none text-xs"
                                                    value={editTitle}
                                                    onChange={e => setEditTitle(e.target.value)}
                                                    autoFocus
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') handleEdit();
                                                        if (e.key === 'Escape') setEditingId(null);
                                                    }}
                                                />
                                                <button onClick={handleEdit} className="text-emerald-500 hover:bg-emerald-50 p-0.5 rounded"><Check size={14} /></button>
                                                <button onClick={() => setEditingId(null)} className="text-red-500 hover:bg-red-50 p-0.5 rounded"><X size={14} /></button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${currentAgendaId === agenda.id ? 'bg-emerald-400' : 'bg-slate-300 group-hover:bg-slate-400'}`}></div>
                                                <span className="line-clamp-1 flex-1 text-xs leading-normal">{agenda.title}</span>
                                                <div className={`flex gap-0.5 transition-opacity ${currentAgendaId === agenda.id ? 'text-slate-400 opacity-100' : 'text-slate-300 opacity-0 group-hover:opacity-100'}`}>
                                                    <button className="p-1 hover:text-white hover:bg-slate-700/50 rounded" onClick={(e) => { e.stopPropagation(); startEdit(agenda); }}><Edit2 size={10} /></button>
                                                    <button className="p-1 hover:text-red-400 hover:bg-red-900/20 rounded" onClick={(e) => handleDelete(e, agenda.id)}><Trash2 size={10} /></button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}

                                <div className="pt-0.5">
                                    {addingAgendaFolderId === folderId ? (
                                        <div className="mb-1 p-2 bg-slate-50 rounded border border-slate-200 animate-in fade-in slide-in-from-top-1">
                                            <input
                                                autoFocus
                                                className="w-full text-xs p-1.5 mb-1.5 border border-slate-300 rounded focus:ring-2 focus:ring-slate-200 outline-none"
                                                placeholder="안건 제목 입력..."
                                                value={newAgendaTitle}
                                                onChange={e => setNewAgendaTitle(e.target.value)}
                                                onKeyDown={e => {
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
                                            className="w-full py-1.5 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 border border-dashed border-slate-300 rounded-md flex items-center justify-center gap-1 transition-colors group/btn"
                                            title="이 총회에 안건 추가"
                                        >
                                            <Plus size={12} className="group-hover/btn:scale-110 transition-transform" /> 안건 추가
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                        {!isGhost && !expanded && (
                            <div className="h-0" />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
