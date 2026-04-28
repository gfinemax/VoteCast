
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkRLS() {
    console.log('Checking RLS for mail_election_votes');
    // We can't directly check RLS via Supabase JS Client easily without RPC or similar.
    // But we can try a query and see if it works.
    
    const { data, error } = await supabase
        .from('mail_election_votes')
        .select('*');
    
    if (error) {
        console.log('Query failed:', error);
    } else {
        console.log('Query succeeded. Data length:', data.length);
        console.log('First row:', data[0]);
    }
}

checkRLS();
