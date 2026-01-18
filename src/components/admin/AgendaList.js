'use client';

import React, { useState, useMemo } from 'react'; // line 3
import { supabase } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import { Plus, Trash2, Edit2, Check, X, FolderOpen, ChevronDown, ChevronRight, FolderPlus, CheckCircle2, Play, Link2, FileText, Upload, Loader2 } from 'lucide-react';
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

    // Presentation Edit State
    const [editPresentationType, setEditPresentationType] = useState('URL'); // 'URL' or 'FILE'
    const [editPresentationSource, setEditPresentationSource] = useState("");
    const [editStartPage, setEditStartPage] = useState(""); // For Master PPT Mode
    const [isUploading, setIsUploading] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

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

        // Reset advanced toggle
        setShowAdvanced(!!agenda.presentation_source);

        setEditingId(agenda.id);
        setEditTitle(agenda.title);
        setEditPresentationType(agenda.presentation_type || 'URL');
        setEditPresentationSource(agenda.presentation_source || "");
        setEditStartPage(agenda.start_page || "");
    };

    // Helper to extract display name from URL
    const getDisplayFileName = (url) => {
        if (!url) return '';
        try {
            // Priority 1: Check for filename in query parameter (new style)
            const urlObj = new URL(url);
            const queryName = urlObj.searchParams.get('filename');
            if (queryName) return queryName;

            // Priority 2: Extract from path (old style)
            const decoded = decodeURIComponent(url);
            const filename = decoded.split('/').pop().split('?')[0];
            const parts = filename.split('_');
            if (parts.length > 1 && /^\d+$/.test(parts[0])) {
                return parts.slice(1).join('_');
            }
            return filename;
        } catch (e) {
            // Fallback for relative URLs or malformed strings
            const filename = url.split('/').pop().split('?')[0];
            return filename || '파일';
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            // Use a safe ASCII-only filename for the storage key to avoid "Invalid key" errors
            const sanitizedName = file.name.replace(/[^a-zA-Z0-9.\-_ㄱ-ㅎㅏ-ㅣ가-힣]/g, '');
            const safeFileName = `${Date.now()}_${Math.random().toString(36).substr(2, 5)}.pdf`;
            const filePath = safeFileName;

            const { data, error } = await supabase.storage
                .from('agenda-materials')
                .upload(filePath, file, {
                    contentType: 'application/pdf',
                    upsert: true
                });

            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage
                .from('agenda-materials')
                .getPublicUrl(filePath);

            // Store the original filename in a query parameter so we can display it later
            const finalUrl = `${publicUrl}?filename=${encodeURIComponent(sanitizedName)}`;
            setEditPresentationSource(finalUrl);
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
                                className={`group flex items-center gap-2 mb-0 px-2 py-0.5 rounded-sm border cursor-pointer transition-colors select-none ${state.activeMeetingId === group.folder.id ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                                    }`}
                                onClick={() => toggleFolder(folderId)}
                            >
                                {expanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                                <FolderOpen size={16} className={state.activeMeetingId === group.folder.id ? "text-emerald-500" : "text-blue-500"} />

                                {/* Folder Title & Master PPT Editing */}
                                {editingId === group.folder.id ? (
                                    <div className="flex-1 bg-white border border-blue-200 rounded p-2 shadow-md my-1 z-20 cursor-default" onClick={e => e.stopPropagation()}>
                                        <div className="mb-2">
                                            <label className="block text-[10px] font-bold text-slate-500 mb-1">총회(폴더) 명칭</label>
                                            <input
                                                className="w-full text-sm p-1.5 rounded border border-slate-300 focus:border-blue-500 outline-none font-bold text-slate-800"
                                                value={editTitle}
                                                onChange={e => setEditTitle(e.target.value)}
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
                                                    onChange={e => setEditPresentationSource(e.target.value)}
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
                                        <div className="flex-1 flex flex-col">
                                            <span className="text-sm font-bold text-slate-700">{group.folder.title}</span>
                                            {state.activeMeetingId === group.folder.id ? (
                                                <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1 mt-0.5">
                                                    <span className="relative flex h-2 w-2">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
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
                                                    className="w-fit text-[10px] text-slate-400 hover:text-blue-600 hover:underline flex items-center gap-0.5 mt-0.5"
                                                >
                                                    <Play size={8} /> 입장 시작
                                                </button>
                                            )}
                                        </div>
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
                                            <div className="w-full bg-slate-50 border border-blue-200 rounded p-3 space-y-3 shadow-md my-1 z-20 cursor-default" onClick={e => e.stopPropagation()}>
                                                {/* Title */}
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">안건 제목</label>
                                                    <input
                                                        className="w-full text-sm p-1.5 rounded border border-slate-300 focus:border-blue-500 outline-none"
                                                        value={editTitle}
                                                        onChange={e => setEditTitle(e.target.value)}
                                                        autoFocus
                                                        placeholder="안건 제목"
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') handleEdit();
                                                            if (e.key === 'Escape') setEditingId(null);
                                                        }}
                                                    />
                                                </div>

                                                {/* Page Number (Master Mode) */}
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">시작 페이지 (번호)</label>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-slate-400">P.</span>
                                                        <input
                                                            type="number"
                                                            className="w-16 text-lg p-1 rounded-lg border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-center font-mono font-bold text-slate-900 bg-white"
                                                            value={editStartPage}
                                                            onChange={e => setEditStartPage(e.target.value)}
                                                            placeholder="0"
                                                            autoComplete="off"
                                                        />
                                                        <span className="text-[10px] text-slate-400 font-medium">페이지 이동 설정</span>
                                                    </div>
                                                </div>

                                                {/* Parent Material Indicator */}
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

                                                {/* Individual Presentation Toggle */}
                                                <div className="border-t border-slate-200 pt-2">
                                                    <button
                                                        className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-800 font-medium  mb-2"
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
                                                                    onChange={e => setEditPresentationSource(e.target.value)}
                                                                />
                                                            ) : (<>
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
                                                            </>)}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Actions */}
                                                <div className="flex justify-end gap-2 pt-1 border-t border-slate-100 mt-2">
                                                    <Button variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>취소</Button>
                                                    <Button variant="primary" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 shadow-sm" onClick={handleEdit}>
                                                        저장
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                {agenda.declaration ? (
                                                    <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                                                ) : (
                                                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${currentAgendaId === agenda.id ? 'bg-emerald-400' : 'bg-slate-300 group-hover:bg-slate-400'}`}></div>
                                                )}
                                                <span className={`line-clamp-1 flex-1 text-xs leading-normal ${agenda.declaration ? 'text-slate-400 line-through decoration-slate-300' : ''} ${currentAgendaId === agenda.id ? '!text-white !no-underline' : ''}`}>
                                                    {agenda.title}
                                                </span>
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
