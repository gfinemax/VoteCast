'use client';

import { useEffect, useState } from 'react';
import { buildDefaultDeclaration, calculateAgendaPass } from '@/lib/store';

export default function useVoteDeclarationSync({
    currentAgenda,
    currentAgendaId,
    declaration,
    declarationEditStateByAgenda,
    effectiveTotalAttendance,
    isElection,
    isSpecialVote,
    isConfirmed,
    votesYes,
    votesNo,
    votesAbstain,
    projectorMode,
    projectorData,
    updateAgenda,
    updateProjectorData,
    setDeclarationEditMode
}) {
    const declarationEditState = declarationEditStateByAgenda?.[currentAgendaId] || { isEditing: false, isAutoCalc: true };
    const isEditingDeclaration = declarationEditState.isEditing;
    const isAutoCalc = declarationEditState.isAutoCalc;
    const [declarationDraft, setDeclarationDraft] = useState({ agendaId: null, value: '' });
    const localDeclaration = declarationDraft.agendaId === currentAgendaId
        ? declarationDraft.value
        : (declaration || '');

    const generateDefaultDeclaration = (overrides = {}) => buildDefaultDeclaration({
        agenda: currentAgenda,
        effectiveTotalAttendance,
        isElection,
        isSpecialVote,
        votesYes,
        votesNo,
        votesAbstain,
        overrides
    });

    const syncProjectorDeclaration = (nextDeclaration, overrides = {}) => {
        if (projectorMode !== 'RESULT' || !currentAgenda) return;

        const totalAttendance = overrides.totalAttendance ?? effectiveTotalAttendance;
        const votesYesForProjector = overrides.yes ?? votesYes;
        const votesNoForProjector = overrides.no ?? votesNo;
        const votesAbstainForProjector = overrides.abstain ?? votesAbstain;

        updateProjectorData({
            ...(projectorData || {}),
            agendaId: currentAgenda.id,
            agendaTitle: currentAgenda.title,
            declaration: nextDeclaration,
            votesYes: votesYesForProjector,
            votesNo: votesNoForProjector,
            votesAbstain: votesAbstainForProjector,
            totalAttendance,
            isPassed: calculateAgendaPass(votesYesForProjector, totalAttendance, isSpecialVote)
        });
    };

    const setIsEditingDeclaration = (value) => {
        if (!currentAgendaId) return;
        setDeclarationEditMode(currentAgendaId, value, isAutoCalc);
    };

    const setIsAutoCalc = (value) => {
        if (!currentAgendaId) return;
        setDeclarationEditMode(currentAgendaId, isEditingDeclaration, value);
    };

    const saveDeclaration = () => {
        if (currentAgenda && localDeclaration !== declaration) {
            updateAgenda({ id: currentAgenda.id, declaration: localDeclaration });
            syncProjectorDeclaration(localDeclaration);
        }
    };

    const handleStartDeclarationEdit = () => {
        if (isConfirmed) return;

        const initialDeclaration = declaration || generateDefaultDeclaration();
        setDeclarationDraft({ agendaId: currentAgendaId, value: initialDeclaration });
        setDeclarationEditMode(currentAgendaId, true, false);
    };

    const handleDeclarationDraftChange = (value) => {
        setDeclarationDraft({ agendaId: currentAgendaId, value });
    };

    const handleFinishDeclarationEdit = () => {
        saveDeclaration();
        setIsEditingDeclaration(false);
    };

    useEffect(() => {
        if (!currentAgenda || isEditingDeclaration || isConfirmed || !isAutoCalc) return;

        const newDeclaration = buildDefaultDeclaration({
            agenda: currentAgenda,
            effectiveTotalAttendance,
            isElection,
            isSpecialVote,
            votesYes,
            votesNo,
            votesAbstain
        });

        if (newDeclaration !== currentAgenda.declaration) {
            updateAgenda({ id: currentAgenda.id, declaration: newDeclaration });
            if (projectorMode === 'RESULT') {
                updateProjectorData({
                    ...(projectorData || {}),
                    agendaId: currentAgenda.id,
                    agendaTitle: currentAgenda.title,
                    declaration: newDeclaration,
                    votesYes,
                    votesNo,
                    votesAbstain,
                    totalAttendance: effectiveTotalAttendance,
                    isPassed: calculateAgendaPass(votesYes, effectiveTotalAttendance, isSpecialVote)
                });
            }
        }
    }, [currentAgenda, effectiveTotalAttendance, isAutoCalc, isConfirmed, isEditingDeclaration, isElection, isSpecialVote, projectorData, projectorMode, updateAgenda, updateProjectorData, votesAbstain, votesNo, votesYes]);

    return {
        generateDefaultDeclaration,
        syncProjectorDeclaration,
        isEditingDeclaration,
        isAutoCalc,
        localDeclaration,
        setIsAutoCalc,
        handleDeclarationDraftChange,
        handleStartDeclarationEdit,
        handleFinishDeclarationEdit
    };
}
