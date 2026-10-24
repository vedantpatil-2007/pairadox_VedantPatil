/**
 * SkillNear Production AI Concierge Server
 *
 * Standalone, production-ready backend endpoint handler for SkillNear AI Concierge.
 * Built using native Node.js (zero external dependencies).
 *
 * Usage:
 *   node server/productionServer.js
 * Or via npm:
 *   npm run server
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleGeminiRequest, DEFAULT_GEMINI_MODEL } from './geminiHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

/**
 * Pure parser for .env file contents.
 * - Handles Windows CRLF (\r\n) and Unix LF (\n).
 * - Strips leading/trailing whitespace.
 * - Strips surrounding matching quotes (' or ").
 * - Strips unquoted inline comments (#).
 * - Ignores empty lines and full comment lines.
 */
export function parseEnvContent(content) {
  const result = {};
  if (!content || typeof content !== 'string') return result;

  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx <= 0) continue;

    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();

    // Remove matching surrounding quotes ("..." or '...')
    if (
      (val.startsWith('"') && val.endsWith('"') && val.length >= 2) ||
      (val.startsWith("'") && val.endsWith("'") && val.length >= 2)
    ) {
      val = val.slice(1, -1);
    } else {
      // For unquoted values, strip trailing inline comments
      const commentIdx = val.indexOf('#');
      if (commentIdx >= 0) {
        val = val.slice(0, commentIdx).trim();
      }
    }

    result[key] = val;
  }
  return result;
}

/**
 * Loads local environment files (.env.local, .env) into process.env.
 *
 * PRECEDENCE GUARANTEE:
 * 1. Hosting platform / system / container environment variables ALWAYS take precedence.
 * 2. .env.local takes precedence over .env for local development overrides.
 * 3. Never overwrites any key already defined in process.env.
 */
export function loadLocalEnv(baseDir = rootDir) {
  const envCandidates = ['.env.local', '.env'];
  for (const filename of envCandidates) {
    const filePath = path.join(baseDir, filename);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const parsed = parseEnvContent(content);
        for (const [key, val] of Object.entries(parsed)) {
          // Hosting platform precedence: NEVER overwrite an existing environment variable
          if (process.env[key] === undefined || process.env[key] === '') {
            process.env[key] = val;
          }
        }
      } catch (err) {
        console.warn(`[Server] Warning reading ${filename}:`, err.message);
      }
    }
  }
}

// Load local environment files if present (hosting platform env vars take precedence)
loadLocalEnv();

const PORT = process.env.PORT || 3001;

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.mjs': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.map': 'application/json; charset=UTF-8',
  '.txt': 'text/plain; charset=UTF-8',
};

