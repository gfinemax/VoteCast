
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    console.log("Checking columns...");
    // Try to select the specific columns. If they don't exist, it should error.
    const { data, error } = await supabase
        .from('members')
        .select('id, is_checked_in, check_in_type')
        .limit(1);

    if (error) {
        console.error("Column check failed:", error.message);
    } else {
        console.log("Columns exist. Data:", data);
    }
}
check();
