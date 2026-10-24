import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseEnvContent } from '../../server/productionServer.js';
import { handleGeminiRequest } from '../../server/geminiHandler.js';

describe('SkillNear Gemini Environment Loading & Security Suite', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  /* =========================================================================
   * 1. PURE .ENV PARSER VERIFICATION (CRLF, QUOTES, COMMENTS)
   * ========================================================================= */
  describe('Server-side .env Parser (parseEnvContent)', () => {
    it('parses standard KEY=VALUE declarations', () => {
      const input = 'GEMINI_API_KEY=AIzaSySecretKey123\nGEMINI_MODEL=gemini-3.8-flash';
      const parsed = parseEnvContent(input);

      expect(parsed.GEMINI_API_KEY).toBe('AIzaSySecretKey123');
      expect(parsed.GEMINI_MODEL).toBe('gemini-3.8-flash');
    });

    it('handles Windows CRLF (\\r\\n) without leaving trailing \\r', () => {
      const input = 'GEMINI_API_KEY=AIzaSySecretKey123\r\nGEMINI_MODEL=gemini-3.8-flash\r\n';
      const parsed = parseEnvContent(input);

      expect(parsed.GEMINI_API_KEY).toBe('AIzaSySecretKey123');
      expect(parsed.GEMINI_API_KEY.includes('\r')).toBe(false);
      expect(parsed.GEMINI_MODEL).toBe('gemini-3.8-flash');
    });

    it('strips double quotes and single quotes from values', () => {
      const input = `
        DOUBLE_QUOTED="AIzaSyDoubleQuotedKey"
        SINGLE_QUOTED='AIzaSySingleQuotedKey'
        UNQUOTED=NormalUnquotedValue
      `;
      const parsed = parseEnvContent(input);

      expect(parsed.DOUBLE_QUOTED).toBe('AIzaSyDoubleQuotedKey');
      expect(parsed.SINGLE_QUOTED).toBe('AIzaSySingleQuotedKey');
      expect(parsed.UNQUOTED).toBe('NormalUnquotedValue');
    });

    it('ignores empty lines and full-line comments (#)', () => {
      const input = `
        # Comment line 1
        # Comment line 2

        GEMINI_API_KEY=my_key_123

        # Trailing comment
      `;
      const parsed = parseEnvContent(input);

      expect(Object.keys(parsed)).toEqual(['GEMINI_API_KEY']);
      expect(parsed.GEMINI_API_KEY).toBe('my_key_123');
    });

    it('strips inline comments for unquoted values but preserves hashes in quotes', () => {
      const input = `
        UNQUOTED=my_key_val # this is an inline comment
        QUOTED_HASH="my_key#with_hash"
      `;
      const parsed = parseEnvContent(input);

      expect(parsed.UNQUOTED).toBe('my_key_val');
      expect(parsed.QUOTED_HASH).toBe('my_key#with_hash');
    });

    it('returns empty object for empty or malformed strings safely', () => {
      expect(parseEnvContent('')).toEqual({});
      // @ts-expect-error test non-string guard
      expect(parseEnvContent(null)).toEqual({});
      // @ts-expect-error test undefined guard
      expect(parseEnvContent(undefined)).toEqual({});
      expect(parseEnvContent('   \n\n  ')).toEqual({});
    });
  });

  /* =========================================================================
   * 2. HOSTING PLATFORM PRECEDENCE VERIFICATION
   * ========================================================================= */
  describe('Hosting Platform Precedence', () => {
    it('does not overwrite existing environment variables set by hosting platform', () => {
      process.env.TEST_EXISTING_HOST_VAR = 'platform_production_value';

      const fileContent = 'TEST_EXISTING_HOST_VAR=local_file_value\nNEW_VAR=new_local_value';
      const parsed = parseEnvContent(fileContent);

      for (const [key, val] of Object.entries(parsed)) {
        if (process.env[key] === undefined || process.env[key] === '') {
          process.env[key] = val;
        }
      }

      // Precedence check: platform value remains untouched
      expect(process.env.TEST_EXISTING_HOST_VAR).toBe('platform_production_value');
      // Missing variable was populated
      expect(process.env.NEW_VAR).toBe('new_local_value');
    });
  });

  /* =========================================================================
   * 3. SERVER-SIDE GEMINI HANDLER PROTOCOL & HEADER VERIFICATION
   * ========================================================================= */
  describe('Gemini Server Handler Credentials & Security Protocol', () => {
    it('returns structured NO_API_KEY error when GEMINI_API_KEY is missing or empty', async () => {
      const res = await handleGeminiRequest({
        messages: [{ id: '1', role: 'user', content: 'Help with tap leak', timestamp: Date.now() }],
        apiKey: '',
      });

      expect(res.status).toBe(400);
      expect(res.data.error).toBe('NO_API_KEY');
      expect(res.data.message).toContain('API Configuration Required: GEMINI_API_KEY is not configured');
    });

    it('returns structured NO_API_KEY error when GEMINI_API_KEY contains placeholder text', async () => {
      const res = await handleGeminiRequest({
        messages: [{ id: '1', role: 'user', content: 'Help with tap leak', timestamp: Date.now() }],
        apiKey: 'your-google-gemini-api-key-here',
      });

      expect(res.status).toBe(400);
      expect(res.data.error).toBe('NO_API_KEY');
    });

    it('passes API key via x-goog-api-key header and NOT in URL query string', async () => {
      let capturedUrl = '';
      let capturedHeaders: Record<string, string> = {};

      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url, init) => {
        capturedUrl = url.toString();
        capturedHeaders = (init?.headers || {}) as Record<string, string>;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [{ text: 'Here is diagnostic guidance for your plumbing problem.' }],
                },
              },
            ],
          }),
        } as Response;
      });

      const testApiKey = 'AIzaSyTestValidKey1234567890';
      const res = await handleGeminiRequest({
        messages: [{ id: '1', role: 'user', content: 'Fix tap', timestamp: Date.now() }],
        apiKey: testApiKey,
      });

      expect(res.status).toBe(200);
      expect(res.data.reply).toContain('diagnostic guidance');

      // Key must NOT be in the URL query string
      expect(capturedUrl).not.toContain(testApiKey);
      expect(capturedUrl).not.toContain('?key=');

      // Key MUST be in the x-goog-api-key header
      expect(capturedHeaders['x-goog-api-key']).toBe(testApiKey);
    });

    it('redacts potential key fragments from error messages if upstream fails', async () => {
      const leakedKey = 'AIzaSyLeakedSecretKey123456789';
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new Error(`Failed to connect with token ${leakedKey}`)
      );

      const res = await handleGeminiRequest({
        messages: [{ id: '1', role: 'user', content: 'Fix breaker', timestamp: Date.now() }],
        apiKey: 'valid-test-key',
      });

      expect(res.status).toBe(500);
      expect(res.data.error).toBe('NETWORK_ERROR');
      // Must NOT contain the raw key
      expect(res.data.message).not.toContain(leakedKey);
      expect(res.data.message).toContain('[REDACTED]');
    });
  });

  /* =========================================================================
   * 4. CLIENT BUNDLE & BROWSER ISOLATION (ZERO LEAKAGE)
   * ========================================================================= */
  describe('Client Bundle & Browser Isolation', () => {
    it('ensures VITE_GEMINI_API_KEY does NOT exist anywhere in client environment', () => {
      // @ts-expect-error verifying non-existence
      expect(import.meta.env.VITE_GEMINI_API_KEY).toBeUndefined();
      // @ts-expect-error verifying non-existence
      expect(window.VITE_GEMINI_API_KEY).toBeUndefined();
    });

    it('ensures window environment does not leak GEMINI_API_KEY to browser client', () => {
      // @ts-expect-error verifying non-existence
      expect(window.GEMINI_API_KEY).toBeUndefined();
    });

    it('verifies that the production client bundle does not contain the actual GEMINI_API_KEY', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const distDir = path.resolve(process.cwd(), 'dist');
      if (fs.existsSync(distDir)) {
        const assetsDir = path.join(distDir, 'assets');
        if (fs.existsSync(assetsDir)) {
          const files = fs.readdirSync(assetsDir);
          const jsFile = files.find((f) => f.endsWith('.js'));
          if (jsFile && process.env.GEMINI_API_KEY) {
            const bundleContent = fs.readFileSync(path.join(assetsDir, jsFile), 'utf8');
            expect(bundleContent.includes(process.env.GEMINI_API_KEY)).toBe(false);
          }
        }
      }
    });
  });
});
