
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Read .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

const env = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        env[match[1]] = match[2].trim();
    }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing env vars in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("Generating 116 members...");

    const members = [];
    for (let i = 1; i <= 116; i++) {
        // Generate Unit: e.g. 101-101 to 104-404 range logic, or just simple
        const building = 101 + Math.floor((i - 1) / 30);
        const floor = 1 + Math.floor(((i - 1) % 30) / 4);
        const room = 1 + ((i - 1) % 4);
        const unit = `${building}-${floor}0${room}`;

        members.push({
            id: i,
            name: `조합원 ${i}`,
            unit: unit,
            is_checked_in: false
        });
    }

    // Insert in batches of 50 to be safe
    const batchSize = 50;
    for (let i = 0; i < members.length; i += batchSize) {
        const batch = members.slice(i, i + batchSize);
        console.log(`Inserting batch ${i / batchSize + 1}...`);

        const { error } = await supabase.from('members').upsert(batch);

        if (error) {
            console.error("Error inserting batch:", error);
            process.exit(1);
        }
    }

    console.log("Successfully created 116 members.");

    // Update system_settings totalMembers if needed
    console.log("Updating system settings totalMembers...");
    const { error: settingsError } = await supabase.from('system_settings').update({
        vote_data: {
            totalMembers: 116,
            directAttendance: 0,
            proxyAttendance: 0,
            writtenAttendance: 0,
            votesYes: 0,
            votesNo: 0,
            votesAbstain: 0
        }
    }).eq('id', 1);

    if (settingsError) {
        console.error("Warning: Could not update system_settings:", settingsError);
    } else {
        console.log("System settings updated.");
    }
}

main();
