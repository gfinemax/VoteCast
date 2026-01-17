const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load Env
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
    console.log("Checking for 'active_meeting_id' column...");

    const { data, error } = await supabase.from('system_settings').select('active_meeting_id').limit(1);

    if (error || !data) {
        console.log("\n[ACTION REQUIRED] Please run this SQL in Supabase Dashboard:\n");
        console.log(`
ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS active_meeting_id bigint REFERENCES public.agendas(id);
        `);
    } else {
        console.log("Column 'active_meeting_id' already exists.");
    }
}

run();
