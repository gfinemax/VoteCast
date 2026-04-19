import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const agendaId = 20; // from previous run
  const { data: agenda } = await supabase.from('agendas').select('*').eq('id', agendaId).single();
  const meetingId = agenda.meeting_id;

  const { data: attendance } = await supabase.from('attendance').select('*').eq('meeting_id', meetingId);
  const writtenAttendanceMemberIds = attendance.filter(a => a.type === 'written').map(a => a.member_id);
  
  console.log(`Total Written Attendance: ${writtenAttendanceMemberIds.length}`);
  
  const { data: votes } = await supabase.from('written_votes').select('*').eq('agenda_id', agendaId);
  const votedMemberIds = new Set(votes.map(v => v.member_id));
  
  console.log(`Total Written Votes for Agenda ${agendaId}: ${votes.length}`);
  
  const choices = { yes: 0, no: 0, abstain: 0, other: 0 };
  votes.forEach(v => {
    if (choices[v.choice] !== undefined) choices[v.choice]++;
    else choices.other++;
  });
  console.log('Choices Breakdown:', choices);

  const missing = writtenAttendanceMemberIds.filter(id => !votedMemberIds.has(id));
  console.log(`Members present (written) but no vote for this agenda: ${missing.length}`);
  
  if (missing.length > 0) {
    const { data: members } = await supabase.from('members').select('id, name').in('id', missing);
    console.log('Missing members:', members);
  }
}

check();
