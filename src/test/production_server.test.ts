import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import server from '../../server/productionServer.js';

describe('SkillNear Production Server — Static File & API Routing Suite', () => {
  let testPort: number;
  let baseUrl: string;

  beforeAll(async () => {
    // Start the server on an ephemeral port (0) for testing
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as { port: number };
        testPort = address.port;
        baseUrl = `http://127.0.0.1:${testPort}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  /* =========================================================================
   * 1. HEALTH AND API ENDPOINTS ON SAME ORIGIN
   * ========================================================================= */
  describe('AI Concierge API Endpoints', () => {
    it('responds to GET /api/ai-concierge/health with JSON and 200 OK', async () => {
      const res = await fetch(`${baseUrl}/api/ai-concierge/health`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/json');

      const data = await res.json();
      expect(data.status).toBe('ok');
      expect(data.service).toContain('SkillNear AI Concierge');
      expect(data.model).toBeDefined();
      expect(typeof data.hasKey).toBe('boolean');
      expect(data.freeTierOnly).toBe(true);
    });

    it('responds to OPTIONS with 204 No Content and CORS headers', async () => {
      const res = await fetch(`${baseUrl}/api/ai-concierge`, { method: 'OPTIONS' });
      expect(res.status).toBe(204);
      expect(res.headers.get('access-control-allow-origin')).toBe('*');
      expect(res.headers.get('access-control-allow-methods')).toContain('POST');
    });

    it('returns 404 JSON for non-existent API routes', async () => {
      const res = await fetch(`${baseUrl}/api/unknown-endpoint`);
      expect(res.status).toBe(404);
      expect(res.headers.get('content-type')).toContain('application/json');

      const data = await res.json();
      expect(data.error).toBe('NOT_FOUND');
    });
  });

  /* =========================================================================
   * 2. STATIC FILE SERVING FROM DIST/
   * ========================================================================= */
  describe('Static File Serving from dist/', () => {
    it('serves dist/index.html on root GET / with text/html', async () => {
      const res = await fetch(`${baseUrl}/`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');

      const html = await res.text();
      expect(html).toContain('<!doctype html>');
      expect(html).toContain('SkillNear');
    });

    it('serves favicon.svg directly with correct svg mime-type', async () => {
      const res = await fetch(`${baseUrl}/favicon.svg`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('image/svg+xml');
    });

    it('supports HEAD requests without transmitting body', async () => {
      const res = await fetch(`${baseUrl}/`, { method: 'HEAD' });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      const body = await res.text();
      expect(body).toBe('');
    });
  });

  /* =========================================================================
   * 3. SPA CLIENT-SIDE ROUTING & EXTENSION ISOLATION
   * ========================================================================= */
  describe('Frontend Routing (SPA Fallback) & Missing Asset 404', () => {
    it('serves index.html for client-side navigation routes (e.g. /technicians, /portal)', async () => {
      const resTechnicians = await fetch(`${baseUrl}/technicians`);
      expect(resTechnicians.status).toBe(200);
      expect(resTechnicians.headers.get('content-type')).toContain('text/html');
      const htmlTechnicians = await resTechnicians.text();
      expect(htmlTechnicians).toContain('<!doctype html>');

      const resPortal = await fetch(`${baseUrl}/portal`);
      expect(resPortal.status).toBe(200);
      expect(resPortal.headers.get('content-type')).toContain('text/html');
    });

    it('returns 404 (not HTML) for missing static assets with extensions (.js, .css, .png)', async () => {
      const resMissingJs = await fetch(`${baseUrl}/assets/nonexistent-bundle.js`);
      expect(resMissingJs.status).toBe(404);
      expect(resMissingJs.headers.get('content-type')).not.toContain('text/html');

      const resMissingCss = await fetch(`${baseUrl}/styles/missing.css`);
      expect(resMissingCss.status).toBe(404);
    });

    it('rejects POST to frontend static routes with 405 Method Not Allowed', async () => {
      const res = await fetch(`${baseUrl}/technicians`, { method: 'POST' });
      expect(res.status).toBe(405);
    });
  });

  /* =========================================================================
   * 4. SECURITY & TRAVERSAL GUARDS
   * ========================================================================= */
  describe('Security & Traversal Guards', () => {
    it('blocks directory traversal attempts outside dist/ with 403 Forbidden', async () => {
      // Direct raw socket request to bypass fetch client normalization
      const rawRequest = new Promise<number>((resolve) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: testPort,
            path: '/../../package.json',
            method: 'GET',
          },
          (res) => {
            resolve(res.statusCode || 0);
          }
        );
        req.end();
      });

      const statusCode = await rawRequest;
      // Either 403 Forbidden or normalized safe handling
      expect([403, 404]).toContain(statusCode);
    });
  });
});
