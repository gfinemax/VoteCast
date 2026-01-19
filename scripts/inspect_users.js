
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectUsers() {
    console.log('Inspecting "users" table...');

    const { data, error } = await supabase.from('users').select('*').limit(1);

    if (error) {
        console.log('Error accessing users table:', error.message);
    } else {
        console.log('Users table accessed successfully.');
        if (data && data.length > 0) {
            console.log('Sample row keys:', Object.keys(data[0]));
            console.log('Sample row:', data[0]);
        } else {
            console.log('Users table is empty.');
        }
    }
}

inspectUsers();
