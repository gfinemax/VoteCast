'use client';

import React, { useMemo, useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react';
import { useStore } from '@/lib/store';
import { getAgendaAttendanceDisplayStats, getAgendaVoteBuckets, getAttendanceQuorumTarget, getElectionAgendaValidationStats, getMeetingAttendanceStats, normalizeAgendaType } from '@/lib/store';
import { CheckCircle2, AlertTriangle, Trash2, Lock, Unlock, RotateCcw, Save, Wand2 } from 'lucide-react';
import Card from '@/components/ui/Card';

const EMPTY_INACTIVE_MEMBER_IDS = [];

const FastNumericInput = ({ value, onChange, className, disabled, placeholder, innerRef }) => {
    const [localValue, setLocalValue] = useState(value);
    const [isFocused, setIsFocused] = useState(false);
    const displayValue = isFocused ? localValue : value;

    const handleChange = (e) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        setLocalValue(val);
        onChange(val);
    };

    return (
        <input
            ref={innerRef}
            type="text"
            inputMode="numeric"
            value={(displayValue === 0 || displayValue === '0') && !disabled ? '' : displayValue}
            placeholder={placeholder}
            onFocus={(e) => {
                setIsFocused(true);
                setLocalValue(value);
                e.target.select();
            }}
            onBlur={() => setIsFocused(false)}
            onChange={handleChange}
            disabled={disabled}
            className={className}
        />
    );
};

