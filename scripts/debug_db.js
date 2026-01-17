
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugDatabase() {
    console.log("--- Debugging system_settings ---");

    // 1. Check if we can select from system_settings
    const { data: rows, error: selectError } = await supabase
        .from('system_settings')
        .select('*');

    if (selectError) {
        console.error("Error selecting from system_settings:", selectError);
        // If column doesn't exist, this might fail or return partial data?
        // Usually it returns error: "Could not find the 'active_meeting_id' column of 'system_settings' in the schema cache"
        // or Postgres error "column does not exist".
    } else {
        console.log("Current rows in system_settings:", rows);
        if (rows.length === 0) {
            console.warn("⚠️ Table system_settings is EMPTY. Update with id=1 will fail.");
        }
    }

    // 2. Try to update explicitly to see the error
    console.log("\n--- Attempting Update ---");
    const { data: updateData, error: updateError } = await supabase
        .from('system_settings')
        .update({ active_meeting_id: null }) // Try setting to null first, safe
        .eq('id', 1)
        .select();

    if (updateError) {
        console.error("Update Failed:", updateError);
        console.error("Error Details:", JSON.stringify(updateError, null, 2));
    } else {
        console.log("Update Successful:", updateData);
    }
}

debugDatabase();
