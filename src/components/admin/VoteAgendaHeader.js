'use client';

const getAgendaTypeBadgeText = ({ isSpecialVote, currentAgendaType }) => {
    if (isSpecialVote) return '특별결의(2/3)';
    if (currentAgendaType === 'election') return '일반결의(과반/현장참석 20%)';
    return '일반결의(과반)';
};

export default function VoteAgendaHeader({
    title,
    isSpecialVote,
    currentAgendaType
}) {
    return (
        <div className="flex justify-between items-start gap-4">
            <div className="flex-1">
                <h2 className="text-lg font-bold leading-snug break-keep">
                    {title}
                    <span className="inline-block align-middle ml-2 -mt-1 text-sm font-bold text-white bg-blue-600 px-2 py-0.5 rounded shadow-sm whitespace-nowrap">
                        {getAgendaTypeBadgeText({ isSpecialVote, currentAgendaType })}
                    </span>
                </h2>
            </div>
        </div>
    );
}