export default function VoteControl() {
    const { state, actions } = useStore();
    const { updateAgenda, setDeclarationEditMode, setAgendaTypeLock, updateProjectorData } = actions;
    const { members, attendance, agendas, currentAgendaId, voteData, projectorMode, projectorData, mailElectionVotes } = state;
    const [confirmReadyAgendaId, setConfirmReadyAgendaId] = useState(null);
    const [confirmModalState, setConfirmModalState] = useState({ isOpen: false, type: null }); // type: 'confirm' | 'reset'
    const inactiveMemberIds = Array.isArray(voteData?.inactiveMemberIds) ? voteData.inactiveMemberIds : EMPTY_INACTIVE_MEMBER_IDS;
    const activeMemberIdSet = useMemo(() => {
        const inactiveMemberIdSet = new Set(inactiveMemberIds);
        return new Set(
            members
                .filter(member => member.is_active !== false && !inactiveMemberIdSet.has(member.id))
                .map(member => member.id)
        );
    }, [inactiveMemberIds, members]);
    const activeMembers = useMemo(() => {
        return members.filter(member => activeMemberIdSet.has(member.id));
    }, [activeMemberIdSet, members]);

    const [localVoteDraft, setLocalVoteDraft] = useState({
        agendaId: null,
        values: { yes: 0, no: 0, abstain: 0 },
        dirty: false
    });

    // 1. Identify Context (Current Agenda & Meeting/Folder)
    const currentAgenda = agendas.find(a => a.id === currentAgendaId);

    // Find the "Meeting" (Folder) this agenda belongs to
    const meetingId = useMemo(() => {
        if (!currentAgenda) return null;
        if (currentAgenda.type === 'folder') return currentAgenda.id;

        // Find the closest preceding folder
        const currentIndex = agendas.findIndex(a => a.id === currentAgendaId);
        for (let i = currentIndex - 1; i >= 0; i--) {
            if (agendas[i].type === 'folder') return agendas[i].id;
        }
        return null; // Orphan agenda?
    }, [agendas, currentAgendaId, currentAgenda]);

    // 2. Derive Attendance Data (Real-time)
    const baseMeetingStats = useMemo(() => {
        return getMeetingAttendanceStats(attendance, meetingId, activeMemberIdSet);
    }, [activeMemberIdSet, attendance, meetingId]);

    // SNAPSHOT HANDLING
    const snapshot = currentAgenda?.vote_snapshot;
    const isConfirmed = !!snapshot;
    const liveVoteBuckets = useMemo(() => getAgendaVoteBuckets(currentAgenda, {
        mailElectionVotes,
        activeMemberIdSet
    }), [activeMemberIdSet, currentAgenda, mailElectionVotes]);
    const hasSplitVoteColumns = liveVoteBuckets.hasSplitVoteColumns;
    const fixedVoteTotals = liveVoteBuckets.fixed;
    const fixedVoteLabel = liveVoteBuckets.fixedLabel;
    const onsiteVoteTotals = hasSplitVoteColumns ? liveVoteBuckets.onsite : liveVoteBuckets.final;
    const finalVoteTotals = liveVoteBuckets.final;
    const realtimeStats = useMemo(() => getAgendaAttendanceDisplayStats({
        agenda: currentAgenda,
        meetingStats: baseMeetingStats,
        mailElectionVotes,
        activeMemberIdSet
    }), [activeMemberIdSet, baseMeetingStats, currentAgenda, mailElectionVotes]);

    // Use Snapshot if confirmed, otherwise Realtime
    const displayStats = isConfirmed
        ? { ...realtimeStats, ...(snapshot.stats || {}) }
        : realtimeStats;

    // Vote Data Sources
    const votesYes = isConfirmed ? snapshot.votes.yes : finalVoteTotals.yes;
    const votesNo = isConfirmed ? snapshot.votes.no : finalVoteTotals.no;
    const votesAbstain = isConfirmed ? snapshot.votes.abstain : finalVoteTotals.abstain;
    const declaration = isConfirmed ? snapshot.declaration : (currentAgenda?.declaration || '');
    const totalFixedVotes = fixedVoteTotals.yes + fixedVoteTotals.no + fixedVoteTotals.abstain;
    const editableVotesYes = onsiteVoteTotals.yes;
    const editableVotesNo = onsiteVoteTotals.no;
    const editableVotesAbstain = onsiteVoteTotals.abstain;
    const syncedLocalVotes = {
        yes: editableVotesYes,
        no: editableVotesNo,
        abstain: editableVotesAbstain
    };
    const isDraftForCurrentAgenda = localVoteDraft.agendaId === currentAgendaId;
    const localVotes = isDraftForCurrentAgenda ? localVoteDraft.values : syncedLocalVotes;
    const isLocalDirty = isDraftForCurrentAgenda && localVoteDraft.dirty;
    const isReadyToConfirm = confirmReadyAgendaId === currentAgendaId;

    // Vote Type Map
    const currentAgendaType = normalizeAgendaType(currentAgenda?.type);
    const isSpecialVote = currentAgendaType === 'twoThirds';
    const isElection = currentAgendaType === 'election';

    const electionValidation = getElectionAgendaValidationStats({
        agenda: currentAgenda,
        meetingId,
        attendance,
        mailElectionVotes,
        activeMemberIdSet
    });
    const effectiveTotalAttendance = isConfirmed
        ? displayStats.total
        : (isElection ? electionValidation.expectedTotalVotes : displayStats.total);
    const effectiveOnsiteEligibleCount = isConfirmed
        ? (displayStats.direct + displayStats.proxy)
        : (isElection ? electionValidation.onsiteEligibleCount : (displayStats.direct + displayStats.proxy));

    // Targets (Based on Snapshot or Realtime totalMembers)
    // Note: If total members changed (removed from DB), snapshot should logically preserve it? 
    // Usually total members is stable, but let's assume Members list is realtime reference OR snapshot if we saved it.
    // For now, using realtime totalMembers is likely acceptable unless members were deleted.
    const totalMembers = activeMembers.length;

    // Recalculate Logic based on DISPLAY stats
    const quorumTarget = getAttendanceQuorumTarget(currentAgendaType, totalMembers);

    const directTarget = Math.ceil(totalMembers * 0.2);
    const isDirectSatisfied = !isElection || (displayStats.direct >= directTarget);
    const isQuorumSatisfied = (displayStats.total >= quorumTarget) && isDirectSatisfied;

    const calculatePass = useCallback((yesCount, totalCount = effectiveTotalAttendance) => {
        if (isSpecialVote) {
            return yesCount >= Math.ceil(totalCount * (2 / 3));
        }
        return yesCount > (totalCount / 2);
    }, [effectiveTotalAttendance, isSpecialVote]);
    const isPassed = calculatePass(votesYes);

    // 3. Declaration Generation
    const generateDefaultDeclaration = useCallback((overrides = {}) => {
        if (!currentAgenda || effectiveTotalAttendance === 0) return '';

        const yesCount = overrides.yes ?? votesYes;
        const noCount = overrides.no ?? votesNo;
        const abstainCount = overrides.abstain ?? votesAbstain;
        const criterion = isSpecialVote ? "3분의 2 이상" : "과반수 이상";
        const passed = calculatePass(yesCount, effectiveTotalAttendance);
        const fixedSourceText = isElection ? '우편투표를 포함하여' : '서면결의서를 포함하여';

        const resultReason = passed ? `${criterion} 찬성으로` : '찬성 미달로';
        const resultSuffix = isElection ? (passed ? '당선' : '낙선') : (passed ? '가결' : '부결');
        // 일반: "안건명"은 ~를 포함하여 ... 찬성으로 가결 되었음을 선포합니다.
        // 선거: "안건명"은 ~를 포함하여 ... 찬성으로 후보자는 당선 되었음을 선포합니다.
        const resultLine = isElection
            ? `후보자는 ${resultSuffix} 되었음을 선포합니다.`
            : `${resultSuffix} 되었음을 선포합니다.`;
        return `"${currentAgenda.title}"은 ${fixedSourceText} 전체 참석자 ${effectiveTotalAttendance.toLocaleString()}명 중
찬성 ${yesCount}표, 반대 ${noCount}표, 기권 ${abstainCount}표인 ${resultReason}
${resultLine}`;
    }, [calculatePass, currentAgenda, effectiveTotalAttendance, isElection, isSpecialVote, votesAbstain, votesNo, votesYes]);

    // Use GLOBAL state for declaration editing (prevents revert on re-render)
    const declarationEditState = state.declarationEditState?.[currentAgendaId] || { isEditing: false, isAutoCalc: true };
    const isEditingDeclaration = declarationEditState.isEditing;
    const isAutoCalc = declarationEditState.isAutoCalc;
    const agendaTypeLocks = (voteData?.agendaTypeLocks && typeof voteData.agendaTypeLocks === 'object')
        ? voteData.agendaTypeLocks
        : {};

    // LOCAL declaration state for editing (doesn't trigger realtime sync)
    const [declarationDraft, setDeclarationDraft] = useState({ agendaId: null, value: '' });
    const localDeclaration = declarationDraft.agendaId === currentAgendaId
        ? declarationDraft.value
        : (declaration || '');
    const isTypeLocked = !!agendaTypeLocks[currentAgendaId];
    const primaryOnsiteInputRef = useRef(null);
    const votePanelContentRef = useRef(null);
    const votePanelAnimationFrameRef = useRef(null);
    const votePanelAnimationTimeoutRef = useRef(null);
    const previousVotePanelHeightRef = useRef(null);
    const votePanelLayoutVariant = hasSplitVoteColumns
        ? (isElection ? 'split-election' : 'split-standard')
        : 'simple';
    const previousVotePanelLayoutRef = useRef(votePanelLayoutVariant);
    const [animatedVotePanelHeight, setAnimatedVotePanelHeight] = useState(null);

    const setIsEditingDeclaration = (value) => {
        if (!currentAgendaId) return;
        setDeclarationEditMode(currentAgendaId, value, isAutoCalc);
    };
    const setIsAutoCalc = (value) => {
        if (!currentAgendaId) return;
        setDeclarationEditMode(currentAgendaId, isEditingDeclaration, value);
    };

    const syncProjectorDeclaration = useCallback((nextDeclaration, overrides = {}) => {
        if (projectorMode !== 'RESULT' || !currentAgenda) return;

        const totalAttendance = overrides.totalAttendance ?? effectiveTotalAttendance;
        const votesYesForProjector = overrides.yes ?? votesYes;
        const votesNoForProjector = overrides.no ?? votesNo;
        const votesAbstainForProjector = overrides.abstain ?? votesAbstain;

        const nextProjectorData = {
            ...(projectorData || {}),
            agendaId: currentAgenda.id,
            agendaTitle: currentAgenda.title,
            declaration: nextDeclaration,
            votesYes: votesYesForProjector,
            votesNo: votesNoForProjector,
            votesAbstain: votesAbstainForProjector,
            totalAttendance,
            isPassed: calculatePass(votesYesForProjector, totalAttendance)
        };
        updateProjectorData(nextProjectorData);
    }, [calculatePass, currentAgenda, effectiveTotalAttendance, projectorData, projectorMode, updateProjectorData, votesAbstain, votesNo, votesYes]);

    // Save declaration to DB (called when clicking Done)
    const saveDeclaration = useCallback(() => {
        if (currentAgenda && localDeclaration !== declaration) {
            updateAgenda({ id: currentAgenda.id, declaration: localDeclaration });
            syncProjectorDeclaration(localDeclaration);
        }
    }, [currentAgenda, declaration, localDeclaration, syncProjectorDeclaration, updateAgenda]);

    // Declaration Auto-Update (only when NOT editing)
    useEffect(() => {
        if (!currentAgenda || isEditingDeclaration || isConfirmed) return;
        if (isAutoCalc) {
            const newDecl = generateDefaultDeclaration();
            if (newDecl !== currentAgenda.declaration) {
                updateAgenda({ id: currentAgenda.id, declaration: newDecl });
                syncProjectorDeclaration(newDecl);
            }
        }
    }, [currentAgenda, generateDefaultDeclaration, isAutoCalc, isConfirmed, isEditingDeclaration, syncProjectorDeclaration, updateAgenda]);

    useEffect(() => {
        if (!hasSplitVoteColumns || isConfirmed) return undefined;

        const frameId = window.requestAnimationFrame(() => {
            primaryOnsiteInputRef.current?.focus();
        });

        return () => {
            window.cancelAnimationFrame(frameId);
        };
    }, [currentAgendaId, hasSplitVoteColumns, isConfirmed]);

    useEffect(() => {
        if (typeof ResizeObserver === 'undefined') return undefined;
        const node = votePanelContentRef.current;
        if (!node) return undefined;

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            previousVotePanelHeightRef.current = entry.contentRect.height;
        });

        observer.observe(node);
        return () => observer.disconnect();
    }, [currentAgendaId, hasSplitVoteColumns]);

    useLayoutEffect(() => {
        const node = votePanelContentRef.current;
        if (!node || typeof window === 'undefined') return undefined;

        const nextHeight = node.getBoundingClientRect().height;
        const previousHeight = previousVotePanelHeightRef.current;
        const didLayoutModeChange = previousVotePanelLayoutRef.current !== votePanelLayoutVariant;

        if (
            didLayoutModeChange
            && previousHeight !== null
            && Math.abs(previousHeight - nextHeight) > 1
        ) {
            if (votePanelAnimationFrameRef.current) {
                window.cancelAnimationFrame(votePanelAnimationFrameRef.current);
            }
            if (votePanelAnimationTimeoutRef.current) {
                window.clearTimeout(votePanelAnimationTimeoutRef.current);
            }

            setAnimatedVotePanelHeight(previousHeight);

            votePanelAnimationFrameRef.current = window.requestAnimationFrame(() => {
                votePanelAnimationFrameRef.current = window.requestAnimationFrame(() => {
                    setAnimatedVotePanelHeight(nextHeight);
                });
            });

            votePanelAnimationTimeoutRef.current = window.setTimeout(() => {
                setAnimatedVotePanelHeight(null);
                votePanelAnimationTimeoutRef.current = null;
            }, 340);
        }

        previousVotePanelHeightRef.current = nextHeight;
        previousVotePanelLayoutRef.current = votePanelLayoutVariant;

        return () => {
            if (votePanelAnimationFrameRef.current) {
                window.cancelAnimationFrame(votePanelAnimationFrameRef.current);
                votePanelAnimationFrameRef.current = null;
            }
        };
    }, [currentAgendaId, votePanelLayoutVariant]);

    useEffect(() => {
        return () => {
            if (typeof window !== 'undefined') {
                if (votePanelAnimationFrameRef.current) {
                    window.cancelAnimationFrame(votePanelAnimationFrameRef.current);
                }
                if (votePanelAnimationTimeoutRef.current) {
                    window.clearTimeout(votePanelAnimationTimeoutRef.current);
                }
            }
        };
    }, []);


    // Handlers
    const handleTypeChange = async (newType) => {
        if (!currentAgenda) return;
        if (isConfirmed) return;
        if (isTypeLocked) {
            alert('투표 유형 잠금이 켜져 있어 변경할 수 없습니다. 왼쪽 자물쇠 버튼을 눌러 잠금을 해제하세요.');
            return;
        }

        const result = await actions.updateAgenda({ id: currentAgenda.id, type: newType });
        if (result?.ok === false) {
            alert(result.error?.message || '안건 유형 변경 저장에 실패했습니다.');
        }
    };

    const toggleTypeLock = async () => {
        if (!currentAgendaId) return;
        try {
            await setAgendaTypeLock(currentAgendaId, !isTypeLocked);
        } catch (error) {
            console.error('Failed to persist agenda type lock:', error);
            alert(error.message || '잠금 상태 저장에 실패했습니다.');
        }
    };

    const handleLocalVoteChange = (fieldKey, rawValue) => {
        if (isConfirmed || !currentAgenda) return;

        const value = (rawValue === '' || rawValue === null || rawValue === undefined) ? 0 : parseInt(rawValue);
        if (isNaN(value)) return;

        let newLocal = { ...localVotes, [fieldKey]: value };

        if (isAutoCalc) {
            const currentTotal = hasSplitVoteColumns ? effectiveTotalAttendance - totalFixedVotes : effectiveTotalAttendance;
            if (fieldKey === 'yes') {
                const currentAbstain = parseInt(localVotes.abstain) || 0;
                newLocal.no = Math.max(0, currentTotal - value - currentAbstain);
            } else if (fieldKey === 'no') {
                const currentAbstain = parseInt(localVotes.abstain) || 0;
                newLocal.yes = Math.max(0, currentTotal - value - currentAbstain);
            } else if (fieldKey === 'abstain') {
                const currentYes = parseInt(localVotes.yes) || 0;
                newLocal.no = Math.max(0, currentTotal - currentYes - value);
            }
        }

        setLocalVoteDraft({
            agendaId: currentAgenda.id,
            values: newLocal,
            dirty: true
        });
        setConfirmReadyAgendaId(null);
    };

    const handleApplyLocalVotes = () => {
        if (isConfirmed || !currentAgenda) return;
        const y = parseInt(localVotes.yes) || 0;
        const n = parseInt(localVotes.no) || 0;
        const a = parseInt(localVotes.abstain) || 0;
        const appliedTotals = hasSplitVoteColumns
            ? {
                yes: fixedVoteTotals.yes + y,
                no: fixedVoteTotals.no + n,
                abstain: fixedVoteTotals.abstain + a
            }
            : { yes: y, no: n, abstain: a };

        let updates = {};
        if (hasSplitVoteColumns) {
            updates.onsite_yes = y;
            updates.onsite_no = n;
            updates.onsite_abstain = a;
        } else {
            updates.votes_yes = y;
            updates.votes_no = n;
            updates.votes_abstain = a;
        }

        if (isAutoCalc && !isEditingDeclaration) {
            updates.declaration = generateDefaultDeclaration(appliedTotals);
        }
        
        updateAgenda({ id: currentAgenda.id, ...updates });
        if (updates.declaration) {
            syncProjectorDeclaration(updates.declaration, {
                yes: appliedTotals.yes,
                no: appliedTotals.no,
                abstain: appliedTotals.abstain,
                totalAttendance: effectiveTotalAttendance
            });
        }
        setLocalVoteDraft({
            agendaId: currentAgenda.id,
            values: { yes: y, no: n, abstain: a },
            dirty: false
        });
        setConfirmReadyAgendaId(null);
    };

    const handleAutoSum = () => {
        if (isConfirmed || !currentAgenda) return;
        const currentTotal = hasSplitVoteColumns ? effectiveTotalAttendance - totalFixedVotes : effectiveTotalAttendance;
        const remainder = Math.max(0, currentTotal - (parseInt(localVotes.no) || 0) - (parseInt(localVotes.abstain) || 0));
        handleLocalVoteChange('yes', remainder);
    };

    const handleResetEditableVotes = () => {
        if (isConfirmed || !currentAgenda) return;

        const updates = hasSplitVoteColumns
            ? {
                onsite_yes: 0,
                onsite_no: 0,
                onsite_abstain: 0
            }
            : {
                votes_yes: 0,
                votes_no: 0,
                votes_abstain: 0
            };

        if (isAutoCalc && !isEditingDeclaration) {
            updates.declaration = generateDefaultDeclaration({
                yes: fixedVoteTotals.yes,
                no: fixedVoteTotals.no,
                abstain: fixedVoteTotals.abstain
            });
        }

        setLocalVoteDraft({
            agendaId: currentAgenda.id,
            values: { yes: 0, no: 0, abstain: 0 },
            dirty: false
        });
        setConfirmReadyAgendaId(null);
        updateAgenda({ id: currentAgenda.id, ...updates });
        if (updates.declaration) {
            syncProjectorDeclaration(updates.declaration, {
                yes: fixedVoteTotals.yes,
                no: fixedVoteTotals.no,
                abstain: fixedVoteTotals.abstain,
                totalAttendance: effectiveTotalAttendance
            });
        }
    };

    const handleConfirmDecision = () => {
        if (isLocalDirty) return;
        setConfirmModalState({ isOpen: true, type: 'confirm' });
    };

    const handleResetDecision = () => {
        setConfirmModalState({ isOpen: true, type: 'reset' });
    };

    const executeModalAction = () => {
        if (confirmModalState.type === 'confirm') {
            const snapshotData = {
                stats: {
                    ...displayStats,
                    total: effectiveTotalAttendance
                },
                votes: { yes: votesYes, no: votesNo, abstain: votesAbstain },
                declaration: currentAgenda.declaration, // current value
                result: isPassed ? 'PASSED' : 'FAILED',
                timestamp: new Date().toISOString()
            };
            updateAgenda({ id: currentAgenda.id, vote_snapshot: snapshotData });
            setConfirmModalState({ isOpen: false, type: null });
        } else if (confirmModalState.type === 'reset') {
            updateAgenda({ id: currentAgenda.id, vote_snapshot: null });
            setConfirmReadyAgendaId(null);
            setConfirmModalState({ isOpen: false, type: null });
        }
    };

    if (!currentAgenda) return <div className="p-10 text-center text-slate-400">안건을 선택해주세요.</div>;

    // Helper for Total Votes Cast
    const totalVotesCast = votesYes + votesNo + votesAbstain;
    const localTotalVotesCast = hasSplitVoteColumns 
        ? totalFixedVotes + (parseInt(localVotes.yes) || 0) + (parseInt(localVotes.no) || 0) + (parseInt(localVotes.abstain) || 0)
        : (parseInt(localVotes.yes) || 0) + (parseInt(localVotes.no) || 0) + (parseInt(localVotes.abstain) || 0);

    const displayTotalVotesCast = isLocalDirty ? localTotalVotesCast : totalVotesCast;
    const isVoteCountValid = displayTotalVotesCast === effectiveTotalAttendance;
    const onsiteVotesCast = hasSplitVoteColumns
        ? (parseInt(localVotes.yes) || 0) + (parseInt(localVotes.no) || 0) + (parseInt(localVotes.abstain) || 0)
        : displayTotalVotesCast;
    const isElectionMailMissing = isElection && electionValidation.missingMailVoteCount > 0;
    const hasElectionMailOverlap = isElection && electionValidation.overlapMailVoteCount > 0;
    const isOnsiteOverflow = hasSplitVoteColumns && onsiteVotesCast > effectiveOnsiteEligibleCount;
    const hasElectionValidationIssue = isElection && (
        isElectionMailMissing
        || hasElectionMailOverlap
        || isOnsiteOverflow
        || displayTotalVotesCast !== electionValidation.expectedTotalVotes
    );
    const splitVoteTargetTotal = Math.max(0, effectiveTotalAttendance - totalFixedVotes);
    const isApplyDisabled = !isVoteCountValid || isOnsiteOverflow || (isElection && hasElectionValidationIssue);
    const voteCountDelta = effectiveTotalAttendance - displayTotalVotesCast;
    const voteCountStatusText = voteCountDelta > 0
        ? `${voteCountDelta}표 부족`
        : `${Math.abs(voteCountDelta)}표 초과`;
    const canConfirmDecision = isReadyToConfirm && !isLocalDirty && !isApplyDisabled;
    const voteTypeOptions = [
        {
            value: 'majority',
            label: '일반',
            activeClass: 'border-blue-200 bg-blue-50 text-blue-700 shadow-sm',
            tooltipLines: [
                '정족수: 전체 조합원 과반수 출석',
                '의결: 출석자 과반수 찬성'
            ]
        },
        {
            value: 'election',
            label: '선거',
            activeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm',
            tooltipLines: [
                '정족수: 전체 조합원 과반수 출석(직접참석20%)',
                '의결: 출석자 과반수 찬성'
            ]
        },
        {
            value: 'twoThirds',
            label: '해산/규약',
            activeClass: 'border-violet-200 bg-violet-50 text-violet-700 shadow-sm',
            tooltipLines: [
                '정족수: 전체 조합원 3분의 2 출석',
                '의결: 출석자 3분의 2 이상 찬성'
            ]
        }
    ];

    const splitVoteDisplayCards = hasSplitVoteColumns ? [
        {
            key: 'yes',
            summaryLabel: '전체 찬성',
            inputLabel: '현장 찬성',
            totalValue: fixedVoteTotals.yes + (parseInt(localVotes.yes) || 0),
            writtenValue: fixedVoteTotals.yes,
            onsiteValue: localVotes.yes,
            tone: {
                rowTint: 'border-emerald-900/50 bg-emerald-900/10',
                labelBadge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                totalText: 'text-emerald-400',
                writtenText: 'text-emerald-600',
                inputLabel: 'text-emerald-600',
                inputBox: 'bg-slate-950 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)] border-transparent text-emerald-400 caret-emerald-400 focus:bg-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30'
            }
        },
        {
            key: 'no',
            summaryLabel: '전체 반대',
            inputLabel: '현장 반대',
            totalValue: fixedVoteTotals.no + (parseInt(localVotes.no) || 0),
            writtenValue: fixedVoteTotals.no,
            onsiteValue: localVotes.no,
            tone: {
                rowTint: 'border-rose-900/50 bg-rose-900/10',
                labelBadge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
                totalText: 'text-rose-400',
                writtenText: 'text-rose-400',
                inputLabel: 'text-rose-600',
                inputBox: 'bg-slate-950 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)] border-transparent text-rose-400 caret-rose-400 focus:bg-slate-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/30'
            }
        },
        {
            key: 'abstain',
            summaryLabel: '전체 기권/무효',
            inputLabel: '현장 기권/무효',
            totalValue: fixedVoteTotals.abstain + (parseInt(localVotes.abstain) || 0),
            writtenValue: fixedVoteTotals.abstain,
            onsiteValue: localVotes.abstain,
            tone: {
                rowTint: 'border-slate-800 bg-slate-800/40',
                labelBadge: 'bg-slate-700/50 text-slate-300 border-slate-600/50',
                totalText: 'text-slate-200',
                writtenText: 'text-slate-500',
                inputLabel: 'text-slate-500',
                inputBox: 'bg-slate-950 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)] border-transparent text-slate-300 caret-slate-400 focus:bg-slate-900 focus:border-slate-500 focus:ring-2 focus:ring-slate-500/30'
            }
        }
    ] : [];


    return (
        <div className="space-y-4 pb-20">
            {/* Header Section */}
            <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                    <h2 className="text-2xl font-bold leading-snug break-keep">
                        {currentAgenda.title}
                        <span className="inline-block align-middle ml-2 -mt-1 text-sm font-normal text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                            {isSpecialVote ? '특별결의(2/3)' : (currentAgendaType === 'election' ? '일반결의(과반/현장참석 20%)' : '일반결의(과반)')}
                        </span>
                    </h2>
                </div>

                {/* Actions removed and moved to Section 4 at the bottom */}
            </div>

            {/* Confirmed Banner */}
            {isConfirmed && (
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg flex justify-center items-center gap-2 text-blue-700 font-bold animate-in fade-in slide-in-from-top-2">
                    <Lock size={16} />
                    현재 의결 결과가 확정되었습니다. (실시간 성원 변동의 영향을 받지 않습니다)
                </div>
            )}

            {/* Section 1: Attendance */}
            <section className={isConfirmed ? "opacity-90 grayscale-[0.3]" : ""}>
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                        01. 성원(참석) 집계
                        <span className="text-xs font-normal text-slate-400 normal-case ml-2">
                            (참조: {agendas.find(a => a.id === meetingId)?.title || '미지정'})
                        </span>
                        {isConfirmed && <span className="text-xs bg-slate-200 text-slate-600 px-1.5 rounded">고정됨</span>}
                    </h3>

                    {/* Vote Type Selector - Single Line Unified Toolbar */}
                    <div className="flex items-center gap-2">
                        {isTypeLocked && !isConfirmed && (
                            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                                유형 잠금
                            </span>
                        )}
                        <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
                        <button
                            type="button"
                            onClick={toggleTypeLock}
                            disabled={isConfirmed}
                            title={isTypeLocked ? '투표 유형 잠금 해제' : '투표 유형 잠금'}
                            className={`flex h-8 w-9 items-center justify-center rounded-md transition-all ${
                                isTypeLocked
                                    ? 'bg-yellow-400 text-yellow-900 shadow-sm'
                                    : 'bg-transparent text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                            } disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                            {isTypeLocked ? <Lock size={14} /> : <Unlock size={14} />}
                        </button>

                        <div className="mx-1 h-4 w-px bg-slate-200"></div>

                        <div className="flex items-center">
                            {voteTypeOptions.map((option) => {
                                const isActive = currentAgendaType === option.value;
                                return (
                                    <div key={option.value} className="group relative">
                                        <button
                                            onClick={() => handleTypeChange(option.value)}
                                            disabled={isConfirmed || isTypeLocked}
                                            className={`rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all border ${
                                                isActive
                                                    ? option.activeClass
                                                    : 'border-transparent bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                                            } disabled:cursor-not-allowed disabled:opacity-45`}
                                        >
                                            {option.label}
                                        </button>
                                        <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-56 -translate-x-1/2 rounded-xl border border-slate-200 bg-slate-950 px-3 py-2 text-center text-[11px] font-medium leading-relaxed text-white shadow-2xl group-hover:block group-focus-within:block">
                                            {option.tooltipLines.map((line) => (
                                                <div key={line}>{line}</div>
                                            ))}
                                            <div className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 border-b border-r border-slate-200 bg-slate-950" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        </div>
                    </div>
                </div>

                <Card className="p-4 space-y-3">
                    {/* Total Members & Quorum Check */}
                    <div className="bg-slate-800 text-white p-3 rounded-lg mb-2 shadow-inner">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-bold text-slate-300">전체 조합원 수</label>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-xl font-bold">{totalMembers}</span>
                                <span className="text-sm text-slate-400">명</span>
                            </div>
                        </div>

                        <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden mb-2 relative">
                            <div className="absolute top-0 bottom-0 w-0.5 bg-white/50 z-10" style={{ left: isSpecialVote ? '66.66%' : '50%' }}></div>
                            <div
                                className={`h-full transition-all duration-500 ${isQuorumSatisfied ? 'bg-emerald-500' : 'bg-red-500'}`}
                                style={{ width: `${Math.min(100, (displayStats.total / (totalMembers || 1)) * 100)}%` }}
                            ></div>
                        </div>

                        <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-400">
                                개회 기준: {quorumTarget}명
                                {isElection && <span className="text-emerald-400 ml-1">중에 현장참석 {directTarget}명(20%)</span>}
                            </span>
                            <span className={`font-bold ${isQuorumSatisfied ? 'text-emerald-400' : 'text-red-400'}`}>
                                {isQuorumSatisfied
                                    ? '조건 충족 (개회 가능)'
                                    : `미달 ${!isDirectSatisfied ? '(직접참석 부족)' : `(${Math.max(0, quorumTarget - displayStats.total)}명 부족)`}`}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* 1. Direct */}
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded min-w-[120px]">
                            <span className="text-sm font-medium text-slate-500 mr-2">조합원</span>
                            <span className="font-mono font-bold text-slate-700 text-2xl">{displayStats.direct}</span>
                        </div>

                        <div className="text-slate-300 font-bold text-lg">+</div>

                        {/* 2. Proxy */}
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded min-w-[120px]">
                            <span className="text-sm font-medium text-slate-500 mr-2">대리인</span>
                            <span className="font-mono font-bold text-slate-700 text-2xl">{displayStats.proxy}</span>
                        </div>

                        <div className="text-slate-300 font-bold text-lg">+</div>

                        {/* 3. Written */}
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded min-w-[120px]">
                            <span className="text-sm font-medium text-slate-500 mr-2">{displayStats.fixedAttendanceLabel}</span>
                            <span className="font-mono font-bold text-slate-700 text-2xl">{displayStats.fixedAttendanceCount}</span>
                        </div>

                        <div className="text-slate-300 font-bold text-lg">=</div>

                        {/* 4. Total (Equation Result) */}
                        <div className="flex-1 flex justify-end items-baseline gap-2">
                            <span className="text-base font-bold text-slate-400">총</span>
                            <div className="text-5xl font-black text-blue-600 leading-none">
                                {displayStats.total.toLocaleString()}<span className="text-xl text-blue-400 font-bold ml-1">명</span>
                            </div>
                        </div>
                    </div>
                </Card>
            </section>

            {/* Section 2: Votes */}
            <section className={isConfirmed ? "pointer-events-none opacity-90" : ""}>
                <div className="flex justify-between items-end mb-3">
                    <h3 className="text-lg font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                        02. 투표결과 입력
                        {isConfirmed && <Lock size={14} className="text-slate-400" />}
                    </h3>
                </div>
                <Card className={`p-4 ${isConfirmed ? 'bg-slate-50' : 'bg-white'}`}>
                    <div
                        className="vote-panel-shell"
                        style={animatedVotePanelHeight !== null ? { height: `${animatedVotePanelHeight}px` } : undefined}
                    >
                        <div
                            ref={votePanelContentRef}
                            className="space-y-3"
                        >
                    {hasSplitVoteColumns ? (
                        <div className="space-y-3">
                            {/* Summary Dashboard Component */}
                            <div className="flex flex-col md:flex-row gap-3 items-center justify-between rounded-xl border border-blue-100/70 bg-blue-50/30 py-2 px-4 shadow-sm">
                                <div className="flex items-center gap-6 divide-x divide-slate-200/60 w-full md:w-auto">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-slate-500 mb-0.5 tracking-wide">총 투표수</span>
                                        <span className="text-2xl font-black text-blue-700">{displayTotalVotesCast}<span className="text-sm font-semibold text-blue-500 ml-1">표</span></span>
                                    </div>
                                    <div className="flex flex-col pl-6">
                                        <span className="text-xs font-bold text-slate-500 mb-0.5 tracking-wide">성원(참석자)</span>
                                        <span className="text-2xl font-black text-slate-700">{effectiveTotalAttendance}<span className="text-sm font-medium text-slate-500 ml-1">명</span></span>
                                    </div>
                                    <div className="flex flex-col pl-6 hidden sm:flex">
                                        <span className="text-xs font-bold text-slate-500 mb-0.5 tracking-wide">투표 구성</span>
                                        <div className="text-base font-medium text-slate-600 mt-0.5">
                                            {fixedVoteLabel} <span className="font-bold text-slate-800">{totalFixedVotes}</span>
                                            <span className="text-slate-300 mx-2">+</span>
                                            현장 <span className="font-bold text-slate-800">{(parseInt(localVotes.yes) || 0) + (parseInt(localVotes.no) || 0) + (parseInt(localVotes.abstain) || 0)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl border w-full md:w-auto md:min-w-[120px] transition-colors shadow-sm ${
                                    isVoteCountValid 
                                        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-700' 
                                        : 'bg-red-50 border-red-200 text-red-600 animate-pulse'
                                }`}>
                                    {isVoteCountValid ? (
                                        <>
                                            <CheckCircle2 size={20} className="mb-0.5 text-emerald-500" />
                                            <span className="text-sm font-bold tracking-tight">결과 일치 (검증됨)</span>
                                        </>
                                    ) : (
                                        <>
                                            <AlertTriangle size={20} className="mb-0.5" />
                                            <span className="text-sm font-bold tracking-tight">{voteCountStatusText}</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className={`rounded-2xl border px-4 py-3 transition-colors duration-300 min-h-[188px] ${
                                isElection
                                    ? (hasElectionValidationIssue ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50')
                                    : 'border-slate-200 bg-slate-50'
                            }`}>
                                <div className={`text-sm font-bold ${
                                    isElection
                                        ? (hasElectionValidationIssue ? 'text-amber-800' : 'text-emerald-700')
                                        : 'text-slate-700'
                                }`}>
                                    {isElection ? '선거 안건 검증' : (isSpecialVote ? '해산/규약 안건 안내' : '일반 안건 안내')}
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                                    {isElection ? (
                                        <>
                                            <span className="rounded-full bg-white/80 px-3 py-1 text-slate-700 border border-slate-200">
                                                우편투표 예상 {electionValidation.expectedMailVoteCount}명
                                            </span>
                                            <span className="rounded-full bg-white/80 px-3 py-1 text-slate-700 border border-slate-200">
                                                우편투표 입력 {electionValidation.actualMailVoteCount}명
                                            </span>
                                            <span className="rounded-full bg-white/80 px-3 py-1 text-slate-700 border border-slate-200">
                                                현장 입력 가능 {electionValidation.onsiteEligibleCount}명
                                            </span>
                                            <span className="rounded-full bg-white/80 px-3 py-1 text-slate-700 border border-slate-200">
                                                선거 기준 총표 {electionValidation.expectedTotalVotes}표
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="rounded-full bg-white/90 px-3 py-1 text-slate-700 border border-slate-200">
                                                {fixedVoteLabel}(고정) {totalFixedVotes}표
                                            </span>
                                            <span className="rounded-full bg-white/90 px-3 py-1 text-slate-700 border border-slate-200">
                                                현장 입력 목표 {splitVoteTargetTotal}표
                                            </span>
                                            <span className="rounded-full bg-white/90 px-3 py-1 text-slate-700 border border-slate-200">
                                                참석 기준 총표 {effectiveTotalAttendance}표
                                            </span>
                                            <span className="rounded-full bg-white/90 px-3 py-1 text-slate-700 border border-slate-200">
                                                의결 기준 {isSpecialVote ? '출석자 3분의 2 이상' : '출석자 과반수'}
                                            </span>
                                        </>
                                    )}
                                </div>
                                <div className="mt-3 space-y-2 text-sm">
                                    {isElection ? (
                                        <>
                                            {isElectionMailMissing && (
                                                <div className="flex items-start gap-2 text-amber-800">
                                                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                                                    <span>우편투표 접수 예정 인원 중 이 안건에 미입력된 인원이 {electionValidation.missingMailVoteCount}명 있습니다.</span>
                                                </div>
                                            )}
                                            {hasElectionMailOverlap && (
                                                <div className="flex items-start gap-2 text-amber-800">
                                                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                                                    <span>현장 참석자와 우편투표 입력이 중복된 인원이 {electionValidation.overlapMailVoteCount}명 있습니다. 현장 입력 가능 인원이 자동으로 줄어듭니다.</span>
                                                </div>
                                            )}
                                            {isOnsiteOverflow && (
                                                <div className="flex items-start gap-2 text-amber-800">
                                                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                                                    <span>현장 입력 합계가 {onsiteVotesCast}표로, 입력 가능 인원 {effectiveOnsiteEligibleCount}명을 초과했습니다.</span>
                                                </div>
                                            )}
                                            {displayTotalVotesCast !== electionValidation.expectedTotalVotes && (
                                                <div className="flex items-start gap-2 text-amber-800">
                                                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                                                    <span>선거 기준 총 투표수는 {electionValidation.expectedTotalVotes}표여야 하나 현재 {displayTotalVotesCast}표입니다.</span>
                                                </div>
                                            )}
                                            {!hasElectionValidationIssue && (
                                                <div className="flex items-start gap-2 text-emerald-700">
                                                    <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                                                    <span>우편투표와 현장 입력 구성이 선거 기준과 일치합니다.</span>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex items-start gap-2 text-slate-600">
                                                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-slate-400" />
                                                <span>{fixedVoteLabel} 고정표와 현장 입력표를 합쳐 현재 참석 인원 기준으로 집계합니다.</span>
                                            </div>
                                            <div className="flex items-start gap-2 text-slate-600">
                                                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-slate-400" />
                                                <span>{isSpecialVote ? '해산/규약 안건은 출석자 3분의 2 이상 찬성이 필요합니다.' : '일반 안건은 출석자 과반수 찬성이 필요합니다.'}</span>
                                            </div>
                                            <div className={`flex items-start gap-2 ${isVoteCountValid ? 'text-emerald-700' : 'text-amber-700'}`}>
                                                {isVoteCountValid ? (
                                                    <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                                                ) : (
                                                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                                                )}
                                                <span>{isVoteCountValid ? '현재 총 투표수와 참석자 수가 일치합니다.' : `현재 총 투표수는 참석자 수 기준보다 ${voteCountStatusText} 상태입니다.`}</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 shadow-[0_12px_40px_-15px_rgba(0,0,0,0.5)]">
                                <div className="mb-2 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between border-b border-slate-800 pb-2">
                                    <div className="flex items-center gap-3 ml-2">
                                        <div className="text-lg font-black text-white">현장 투표 입력</div>
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700">
                                            <span className="text-xs font-bold text-slate-400">현장투표인원</span>
                                            <span className="text-sm font-black text-blue-400 tabular-nums">{effectiveOnsiteEligibleCount}명</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {isLocalDirty && (
                                            <button
                                                onClick={handleApplyLocalVotes}
                                                disabled={isApplyDisabled}
                                                className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg text-white shadow-md transition-all mr-2 ${
                                                    isApplyDisabled 
                                                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50' 
                                                        : 'bg-blue-600 hover:bg-blue-700 animate-pulse'
                                                }`}
                                            >
                                                <Save size={14} /> 입력 완료 (선포문구 반영)
                                            </button>
                                        )}
                                        {!isConfirmed && (
                                            <button
                                                onClick={() => setIsAutoCalc(!isAutoCalc)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                                    isAutoCalc 
                                                        ? 'bg-blue-600 text-white shadow-md' 
                                                        : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-white'
                                                }`}
                                            >
                                                <CheckCircle2 size={14} className={isAutoCalc ? 'opacity-100' : 'opacity-0 hidden'} />
                                                자동계산 {isAutoCalc ? 'ON' : 'OFF'}
                                            </button>
                                        )}
                                        <button
                                            onClick={handleResetEditableVotes}
                                            disabled={isConfirmed}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg text-slate-400 hover:bg-rose-950 hover:text-rose-400 transition-colors disabled:opacity-50"
                                        >
                                            <Trash2 size={14} /> 초기화
                                        </button>
                                    </div>
                                </div>

                                <div className="hidden grid-cols-[88px_minmax(76px,0.7fr)_auto_minmax(180px,1.7fr)_auto_minmax(124px,0.9fr)] gap-4 px-4 pb-3 text-xs font-bold uppercase tracking-wide text-slate-500 lg:grid items-center">
                                    <div className="text-center text-slate-400">구분</div>
                                    <div className="text-center text-slate-500">{fixedVoteLabel}(고정)</div>
                                    <div className="w-4"></div>
                                    <div className="text-center text-blue-400">현장 입력</div>
                                    <div className="w-4"></div>
                                    <div className="text-center">총 합계</div>
                                </div>

                                <div className="space-y-2">
                                    {splitVoteDisplayCards.map((card) => (
                                        <div
                                            key={`${card.key}-row`}
                                            className={`grid grid-cols-1 lg:grid-cols-[88px_minmax(76px,0.7fr)_auto_minmax(180px,1.7fr)_auto_minmax(124px,0.9fr)] gap-4 lg:gap-4 items-center rounded-2xl border px-4 py-2.5 transition-colors ${card.tone.rowTint} hover:shadow-md`}
                                        >
                                            <div className="flex items-center justify-between lg:flex lg:justify-center">
                                                <span className={`inline-flex h-12 w-[88px] items-center justify-center rounded-lg border px-2 text-sm font-bold shadow-sm ${card.tone.labelBadge}`}>
                                                    {card.summaryLabel.replace('전체 ', '')}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between rounded-xl bg-slate-800/30 px-4 py-3 lg:bg-transparent lg:px-0 lg:py-0 lg:justify-center">
                                                <span className="text-xs font-bold text-slate-500 lg:hidden">{fixedVoteLabel}(고정)</span>
                                                <span className={`font-mono text-2xl md:text-[2rem] font-black tabular-nums ${card.tone.writtenText}`}>{card.writtenValue}</span>
                                            </div>

                                            <div className="hidden lg:flex justify-center text-slate-700 text-2xl font-black">+</div>

                                            <div className="relative lg:flex lg:justify-center">
                                                <div className={`mb-1 text-xs font-bold lg:hidden ${card.tone.inputLabel}`}>현장 입력</div>
                                                <FastNumericInput
                                                    innerRef={card.key === 'yes' ? primaryOnsiteInputRef : null}
                                                    value={card.onsiteValue}
                                                    placeholder="0"
                                                    onChange={(val) => {
                                                        handleLocalVoteChange(card.key, val);
                                                    }}
                                                    disabled={isConfirmed}
                                                    className={`w-full lg:w-[66%] lg:mx-auto rounded-xl border px-3 py-2 text-center text-2xl md:text-3xl font-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] outline-none disabled:bg-slate-50 disabled:text-slate-400 transition-all ${card.tone.inputBox}`}
                                                />
                                            </div>

                                            <div className="hidden lg:flex justify-center text-slate-700 text-2xl font-black">=</div>

                                            <div className="flex items-center justify-between rounded-xl bg-slate-800/30 px-4 py-3 lg:bg-transparent lg:px-0 lg:py-0 lg:justify-center">
                                                <span className="text-xs font-bold text-slate-500 lg:hidden">총 합계</span>
                                                <div className="flex items-end gap-1">
                                                    <span className={`font-mono text-2xl md:text-3xl font-black tabular-nums leading-none ${card.tone.totalText}`}>{card.totalValue}</span>
                                                    <span className="text-sm font-bold text-slate-400 mb-1 md:mb-0.5">표</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        // Normal mode (non split columns)
                        <div className="space-y-3">
                            <div className="flex flex-col md:flex-row gap-4 items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex items-center gap-6 divide-x divide-slate-200">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-semibold text-slate-400 mb-1">총 투표수</span>
                                        <span className="text-2xl font-black text-blue-700">{displayTotalVotesCast}<span className="text-sm font-normal ml-1">표</span></span>
                                    </div>
                                    <div className="flex flex-col pl-6">
                                        <span className="text-xs font-semibold text-slate-400 mb-1">성원(참석자)</span>
                                        <span className="text-xl font-bold text-slate-700">{effectiveTotalAttendance}<span className="text-sm font-normal ml-1">명</span></span>
                                    </div>
                                </div>
                                <div className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 w-full md:w-auto md:min-w-[140px] transition-colors ${
                                    isVoteCountValid 
                                        ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                                        : 'bg-red-50 border-red-100 text-red-600 animate-pulse'
                                }`}>
                                    {isVoteCountValid ? (
                                        <>
                                            <CheckCircle2 size={24} className="mb-1 text-emerald-500" />
                                            <span className="text-sm font-bold">결과 일치 (검증됨)</span>
                                        </>
                                    ) : (
                                        <>
                                            <AlertTriangle size={24} className="mb-1" />
                                            <span className="text-sm font-bold">{voteCountStatusText}</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="mb-3 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-100 pb-3">
                                    <div className="text-lg font-black text-slate-800">투표 결과 직접 입력</div>
                                    <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                                        {isLocalDirty && (
                                            <button
                                                onClick={handleApplyLocalVotes}
                                                disabled={isApplyDisabled}
                                                className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg text-white shadow-md transition-all ${
                                                    isApplyDisabled 
                                                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                                                        : 'bg-blue-600 hover:bg-blue-700 animate-pulse'
                                                }`}
                                            >
                                                <Save size={14} /> 입력 완료 (선포문구 반영)
                                            </button>
                                        )}
                                        {!isConfirmed && (
                                            <button
                                                onClick={() => setIsAutoCalc(!isAutoCalc)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                                    isAutoCalc 
                                                        ? 'bg-blue-600 text-white shadow-md' 
                                                        : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'
                                                }`}
                                            >
                                                <CheckCircle2 size={14} className={isAutoCalc ? 'opacity-100' : 'opacity-0 hidden'} />
                                                자동계산 {isAutoCalc ? 'ON' : 'OFF'}
                                            </button>
                                        )}
                                        <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></div>
                                        <button
                                            onClick={handleResetEditableVotes}
                                            disabled={isConfirmed}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                                        >
                                            <Trash2 size={14} /> 초기화
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="flex flex-col gap-2 relative bg-emerald-50/50 p-4 border border-emerald-100 rounded-2xl transition-colors hover:bg-emerald-50">
                                        <label className="text-base font-bold text-emerald-800 flex justify-between items-center w-full">
                                            <span>찬성</span>
                                            {!isConfirmed && (
                                                <button
                                                    onClick={handleAutoSum}
                                                    title="참석자 수에 맞춰 잔여 표 자동 입력"
                                                    className="flex items-center gap-1 bg-white border border-emerald-200 px-2 py-1 hover:bg-emerald-100 rounded-lg text-emerald-700 transition-colors text-xs shadow-sm"
                                                >
                                                    <Wand2 size={12} /> 잔여표 채우기
                                                </button>
                                            )}
                                        </label>
                                        <FastNumericInput
                                            value={localVotes.yes}
                                            placeholder="0"
                                            onChange={(val) => handleLocalVoteChange('yes', val)}
                                            disabled={isConfirmed}
                                            className="w-full p-4 border-2 border-emerald-200 rounded-xl text-center text-4xl font-black text-emerald-800 bg-white shadow-inner outline-none caret-emerald-700 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-100 disabled:text-slate-500 transition-all"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2 bg-red-50/50 p-4 border border-red-100 rounded-2xl transition-colors hover:bg-red-50">
                                        <label className="text-base font-bold text-red-800">반대</label>
                                        <FastNumericInput
                                            value={localVotes.no}
                                            placeholder="0"
                                            onChange={(val) => handleLocalVoteChange('no', val)}
                                            disabled={isConfirmed}
                                            className="w-full p-4 border-2 border-red-200 rounded-xl text-center text-4xl font-black text-red-800 bg-white shadow-inner outline-none caret-red-700 focus:border-red-500 focus:ring-4 focus:ring-red-100 disabled:bg-slate-100 disabled:text-slate-500 transition-all"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2 bg-slate-50/50 p-4 border border-slate-200 rounded-2xl transition-colors hover:bg-slate-50">
                                        <label className="text-base font-bold text-slate-600">기권/무효</label>
                                        <FastNumericInput
                                            value={localVotes.abstain}
                                            placeholder="0"
                                            onChange={(val) => handleLocalVoteChange('abstain', val)}
                                            disabled={isConfirmed}
                                            className="w-full p-4 border-2 border-slate-200 rounded-xl text-center text-4xl font-black text-slate-600 bg-white shadow-inner outline-none caret-slate-600 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 disabled:bg-slate-100 disabled:text-slate-400 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                        </div>
                    </div>
                </Card>
            </section>

            {/* Section 3: Declaration */}
            <section>
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-bold text-slate-600 uppercase tracking-wider">
                        03. 선포 문구
                    </h3>
                    {isEditingDeclaration && !isConfirmed ? (
                        <button
                            onClick={() => {
                                saveDeclaration(); // Save to DB first
                                setIsEditingDeclaration(false);
                            }}
                            className="text-xs flex items-center gap-1 px-3 py-1 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 transition-colors font-medium"
                        >
                            ✓ 완료
                        </button>
                    ) : (
                        <button
                            onClick={() => {
                                if (isConfirmed) return;
                                const initialDeclaration = declaration || generateDefaultDeclaration();
                                setDeclarationDraft({ agendaId: currentAgendaId, value: initialDeclaration });
                                setDeclarationEditMode(currentAgendaId, true, false);
                            }}
                            disabled={isConfirmed}
                            className={`text-xs flex items-center gap-1 px-3 py-1 rounded-full transition-colors font-medium ${isConfirmed ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                            ✎ 편집
                        </button>
                    )}
                </div>

                <Card className="p-4">
                    <textarea
                        value={isEditingDeclaration ? localDeclaration : (declaration || '')}
                        onChange={(e) => setDeclarationDraft({ agendaId: currentAgendaId, value: e.target.value })}
                        disabled={!isEditingDeclaration || isConfirmed}
                        placeholder={isEditingDeclaration ? "선포문구를 입력하세요..." : "편집 버튼을 클릭하면 자동 생성됩니다."}
                        rows={Math.max(4, ((isEditingDeclaration ? localDeclaration : declaration) || '').split('\n').length + 1)}
                        className={`w-full p-3 border rounded-lg outline-none text-xl font-serif resize-none min-h-[120px] shadow-inner leading-relaxed transition-colors ${isEditingDeclaration && !isConfirmed
                            ? 'border-blue-300 bg-white text-slate-700 focus:ring-2 focus:ring-blue-500'
                            : 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed'
                            }`}
                    />
                    {isConfirmed && (
                        <div className="mt-2 text-xs text-slate-400 text-right">
                            * 이 선포문은 의결 확정 시점에 고정되었습니다.
                        </div>
                    )}
                </Card>
            </section>
            
            {/* Section 4: Final Confirmation */}
            <section className="mt-8 pt-8 border-t-2 border-slate-100">
                <div className="flex flex-col items-center justify-center p-8 bg-slate-50 border border-slate-200 rounded-3xl shadow-sm">
                    <h3 className="text-xl font-bold text-slate-800 mb-2">
                        04. 최종 결과 확정
                    </h3>
                    <p className="text-slate-500 mb-6 text-center">
                        모든 출석율과 투표 인원이 오류 없이 정상적으로 표기되었는지 확인해 주세요.
                    </p>

                    {isConfirmed ? (
                        <div className="flex flex-col items-center gap-4">
                            <div className="flex items-center gap-2 text-blue-700 font-bold bg-blue-50/50 border border-blue-100 px-6 py-3 rounded-xl shadow-sm">
                                <CheckCircle2 size={24} />
                                현재 안건의 의결 결과가 안전하게 확정되어 잠겼습니다.
                            </div>
                            <button
                                onClick={() => {
                                    handleResetDecision();
                                    setConfirmReadyAgendaId(null);
                                }}
                                className="mt-2 flex items-center gap-2 text-slate-500 bg-white border border-slate-200 px-5 py-2.5 rounded-xl hover:bg-slate-100 transition-all font-semibold"
                            >
                                <Unlock size={18} />
                                확정 취소 및 수정하기
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-3 w-full max-w-sm">
                            <label className="flex items-center justify-center gap-3 w-full p-4 border border-slate-200 rounded-xl bg-white cursor-pointer hover:bg-slate-50 select-none shadow-sm transition-all focus-within:ring-2 focus-within:ring-slate-200">
                                <input 
                                    type="checkbox" 
                                    className="w-5 h-5 accent-blue-600 cursor-pointer rounded" 
                                    checked={isReadyToConfirm}
                                    disabled={isLocalDirty}
                                    onChange={(e) => setConfirmReadyAgendaId(e.target.checked ? currentAgendaId : null)}
                                />
                                <span className="font-semibold text-slate-700">모든 결과를 확인하였으며, 확정합니다.</span>
                            </label>
                            {isLocalDirty && (
                                <div className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-700">
                                    현장 투표 입력이 아직 반영되지 않았습니다. `입력 완료`를 눌러 선포문구와 DB에 반영한 뒤 확정하세요.
                                </div>
                            )}
                            {!isLocalDirty && !isVoteCountValid && (
                                <div className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-700">
                                    총 투표수와 성원(참석자) 수가 일치해야 확정할 수 있습니다.
                                </div>
                            )}
                            {!isLocalDirty && hasElectionValidationIssue && (
                                <div className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-700">
                                    선거 안건 검증 경고를 모두 해소해야 확정할 수 있습니다.
                                </div>
                            )}
                            <button
                                onClick={() => {
                                    handleConfirmDecision();
                                }}
                                disabled={!canConfirmDecision}
                                className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl transition-all font-bold text-xl ${
                                    canConfirmDecision
                                    ? 'bg-blue-600 border border-blue-700 text-white hover:bg-blue-700 hover:shadow-lg shadow-md' 
                                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none opacity-80'
                                }`}
                            >
                                <Lock size={22} className={canConfirmDecision ? 'text-white/90' : 'opacity-50'} />
                                안건 결과 최종 확정
                            </button>
                        </div>
                    )}
                </div>
            </section>

            {/* Custom Confirm Modal */}
            {confirmModalState.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 text-slate-800 mb-4">
                            {confirmModalState.type === 'confirm' ? (
                                <div className="p-2 bg-blue-100 text-blue-600 rounded-full">
                                    <Lock size={20} />
                                </div>
                            ) : (
                                <div className="p-2 bg-slate-100 text-slate-500 rounded-full">
                                    <Unlock size={20} />
                                </div>
                            )}
                            <h3 className="text-xl font-bold">
                                {confirmModalState.type === 'confirm' ? '의결 확정 확인' : '확정 취소 확인'}
                            </h3>
                        </div>
                        <div className="text-slate-600 leading-relaxed mb-8 whitespace-pre-line text-[15px]">
                            {confirmModalState.type === 'confirm' 
                                ? "현재 기록 상태로 안건 의결 결과를 확정하시겠습니까?\n\n이후 실시간 성원이 변동되어도 결과는 영구 고정됩니다."
                                : "이미 확정된 안건 결과를 취소하시겠습니까?\n\n안건이 다시 실시간 성원 데이터에 연동되어 변동될 수 있습니다."}
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setConfirmModalState({ isOpen: false, type: null })}
                                className="px-5 py-2.5 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold transition-colors disabled:opacity-50"
                            >
                                되돌아기기
                            </button>
                            <button
                                onClick={executeModalAction}
                                className={`px-5 py-2.5 rounded-xl text-white font-semibold shadow-sm transition-all focus:ring-4 ${
                                    confirmModalState.type === 'confirm' 
                                    ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-100' 
                                    : 'bg-slate-700 hover:bg-slate-800 focus:ring-slate-200'
                                }`}
                            >
                                {confirmModalState.type === 'confirm' ? '네, 확정합니다' : '네, 취소합니다'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
