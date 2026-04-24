import { supabase } from '@/lib/supabase';

export const fetchSystemSettings = () => (
    supabase
        .from('system_settings')
        .select('*')
        .eq('id', 1)
        .single()
);

export const updateSystemSettings = (fields) => (
    supabase
        .from('system_settings')
        .update(fields)
        .eq('id', 1)
);

export const fetchAgendas = () => (
    supabase
        .from('agendas')
        .select('*')
        .order('order_index', { ascending: true })
);

export const fetchAgendaById = (id) => (
    supabase
        .from('agendas')
        .select('*')
        .eq('id', id)
        .single()
);

export const fetchAgendaOrderRowsFrom = (orderIndex) => (
    supabase
        .from('agendas')
        .select('id, order_index')
        .gte('order_index', orderIndex)
        .order('order_index', { ascending: false })
);

export const fetchMaxAgendaOrder = () => (
    supabase
        .from('agendas')
        .select('order_index')
        .order('order_index', { ascending: false })
        .limit(1)
);

export const fetchMaxAgendaId = () => (
    supabase
        .from('agendas')
        .select('id')
        .order('id', { ascending: false })
        .limit(1)
);

export const insertAgenda = (agenda) => (
    supabase
        .from('agendas')
        .insert(agenda)
        .select()
        .single()
);

export const updateAgendaFields = (id, fields) => (
    supabase
        .from('agendas')
        .update(fields)
        .eq('id', id)
);

export const deleteAgendaById = (id) => (
    supabase
        .from('agendas')
        .delete()
        .eq('id', id)
);

export const fetchMembers = () => (
    supabase
        .from('members')
        .select('*')
        .order('id', { ascending: true })
);

export const fetchMaxMemberId = () => (
    supabase
        .from('members')
        .select('id')
        .order('id', { ascending: false })
        .limit(1)
);

export const insertMember = (member) => (
    supabase
        .from('members')
        .insert(member)
        .select()
        .single()
);

export const updateMemberFields = (id, fields) => (
    supabase
        .from('members')
        .update(fields)
        .eq('id', id)
        .select()
        .single()
);

export const deleteMemberById = (id) => (
    supabase
        .from('members')
        .delete()
        .eq('id', id)
);

export const fetchAttendance = () => (
    supabase
        .from('attendance')
        .select('*')
);

export const insertAttendance = (attendance) => (
    supabase
        .from('attendance')
        .insert(attendance)
);

export const deleteAttendanceByMemberMeeting = (memberId, meetingId) => (
    supabase
        .from('attendance')
        .delete()
        .eq('member_id', memberId)
        .eq('meeting_id', meetingId)
);

export const fetchWrittenAttendanceForMeetings = (meetingIds) => (
    supabase
        .from('attendance')
        .select('meeting_id, member_id')
        .in('meeting_id', meetingIds)
        .eq('type', 'written')
);

export const fetchMailElectionVotes = () => (
    supabase
        .from('mail_election_votes')
        .select('*')
        .order('created_at', { ascending: true })
);

export const fetchWrittenVotesForAgendas = (agendaIds) => (
    supabase
        .from('written_votes')
        .select('agenda_id, member_id, choice')
        .in('agenda_id', agendaIds)
);

export const upsertWrittenVotes = (votes) => (
    supabase
        .from('written_votes')
        .upsert(votes, {
            onConflict: 'member_id,meeting_id,agenda_id',
            ignoreDuplicates: true
        })
);

export const fetchWrittenVotesForMemberMeeting = (memberId, meetingId) => (
    supabase
        .from('written_votes')
        .select('agenda_id, choice')
        .eq('member_id', memberId)
        .eq('meeting_id', meetingId)
);

export const fetchMailElectionVotesForMemberMeeting = (memberId, meetingId) => (
    supabase
        .from('mail_election_votes')
        .select('agenda_id, choice')
        .eq('member_id', memberId)
        .eq('meeting_id', meetingId)
);

export const checkInMember = ({
    memberId,
    meetingId,
    type,
    hasElection,
    proxyName,
    votes,
    electionVotes
}) => (
    supabase.rpc('check_in_member', {
        p_member_id: memberId,
        p_meeting_id: meetingId,
        p_type: type,
        p_has_election: hasElection,
        p_proxy_name: proxyName,
        p_votes: votes,
        p_election_votes: electionVotes
    })
);

export const replaceCheckInMember = ({
    memberId,
    meetingId,
    type,
    hasElection,
    proxyName,
    votes,
    electionVotes
}) => (
    supabase.rpc('replace_check_in_member', {
        p_member_id: memberId,
        p_meeting_id: meetingId,
        p_type: type,
        p_has_election: hasElection,
        p_proxy_name: proxyName,
        p_votes: votes,
        p_election_votes: electionVotes
    })
);

export const cancelCheckInMember = (memberId, meetingId) => (
    supabase.rpc('cancel_check_in_member', {
        p_member_id: memberId,
        p_meeting_id: meetingId
    })
);
