import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  console.log('Checking system_settings table...');
  const { data, error } = await supabase
    .from('system_settings')
    .select('*')
    .eq('id', 1);

  if (error) {
    console.error('Error querying system_settings:', error);
  } else {
    console.log('Row ID 1:', data);
    if (data.length === 0) {
      console.log('Row ID 1 is MISSING!');
      
      // Check if any row exists
      const { data: all } = await supabase.from('system_settings').select('*');
      console.log('All rows in system_settings:', all);
    }
  }
}

check();
