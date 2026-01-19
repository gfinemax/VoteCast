
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
    console.log('Checking public tables...');

    // Method 1: Check standard information_schema (if accessible)
    // Note: Anon key usually doesn't have permission to view information_schema, 
    // but let's try a simple query or just list known tables.

    // Since we can't easily query information_schema with anon key usually,
    // we will try to select from 'users' and 'profiles' and see if it errors.

    const tablesToCheck = ['users', 'profiles', 'members', 'agendas'];

    for (const table of tablesToCheck) {
        const { data, error } = await supabase.from(table).select('count', { count: 'exact', head: true });
        if (error) {
            console.log(`Table '${table}': NOT FOUND or No Permission (${error.message})`);
        } else {
            console.log(`Table '${table}': EXISTS`);
        }
    }

    // Also check auth.users (though we can't query it directly with client usually)
    console.log('\nChecking Supabase Auth...');
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();

    // Note: auth.admin requires service_role key usually. We only have anon key.
    // We can just try to get the current user session.

    console.log('Note: Direct DB access to auth schema is restricted.');
    console.log('Login information is managed securely by Supabase Auth service.');
}

checkTables();
