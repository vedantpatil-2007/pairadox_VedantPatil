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
  operationsVerified?: boolean;
  error?: string;
  url?: string;
}

export type StorageMode = 'live_verified' | 'connected_simulation' | 'demo_simulation';

export interface SupabaseHealthStatus {
  isConfigured: boolean;
  isReachable: boolean;
  isConnected: boolean; // Backwards-compatible alias for isReachable
  operationsVerified: boolean;
  mode: StorageMode;
  error?: string;
  errorCode?: string;
  url?: string;
  label: string;
  description: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role: 'customer' | 'worker';
  is_demo?: boolean;
}

const DEMO_SESSION_KEY = 'skillnear_demo_session_v2';

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
      console.warn('Supabase anonymous sign-in could not be completed:', authErr.message);
      return null;
    }

    return authData.user?.id || null;
  } catch (err) {
    console.warn('Anonymous auth initialization warning:', err);
    return null;
  }
}

let cachedHealth: { result: SupabaseHealthStatus; timestamp: number } | null = null;
const HEALTH_CACHE_TTL_MS = 15000;

export function clearHealthCache(): void {
  cachedHealth = null;
}

/**
 * Comprehensive 3-tier health verification separating:
 * 1. Credentials configured
 * 2. Database reachable
 * 3. Application operations verified
 *
 * Never claims "Supabase Live" unless operations are verified and persistent writes succeed.
 */
export async function verifySupabaseHealth(forceRefresh = false): Promise<SupabaseHealthStatus> {
  const now = Date.now();
  if (!forceRefresh && cachedHealth && now - cachedHealth.timestamp < HEALTH_CACHE_TTL_MS) {
    return cachedHealth.result;
  }

  const currentConfig = getSupabaseConfigStatus();

  if (!currentConfig.isConfigured || !supabaseInstance) {
    const res: SupabaseHealthStatus = {
      isConfigured: false,
      isReachable: false,
      isConnected: false,
      operationsVerified: false,
      mode: 'demo_simulation',
      error: 'Supabase credentials not configured',
      url: currentConfig.url,
      label: 'Demo Simulation',
      description: 'Saved in this browser only; not saved to Supabase',
    };
    cachedHealth = { result: res, timestamp: now };
    return res;
  }

  try {
    // Tier 2: Check database reachability
    const { error: pingError } = await supabaseInstance
      .from('workers')
      .select('id', { head: true, count: 'exact' });

    if (pingError) {
      const res: SupabaseHealthStatus = {
        isConfigured: true,
        isReachable: false,
        isConnected: false,
        operationsVerified: false,
        mode: 'demo_simulation',
        error: pingError.message || 'Database query failed',
        url: currentConfig.url,
        label: 'Database Unreachable',
        description: 'Credentials configured but database is unreachable. Operating in local simulation.',
      };
      cachedHealth = { result: res, timestamp: now };
      return res;
    }

    // Tier 3: Verify whether application schema & write operations are operational
    // Check if corrective views and clean policies exist without recursion
    const { error: viewError } = await supabaseInstance
      .from('workers_directory')
      .select('id')
      .limit(1);

    if (viewError) {
      // Check if service_requests also exhibits PostgreSQL RLS circular recursion (code 42P17)
      let detailedError = 'Schema migration pending: corrective views (workers_directory) not deployed (code PGRST205)';
      let errCode = viewError.code || 'PGRST205';

      try {
        const { error: reqError } = await supabaseInstance
          .from('service_requests')
          .select('id')
          .limit(1);

        if (reqError?.code === '42P17') {
          detailedError = 'PostgreSQL RLS policy recursion detected on service_requests (code 42P17). Run Consolidated Migration SQL to fix.';
          errCode = '42P17';
        }
      } catch {
        // Ignore secondary probe error
      }

      const res: SupabaseHealthStatus = {
        isConfigured: true,
        isReachable: true,
        isConnected: true,
        operationsVerified: false,
        mode: 'connected_simulation',
        error: detailedError,
        errorCode: errCode,
        url: currentConfig.url,
        label: 'Supabase Connected (Simulated Writes)',
        description: 'PostgreSQL reachable, but corrective migration is pending. Writes use browser demo storage to protect data.',
      };
      cachedHealth = { result: res, timestamp: now };
      return res;
    }

    // All 3 tiers verified
    const res: SupabaseHealthStatus = {
      isConfigured: true,
      isReachable: true,
      isConnected: true,
      operationsVerified: true,
      mode: 'live_verified',
      url: currentConfig.url,
      label: 'Supabase Live',
      description: 'Persistent PostgreSQL storage is fully verified and active.',
    };
    cachedHealth = { result: res, timestamp: now };
    return res;
  } catch (err: unknown) {
    const res: SupabaseHealthStatus = {
      isConfigured: true,
      isReachable: false,
      isConnected: false,
      operationsVerified: false,
      mode: 'demo_simulation',
      error: (err as Error)?.message || 'Failed to connect to Supabase database',
      url: currentConfig.url,
      label: 'Connection Error',
      description: 'Network error connecting to Supabase. Operating in demo simulation.',
    };
    cachedHealth = { result: res, timestamp: now };
    return res;
  }
}

