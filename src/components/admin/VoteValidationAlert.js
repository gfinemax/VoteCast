'use client';

import { AlertTriangle } from 'lucide-react';

const formatMemberNames = (memberIds = [], members = []) => {
    const memberById = new Map(members.map((member) => [member.id, member]));
    return memberIds
        .map((id) => memberById.get(id))
        .filter(Boolean)
        .map((member) => `${member.unit || ''} ${member.name}`.trim())
        .join(', ');
};

export default function VoteValidationAlert({
    isVisible,
    isElection,
    hasElectionValidationIssue,
    isElectionMailMissing,
    hasElectionMailOverlap,
    hasInvalidProxyElection,
    isOnsiteOverflow,
    electionValidation,
    members,
    onsiteVotesCast,
    effectiveOnsiteEligibleCount,
    displayTotalVotesCast,
    voteCountStatusText
}) {
    if (!isVisible) {
        return (
            <div className="px-4 py-2 opacity-0 select-none pointer-events-none text-sm text-slate-800">
                Space reserved for warnings
            </div>
        );
    }

    return (
        <div className="w-full rounded-xl border border-rose-800/60 bg-rose-950/40 px-4 py-2 flex items-start gap-3 shadow-inner animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center justify-center bg-rose-900/50 rounded-full p-1.5 shrink-0 mt-0.5">
                <AlertTriangle size={16} className="text-rose-400" />
            </div>
            <div className="text-sm font-bold text-rose-300">
                {isElection && hasElectionValidationIssue ? (
                    <div className="flex flex-col gap-1">
                        <span>선거 안건 검증 경고:</span>
                        <ul className="list-none space-y-1 text-xs font-semibold text-rose-300/90">
                            {isElectionMailMissing && (
                                <li className="flex flex-col gap-0.5">
                                    <div className="flex items-start gap-1.5">
                                        <span className="text-rose-400 shrink-0">•</span>
                                        <span>우편투표 미제출: 등록된 {electionValidation.expectedMailVoteCount}명 중 {electionValidation.missingMailVoteCount}명의 투표 기록 없음</span>
                                    </div>
                                    <div className="ml-3 text-[10px] text-rose-400/80 leading-relaxed font-medium">
                                        대상: {formatMemberNames(electionValidation.missingMailVoteMemberIds, members)}
                                    </div>
                                </li>
                            )}
                            {hasElectionMailOverlap && (
                                <li className="flex flex-col gap-0.5">
                                    <div className="flex items-start gap-1.5">
                                        <span className="text-amber-400 shrink-0">•</span>
                                        <span className="text-amber-300/90">우편/현장 중복: {electionValidation.overlapMailVoteCount}명이 중복 등록됨 (참석유형 정리 필요)</span>
                                    </div>
                                    <div className="ml-3 text-[10px] text-amber-500/80 leading-relaxed font-medium">
                                        대상: {formatMemberNames(electionValidation.overlapMailVoteMemberIds, members)}
                                    </div>
                                </li>
                            )}
                            {hasInvalidProxyElection && (
                                <li className="flex flex-col gap-0.5">
                                    <div className="flex items-start gap-1.5">
                                        <span className="text-rose-400 shrink-0">•</span>
                                        <span>대리 현장선거 불가: 대리 참석 {electionValidation.invalidProxyElectionCount}명이 선거 참여로 등록됨 → 우편투표 또는 선거 불참으로 정리하세요</span>
                                    </div>
                                    <div className="ml-3 text-[10px] text-rose-400/80 leading-relaxed font-medium">
                                        대상: {formatMemberNames(electionValidation.invalidProxyElectionMemberIds, members)}
                                    </div>
                                </li>
                            )}
                            {isOnsiteOverflow && (
                                <li className="flex items-start gap-1.5">
                                    <span className="text-rose-400 shrink-0">•</span>
                                    <span>현장 입력 초과: 현장 입력 합계({onsiteVotesCast}표)가 가능 인원({effectiveOnsiteEligibleCount}명)을 초과 → 현장 투표 숫자를 줄이세요</span>
                                </li>
                            )}
                            {displayTotalVotesCast !== electionValidation.expectedTotalVotes && !isOnsiteOverflow && (
                                <li className="flex items-start gap-1.5">
                                    <span className="text-rose-400 shrink-0">•</span>
                                    <span>총 투표수 불일치: 현재 {displayTotalVotesCast}표 / 기대값 {electionValidation.expectedTotalVotes}표 (우편 {electionValidation.actualMailVoteCount} + 현장 {effectiveOnsiteEligibleCount}) → 현장 투표 입력을 조정하세요</span>
                                </li>
                            )}
                        </ul>
                    </div>
                ) : isOnsiteOverflow ? (
                    `현장 입력 합계가 가능 인원(${effectiveOnsiteEligibleCount}명)을 초과했습니다.`
                ) : isElection ? (
                    '모든 수치를 확인해 주세요.'
                ) : (
                    `현재 총 투표수는 참석자 기준보다 ${voteCountStatusText} 상태입니다.`
                )}
            </div>
        </div>
    );
}
