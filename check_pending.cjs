const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env', 'utf8');
envFile.split('\n').forEach(line => {
    if (line && !line.startsWith('#') && line.includes('=')) {
        const parts = line.split('=');
        process.env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/"/g, '').replace(/'/g, '');
    }
});

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    console.log("Fetching ALL trx_reports limits 5...");
    const { data: all, error: err2 } = await supabase.from('trx_reports').select('id, type, quantity, status, item_id, operator_id, created_at').order('created_at', { ascending: false }).limit(5);
    console.log("Latest reports:", all);

    console.log("Fetching pending reports...");
    const { data, error } = await supabase.from('trx_reports').select(`
        id, type, quantity, status, item:mst_items(name), operator:profiles(full_name, role)
    `).eq('status', 'Pending');
    console.log("Error:", error);
    console.log("Matched Pending:", data?.length);
    console.log("Data:", data);
    process.exit(0);
}
check();
