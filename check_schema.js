import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkSchema() {
    console.log("Fetching trx_reports with limit 1...");
    const { data, error } = await supabase.from('trx_reports').select('*').limit(1);

    if (error) {
        console.error("Error:", error);
    } else {
        if (data.length > 0) {
            console.log("Columns:", Object.keys(data[0]));
        } else {
            console.log("Table is empty, but query succeeded. Let me try inserting a blank record to see error or fetching columns via rpc.");
            // Actually, if data is empty, we can just do a select with limit 0 and still check columns? No, Supabase JS just gives empty array.
        }
    }
}

checkSchema();
