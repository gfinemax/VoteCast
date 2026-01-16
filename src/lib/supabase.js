
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log(`[Supabase Init] URL present: ${!!supabaseUrl}, Key present: ${!!supabaseAnonKey}`);
if (supabaseUrl) console.log(`[Supabase Init] URL length: ${supabaseUrl.length}`);

let client;

try {
    if (supabaseUrl && supabaseAnonKey && typeof supabaseUrl === 'string' && supabaseUrl.trim().length > 0) {
        console.log("[Supabase Init] Creating real client...");
        client = createClient(supabaseUrl, supabaseAnonKey);
    } else {
        throw new Error("Missing or invalid env vars");
    }
} catch (e) {
    console.warn("[Supabase Init] ⚠️ Falling back to dummy client. Reason:", e.message);
    const dummy = {
        from: () => dummy,
        select: () => dummy,
        order: () => dummy,
        eq: () => dummy,
        single: () => ({ data: {}, error: null }),
        insert: () => dummy,
        update: () => dummy,
        delete: () => dummy,
        limit: () => dummy,
        channel: () => dummy,
        on: () => dummy,
        subscribe: () => dummy,
        removeChannel: () => { },
        rpc: () => ({ data: {}, error: null }),
        then: (resolve) => resolve({ data: [], error: null }), // Mock Promise behavior
    };
    client = dummy;
}

export const supabase = client;
