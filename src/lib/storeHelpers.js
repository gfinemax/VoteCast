/**
 * Per-meeting inactive member IDs helper.
 * Checks inactiveMemberIdsByMeeting[meetingId] first, falls back to global inactiveMemberIds.
 */
export const getInactiveMemberIds = (voteData = {}, meetingId = null) => {
    // If meetingId provided, try meeting-specific list first
    if (meetingId && voteData?.inactiveMemberIdsByMeeting) {
        const meetingSpecific = voteData.inactiveMemberIdsByMeeting[meetingId];
        if (Array.isArray(meetingSpecific)) {
            return meetingSpecific
                .map((value) => parseInt(value, 10))
                .filter((value) => !Number.isNaN(value));
        }
    }
    // Fallback to global list (legacy / default)
    if (!Array.isArray(voteData?.inactiveMemberIds)) return [];
    return voteData.inactiveMemberIds
        .map((value) => parseInt(value, 10))
        .filter((value) => !Number.isNaN(value));
};

/**
 * Get the meeting ID when a member was added to the system.
 * Returns null for members that existed before per-meeting tracking was introduced.
 */
export const getMemberJoinedMeetingId = (voteData = {}, memberId) => {
    if (!memberId || !voteData?.memberJoinedMeetingId) return null;
    return voteData.memberJoinedMeetingId[memberId] || null;
};

/**
 * Get the admission status for a specific meeting.
 * Returns 'idle' | 'open' | 'closed'
 */
export const getMeetingAdmissionStatus = (voteData = {}, meetingId) => {
    if (!meetingId || !voteData?.meetingAdmissionStatus) return 'idle';
    return voteData.meetingAdmissionStatus[meetingId] || 'idle';
};
