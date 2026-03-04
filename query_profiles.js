import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function test() {
    const { data, error } = await supabase.from('profiles').select('*').limit(1)
    console.log('DATA:', JSON.stringify(data, null, 2))
    console.log('ERROR:', error)
    process.exit(0)
}
test()
