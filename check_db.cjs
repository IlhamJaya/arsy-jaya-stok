const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
    if (line && !line.startsWith('#') && line.includes('=')) {
        const parts = line.split('=');
        acc[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/['"]/g, '');
    }
    return acc;
}, {});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function check() {
    try {
        const { data: reports, error } = await supabase.from('trx_reports').select('*');
        if (error) {
            console.error('Error fetching', error);
            return;
        }
        console.log('Reports len:', reports.length);
        console.log('Sample:', reports[0]);

        const { data: queryData, error: queryError } = await supabase
            .from('trx_reports')
            .select('id, type, quantity, notes, status, created_at, item:mst_items(name, code, unit, stock), operator:profiles!trx_reports_operator_id_fkey(full_name, block_area, role)');

        if (queryError) console.error('Join Error:', queryError);
        else {
            console.log('QueryData len:', queryData.length);
            console.log('SampleJoin:', queryData[0]);
        }

    } catch (e) {
        console.error('Catch Error:', e.message);
    }
}
check();
