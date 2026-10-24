import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read environment variables via Vite import.meta.env
const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawPublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Clean and normalize strings
const supabaseUrl = typeof rawUrl === 'string' ? rawUrl.trim() : '';
const supabaseKey =
  typeof rawPublishableKey === 'string' && rawPublishableKey.trim() !== ''
    ? rawPublishableKey.trim()
    : typeof rawAnonKey === 'string' && rawAnonKey.trim() !== ''
    ? rawAnonKey.trim()
    : '';

export interface SupabaseConfigStatus {
  isConfigured: boolean;
  missingKeys: string[];
  url?: string;
  hasKey: boolean;
}

export interface SupabaseConnectionResult {
  isConfigured: boolean;
  isConnected: boolean;
  error?: string;
  url?: string;
}

/**
 * Single shared configuration check for Supabase environment variables.
 * Verifies presence of non-placeholder values without revealing secret keys.
 */
export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  const missing: string[] = [];

  const isInvalidUrl =
    !supabaseUrl ||
    supabaseUrl === '' ||
    supabaseUrl.includes('your-project') ||
    supabaseUrl.includes('example.com') ||
    !supabaseUrl.startsWith('http');

  if (isInvalidUrl) {
    missing.push('VITE_SUPABASE_URL');
  }

  const isInvalidKey =
    !supabaseKey ||
    supabaseKey === '' ||
    supabaseKey.includes('your-supabase') ||
    supabaseKey.includes('your-anon-key');

  if (isInvalidKey) {
    missing.push('VITE_SUPABASE_PUBLISHABLE_KEY');
  }

  return {
    isConfigured: missing.length === 0,
    missingKeys: missing,
    url: !isInvalidUrl ? supabaseUrl : undefined,
    hasKey: !isInvalidKey,
  };
}

let supabaseInstance: SupabaseClient | null = null;
const config = getSupabaseConfigStatus();

if (config.isConfigured && supabaseUrl && supabaseKey) {
  try {
    supabaseInstance = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: typeof window !== 'undefined',
        autoRefreshToken: typeof window !== 'undefined',
      },
    });
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    supabaseInstance = null;
  }
}

export const supabase = supabaseInstance;
export const isSupabaseConfigured = () => Boolean(supabaseInstance && config.isConfigured);

/**
 * Initializes a Supabase Anonymous Authentication session if supported and needed.
 * Returns the active user ID (UUID) or null.
 * Provides a real auth.uid() for ownership-based RLS policies without requiring
 * email/password sign-in.
 */
export async function initAnonymousAuth(): Promise<string | null> {
  if (!supabaseInstance || !config.isConfigured) return null;

  try {
    const { data: sessionData, error: sessionErr } = await supabaseInstance.auth.getSession();
    if (!sessionErr && sessionData?.session?.user?.id) {
      return sessionData.session.user.id;
    }

    const { data: authData, error: authErr } = await supabaseInstance.auth.signInAnonymously();
    if (authErr) {
      // If anonymous auth is not enabled in Supabase Dashboard, log a warning and proceed
      console.warn('Supabase anonymous sign-in could not be completed:', authErr.message);
      return null;
    }

    return authData.user?.id || null;
  } catch (err) {
    console.warn('Anonymous auth initialization warning:', err);
    return null;
  }
}

/**
 * Verifies whether the Supabase database connection actually works by executing
 * a real query against the database.
 * "Do not claim a database connection works unless an actual database request succeeds."
 */
export async function verifySupabaseConnection(): Promise<SupabaseConnectionResult> {
  const currentConfig = getSupabaseConfigStatus();

  if (!currentConfig.isConfigured || !supabaseInstance) {
    return {
      isConfigured: false,
      isConnected: false,
      error: 'Supabase credentials not configured in environment',
      url: currentConfig.url,
    };
  }

  try {
    // Perform an actual lightweight query to verify network reachability and schema availability
    const { error } = await supabaseInstance
      .from('workers')
      .select('id', { head: true, count: 'exact' });

    if (error) {
      // The endpoint responded, but the request encountered an error (e.g. table not migrated yet, invalid key, etc.)
      return {
        isConfigured: true,
        isConnected: false,
        error: error.message || 'Database query failed',
        url: currentConfig.url,
      };
    }

    // Actual request succeeded
    return {
      isConfigured: true,
      isConnected: true,
      url: currentConfig.url,
    };
  } catch (err: unknown) {
    return {
      isConfigured: true,
      isConnected: false,
      error: (err as Error)?.message || 'Failed to connect to Supabase database',
      url: currentConfig.url,
    };
  }
}
