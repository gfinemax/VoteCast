
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Fail gracefully if env vars are missing (e.g. during build time)
// This prevents the build from crashing, though actual DB operations will fail.
let client;

if (supabaseUrl && supabaseAnonKey) {
    client = createClient(supabaseUrl, supabaseAnonKey);
} else {
    console.warn("⚠️ Missing Supabase URL or Anon Key. Initializing dummy client for build.");
    client = {
        // Mock minimal methods to prevent crash on import if used (though mostly used in effects)
        from: () => ({ select: () => ({ eq: () => ({ single: () => ({}) }) }) }),
        channel: () => ({ on: () => ({ on: () => ({ subscribe: () => { } }) }) }),
        removeChannel: () => { },
    };
}

export const supabase = client;
