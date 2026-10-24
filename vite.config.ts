/// <reference types="vitest" />
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { handleGeminiRequest, DEFAULT_GEMINI_MODEL } from './server/geminiHandler.js'

/**
 * Resolves the server-side GEMINI_API_KEY dynamically at runtime.
 * Precedence:
 * 1. process.env.GEMINI_API_KEY (from system or hosting platform environment)
 * 2. Local root .env / .env.local file loaded dynamically via Vite's loadEnv()
 *
 * NOTE: Never expose this key in client bundles or via `define`.
 */
function getRuntimeGeminiApiKey(mode: string = 'development'): string | undefined {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    return process.env.GEMINI_API_KEY.trim();
  }
  const loaded = loadEnv(mode, process.cwd(), '');
  if (loaded.GEMINI_API_KEY && loaded.GEMINI_API_KEY.trim()) {
    // Synchronize to process.env securely on server-side only
    process.env.GEMINI_API_KEY = loaded.GEMINI_API_KEY.trim();
    return loaded.GEMINI_API_KEY.trim();
  }
  return undefined;
}

function aiConciergeDevProxyPlugin(mode: string = 'development'): Plugin {
  return {
    name: 'ai-concierge-proxy',
    configureServer(server) {
      // Health check endpoint for client to probe server proxy
      server.middlewares.use('/api/ai-concierge/health', (_req, res) => {
        const apiKey = getRuntimeGeminiApiKey(mode);
        const hasKey = Boolean(apiKey && !apiKey.includes('your-google-gemini-api-key'));

        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(
          JSON.stringify({
            status: 'ok',
            model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
            hasKey,
            freeTierOnly: true,
          })
        );
      });

      // Main chat completion endpoint
      server.middlewares.use('/api/ai-concierge', (req, res, next) => {
        if (req.method !== 'POST') {
          return next();
        }

        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });

        req.on('end', async () => {
          res.setHeader('Content-Type', 'application/json');
          let parsed;
          try {
            parsed = JSON.parse(body || '{}');
          } catch {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'INVALID_JSON', message: 'Malformed JSON payload' }));
            return;
          }

          const apiKey = getRuntimeGeminiApiKey(mode);
          const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;

          const result = await handleGeminiRequest({
            messages: parsed.messages,
            context: parsed.context,
            apiKey,
            model,
          });

          res.writeHead(result.status);
          res.end(JSON.stringify(result.data));
        });
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Vite does not automatically expose .env values through process.env during config evaluation.
  // We securely load the root .env variables and synchronize server-side variables
  // (GEMINI_API_KEY, GEMINI_MODEL) to process.env if not already set by the hosting environment.
  // Note: We deliberately do NOT use `define` or `VITE_` prefix to prevent bundle leakage.
  const env = loadEnv(mode, process.cwd(), '');
  if (env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = env.GEMINI_API_KEY.trim();
  }
  if (env.GEMINI_MODEL && !process.env.GEMINI_MODEL) {
    process.env.GEMINI_MODEL = env.GEMINI_MODEL.trim();
  }

  return {
    plugins: [react(), aiConciergeDevProxyPlugin(mode)],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      fileParallelism: false,
      testTimeout: 15000,
    },
  };
});
