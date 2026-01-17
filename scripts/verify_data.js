
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function verify() {
    // Check if unit field is populated
    const { data, error } = await supabase.from('members').select('id, unit').limit(5);
    if (error) {
        console.error('Error reading members:', error);
    } else {
        console.log('Sample data:', data);
    }

    const { count } = await supabase.from('members').select('*', { count: 'exact', head: true });
    console.log('Total Members:', count);
}

verify();
