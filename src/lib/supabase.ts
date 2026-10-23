import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// Support VITE_SUPABASE_PUBLISHABLE_KEY as requested, and fallback to standard VITE_SUPABASE_ANON_KEY if present
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface SupabaseConfigStatus {
  isConfigured: boolean;
  missingKeys: string[];
  url?: string;
  hasKey: boolean;
}

export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  const missing: string[] = [];
  if (!supabaseUrl || supabaseUrl.trim() === '' || supabaseUrl.includes('your-project')) {
    missing.push('VITE_SUPABASE_URL');
  }
  if (!supabaseKey || supabaseKey.trim() === '' || supabaseKey.includes('your-supabase')) {
    missing.push('VITE_SUPABASE_PUBLISHABLE_KEY');
  }

  return {
    isConfigured: missing.length === 0,
    missingKeys: missing,
    url: supabaseUrl || undefined,
    hasKey: Boolean(supabaseKey && !supabaseKey.includes('your-supabase')),
  };
}

let supabaseInstance: SupabaseClient | null = null;

const config = getSupabaseConfigStatus();

if (config.isConfigured && supabaseUrl && supabaseKey) {
  try {
    supabaseInstance = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    supabaseInstance = null;
  }
}

export const supabase = supabaseInstance;
export const isSupabaseConfigured = () => Boolean(supabaseInstance && config.isConfigured);