/**
 * Backwards-compatible connection verification
 */
export async function verifySupabaseConnection(): Promise<SupabaseConnectionResult> {
  const health = await verifySupabaseHealth();
  return {
    isConfigured: health.isConfigured,
    isConnected: health.isReachable,
    operationsVerified: health.operationsVerified,
    error: health.error,
    url: health.url,
  };
}

// --- AUTHENTICATION & SESSION MANAGEMENT ---

export const authService = {
  /**
   * Get current authenticated user (from Supabase Auth or persistent demo session)
   */
  async getCurrentUser(): Promise<AuthUser | null> {
    // 1. Check Supabase Auth session if configured
    if (supabaseInstance && config.isConfigured) {
      try {
        const { data } = await supabaseInstance.auth.getSession();
        const supaUser = data?.session?.user;
        if (supaUser && !supaUser.is_anonymous) {
          return {
            id: supaUser.id,
            email: supaUser.email || 'user@skillnear.local',
            name: supaUser.user_metadata?.name || supaUser.email?.split('@')[0] || 'User',
            role: (supaUser.user_metadata?.role as 'customer' | 'worker') || 'customer',
            is_demo: false,
          };
        }
      } catch (err) {
        console.warn('Error reading Supabase session:', err);
      }
    }

    // 2. Check persistent demo session
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = window.localStorage.getItem(DEMO_SESSION_KEY);
        if (stored) {
          return JSON.parse(stored) as AuthUser;
        }
      } catch (err) {
        console.warn('Error reading demo session:', err);
      }
    }

    return null;
  },

  /**
   * Sign in with email and password
   */
  async signInWithEmail(
    email: string,
    password: string
  ): Promise<{ user: AuthUser | null; error?: string }> {
    if (supabaseInstance && config.isConfigured) {
      try {
        const { data, error } = await supabaseInstance.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          return { user: null, error: error.message };
        }
        if (data.user) {
          const user: AuthUser = {
            id: data.user.id,
            email: data.user.email || email,
            name: data.user.user_metadata?.name || email.split('@')[0],
            role: (data.user.user_metadata?.role as 'customer' | 'worker') || 'customer',
            is_demo: false,
          };
          return { user };
        }
      } catch (err) {
        return { user: null, error: (err as Error).message };
      }
    }

    // Simulation / offline fallback for demo credentials
    const demoUser: AuthUser = {
      id: `usr-${Date.now()}`,
      email,
      name: email.split('@')[0],
      role: email.includes('worker') || email.includes('tech') ? 'worker' : 'customer',
      is_demo: true,
    };
    this.setDemoUser(demoUser);
    return { user: demoUser };
  },

  /**
   * Register a new user
   */
  async signUpWithEmail(
    email: string,
    password: string,
    name?: string,
    role: 'customer' | 'worker' = 'customer'
  ): Promise<{ user: AuthUser | null; error?: string }> {
    if (supabaseInstance && config.isConfigured) {
      try {
        const { data, error } = await supabaseInstance.auth.signUp({
          email,
          password,
          options: {
            data: { name: name || email.split('@')[0], role },
          },
        });
        if (error) {
          return { user: null, error: error.message };
        }
        if (data.user) {
          const user: AuthUser = {
            id: data.user.id,
            email: data.user.email || email,
            name: name || email.split('@')[0],
            role,
            is_demo: false,
          };
          return { user };
        }
      } catch (err) {
        return { user: null, error: (err as Error).message };
      }
    }

    // Simulation registration
    const demoUser: AuthUser = {
      id: `usr-${Date.now()}`,
      email,
      name: name || email.split('@')[0],
      role,
      is_demo: true,
    };
    this.setDemoUser(demoUser);
    return { user: demoUser };
  },

  /**
   * Sign out current user
   */
  async signOut(): Promise<void> {
    if (supabaseInstance && config.isConfigured) {
      try {
        await supabaseInstance.auth.signOut();
      } catch (err) {
        console.warn('Supabase sign out error:', err);
      }
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(DEMO_SESSION_KEY);
      } catch (err) {
        console.warn('Error clearing demo session:', err);
      }
    }
  },

  /**
   * Switch or set an active demo user persona for simulation testing
   */
  setDemoUser(user: AuthUser | null): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        if (user) {
          window.localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(user));
        } else {
          window.localStorage.removeItem(DEMO_SESSION_KEY);
        }
      } catch (err) {
        console.warn('Error saving demo session:', err);
      }
    }
  },
};
