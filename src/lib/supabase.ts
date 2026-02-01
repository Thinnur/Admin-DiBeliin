// =============================================================================
// DiBeliin Admin - Supabase Client Configuration
// =============================================================================

import { createClient } from '@supabase/supabase-js';

// Environment variables for Supabase connection
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
        '⚠️ Missing Supabase credentials. Please create a .env file with:\n' +
        'VITE_SUPABASE_URL=your_supabase_url\n' +
        'VITE_SUPABASE_ANON_KEY=your_supabase_anon_key'
    );
}

// Create and export the Supabase client
export const supabase = createClient(
    supabaseUrl || '',
    supabaseAnonKey || ''
);
