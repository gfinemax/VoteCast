
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function inspectAgendas() {
    const { data, error } = await supabase.from('agendas').select('*').limit(1);
    if (error) {
        console.error(error);
    } else {
        console.log(data.length > 0 ? Object.keys(data[0]) : 'No data');
        if (data.length > 0) console.log(data[0]);
    }
}

inspectAgendas();
