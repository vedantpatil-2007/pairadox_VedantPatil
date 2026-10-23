import { describe, it, expect } from 'vitest';
import { getSupabaseConfigStatus, verifySupabaseConnection } from '../lib/supabase';

describe('Shared Supabase Configuration & Connection Verification', () => {
  it('returns a unified configuration status object without revealing secrets', () => {
    const status = getSupabaseConfigStatus();
    expect(status).toBeDefined();
    expect(typeof status.isConfigured).toBe('boolean');
    expect(Array.isArray(status.missingKeys)).toBe(true);
    expect(typeof status.hasKey).toBe('boolean');

    // Never reveals secret keys in the status object
    expect((status as any).key).toBeUndefined();
    expect((status as any).publishableKey).toBeUndefined();
    expect((status as any).anonKey).toBeUndefined();
  });

  it('does not claim database connection works unless actual query succeeds', async () => {
    const result = await verifySupabaseConnection();
    expect(result).toBeDefined();
    expect(typeof result.isConnected).toBe('boolean');

    if (!result.isConnected) {
      // If query does not succeed, it must explicitly provide reason/error
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    }
  });
});
