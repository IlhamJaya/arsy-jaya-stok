import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Parse .env manually
const envRaw = fs.readFileSync('.env', 'utf-8');
const env = {};
envRaw.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length > 0) {
        env[key.trim()] = vals.join('=').trim().replace(/^"|"$/g, '');
    }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_SERVICE_ROLE_KEY'] || env['VITE_SUPABASE_ANON_KEY'];

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateBranding() {
    try {
        const logoSvg = fs.readFileSync('./public/Logo.svg', 'utf-8');

        const { data, error } = await supabase
            .from('app_settings')
            .update({
                app_title: 'ARSY JAYA',
                app_subtitle: 'Stock & Tracking Sistem',
                app_logo_svg: logoSvg
            })
            .eq('id', 1);

        if (error) {
            console.error("Error updating branding:", error);
        } else {
            console.log("Branding successfully updated!");
        }
    } catch (err) {
        console.error("Script error:", err);
    }
}

updateBranding();
