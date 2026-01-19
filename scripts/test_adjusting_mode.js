
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function inspectConstraints() {
    // Query to find check constraints on system_settings
    const { data, error } = await supabase
        .rpc('get_check_constraints', { table_name: 'system_settings' }); // Assuming we might not have RPC, so let's use raw SQL via a generic query interface if possible, or just try to UPDATE to 'ADJUSTING' and catch the error.

    // Simpler approach: Try to update to 'ADJUSTING' and see if it fails.
    console.log("Attempting to set projector_mode to 'ADJUSTING'...");

    // First get current value to restore it
    const { data: current } = await supabase.from('system_settings').select('projector_mode').eq('id', 1).single();
    console.log("Current mode:", current?.projector_mode);

    const { error: updateError } = await supabase.from('system_settings')
        .update({ projector_mode: 'ADJUSTING' })
        .eq('id', 1);

    if (updateError) {
        console.error("Update Failed:", updateError);
        console.error("Likely reason: CHECK constraint violation.");
    } else {
        console.log("Update Successful! 'ADJUSTING' is allowed.");
        // Restore
        if (current) {
            await supabase.from('system_settings').update({ projector_mode: current.projector_mode }).eq('id', 1);
            console.log("Restored original mode.");
        }
    }
}

inspectConstraints();
