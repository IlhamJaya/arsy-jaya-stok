const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
    if (line && !line.startsWith('#') && line.includes('=')) {
        const parts = line.split('=');
        acc[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/['"]/g, '');
    }
    return acc;
}, {});
fetch(env.VITE_SUPABASE_URL + '/rest/v1/?apikey=' + env.VITE_SUPABASE_ANON_KEY)
    .then(res => res.json())
    .then(data => {
        console.log('trx_stock_log schema:', data.definitions.trx_stock_log.properties);
    }).catch(e => console.error(e));
