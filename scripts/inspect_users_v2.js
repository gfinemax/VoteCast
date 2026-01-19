
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function inspect() {
    console.log('--- Checking users ---');
    const { data: users, error: usersError } = await supabase.from('users').select('*').limit(1);
    if (usersError) console.log('Error:', usersError.message, usersError.code);
    else console.log('Success. Data:', users);

    console.log('\n--- Checking profiles ---');
    const { data: profiles, error: profilesError } = await supabase.from('profiles').select('*').limit(1);
    if (profilesError) console.log('Error:', profilesError.message, profilesError.code);
    else console.log('Success. Data:', profiles);
}

inspect();
