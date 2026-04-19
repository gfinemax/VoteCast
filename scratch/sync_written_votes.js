import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function sync() {
  console.log('Starting full sync of written votes to agendas...');

  // 1. Get all agendas
  const { data: agendas, error: agendaError } = await supabase.from('agendas').select('*').order('id');
  if (agendaError) throw agendaError;

  // 2. Get all written votes
  const { data: writtenVotes, error: voteError } = await supabase.from('written_votes').select('*');
  if (voteError) throw voteError;

  const voteMap = new Map(); // agendaId -> {yes, no, abstain}
  writtenVotes.forEach(v => {
    if (!voteMap.has(v.agenda_id)) {
      voteMap.set(v.agenda_id, { yes: 0, no: 0, abstain: 0 });
    }
    const counts = voteMap.get(v.agenda_id);
    if (counts[v.choice] !== undefined) {
      counts[v.choice]++;
    }
  });

  // 3. Update each agenda
  for (const agenda of agendas) {
    if (agenda.type === 'folder') continue;

    const actual = voteMap.get(agenda.id) || { yes: 0, no: 0, abstain: 0 };
    
    // Only update if discrepancy exists
    if (agenda.written_yes !== actual.yes || agenda.written_no !== actual.no || agenda.written_abstain !== actual.abstain) {
      console.log(`Syncing Agenda ${agenda.id} (${agenda.title}):`);
      console.log(`  Current: yes=${agenda.written_yes}, no=${agenda.written_no}, abstain=${agenda.written_abstain}`);
      console.log(`  Actual:  yes=${actual.yes}, no=${actual.no}, abstain=${actual.abstain}`);
      
      const { error: updateError } = await supabase
        .from('agendas')
        .update({
          written_yes: actual.yes,
          written_no: actual.no,
          written_abstain: actual.abstain,
          // Also update the total votes_yes/no/abstain if this is a split-column agenda
          // votes_yes = written_yes + onsite_yes
          votes_yes: actual.yes + (agenda.onsite_yes || 0),
          votes_no: actual.no + (agenda.onsite_no || 0),
          votes_abstain: actual.abstain + (agenda.onsite_abstain || 0)
        })
        .eq('id', agenda.id);
      
      if (updateError) {
        console.error(`  Error updating agenda ${agenda.id}:`, updateError);
      } else {
        console.log(`  Successfully synced!`);
      }
    }
  }

  console.log('Sync complete.');
}

sync();