const server = http.createServer(async (req, res) => {
  // Set standard CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // 1. Health check endpoint
  if (req.method === 'GET' && url.pathname === '/api/ai-concierge/health') {
    const activeKey = process.env.GEMINI_API_KEY;
    const activeModel = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
    const hasKey = Boolean(activeKey && !activeKey.includes('your-google-gemini-api-key'));

    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'SkillNear AI Concierge (Production Server)',
        model: activeModel,
        hasKey,
        freeTierOnly: true,
      })
    );
    return;
  }

  // 2. Main AI Concierge chat endpoint
  if (req.method === 'POST' && url.pathname === '/api/ai-concierge') {
    let rawBody = '';
    req.on('data', (chunk) => {
      rawBody += chunk;
      // Guard against payloads exceeding 2MB
      if (rawBody.length > 2 * 1024 * 1024) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'PAYLOAD_TOO_LARGE', message: 'Request payload too large' }));
        req.destroy();
      }
    });

    req.on('end', async () => {
      res.setHeader('Content-Type', 'application/json');
      let parsed;
      try {
        parsed = JSON.parse(rawBody || '{}');
      } catch {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'INVALID_JSON', message: 'Malformed JSON payload' }));
        return;
      }

      const activeKey = process.env.GEMINI_API_KEY;
      const activeModel = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;

      const result = await handleGeminiRequest({
        messages: parsed.messages,
        context: parsed.context,
        apiKey: activeKey,
        model: activeModel,
      });

      res.writeHead(result.status);
      res.end(JSON.stringify(result.data));
    });
    return;
  }

  // 3. Fallback 404 for unknown API routes
  if (url.pathname.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'NOT_FOUND', message: 'API route not found' }));
    return;
  }

  // 4. Static Frontend & SPA Client-Side Routing
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed\n');
    return;
  }

  const distDir = path.resolve(rootDir, 'dist');
  const indexHtmlPath = path.join(distDir, 'index.html');

  let cleanPath = '/';
  try {
    cleanPath = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request\n');
    return;
  }

  // Guard against null-byte injection
  if (cleanPath.includes('\0')) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request\n');
    return;
  }

  // Safe path normalization inside dist/
  const safeSuffix = path.normalize(cleanPath).replace(/^(\.\.[\/\\])+/, '');
  const candidateFilePath = path.join(distDir, safeSuffix);

  // Security: prevent directory traversal outside dist/
  const resolvedPath = path.resolve(candidateFilePath);
  if (!resolvedPath.startsWith(distDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden\n');
    return;
  }

  // Check if candidate is an existing file on disk
  let candidateStat = null;
  try {
    if (fs.existsSync(resolvedPath)) {
      candidateStat = fs.statSync(resolvedPath);
    }
  } catch {
    candidateStat = null;
  }

  // If candidate is a direct static file, serve it with proper MIME & caching headers
  if (candidateStat && candidateStat.isFile()) {
    const ext = path.extname(resolvedPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const isHashedAsset = cleanPath.startsWith('/assets/');
    const cacheControl = isHashedAsset
      ? 'public, max-age=31536000, immutable'
      : 'no-cache';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': candidateStat.size,
      'Cache-Control': cacheControl,
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    const stream = fs.createReadStream(resolvedPath);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
      }
      res.end('Internal Server Error\n');
    });
    stream.pipe(res);
    return;
  }

  // If candidate had a file extension that does not exist (e.g. missing asset), return 404
  // rather than returning index.html (which would break script/stylesheet execution in browsers)
  const ext = path.extname(cleanPath).toLowerCase();
  if (ext && ext !== '.html') {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('File Not Found\n');
    return;
  }

  // SPA Route Fallback: Serve dist/index.html for client-side navigation (/technicians, /portal, etc.)
  if (fs.existsSync(indexHtmlPath)) {
    const indexStat = fs.statSync(indexHtmlPath);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=UTF-8',
      'Content-Length': indexStat.size,
      'Cache-Control': 'no-cache',
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    const stream = fs.createReadStream(indexHtmlPath);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
      }
      res.end('Internal Server Error\n');
    });
    stream.pipe(res);
    return;
  }

  // Fallback if dist/ directory has not been built yet
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=UTF-8' });
  res.end(
    'SkillNear Production Server is running.\n' +
    'Frontend build not found in dist/. Please run "npm run build" to generate static assets.\n'
  );
});

// Only bind listener when executed directly from CLI/npm run server (not when imported in tests)
const isDirectExecution =
  process.argv[1] &&
  (process.argv[1].endsWith('productionServer.js') ||
    process.argv[1].endsWith('productionServer'));

if (isDirectExecution) {
  server.listen(PORT, () => {
    const activeKey = process.env.GEMINI_API_KEY;
    const activeModel = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
    console.log(`[SkillNear AI Production Server] Listening on http://localhost:${PORT}`);
    console.log(`[SkillNear AI Production Server] Target model: ${activeModel} (Free Tier)`);
    console.log(
      `[SkillNear AI Production Server] GEMINI_API_KEY configured: ${Boolean(
        activeKey && !activeKey.includes('your-google-gemini-api-key')
      )}`
    );
  });
}

export default server;
