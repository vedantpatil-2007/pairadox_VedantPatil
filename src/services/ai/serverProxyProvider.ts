import { AIProvider, AIProviderResponse, ChatMessage, AIConversationContext } from './types';

// Helper to sanitize PII from prompts before transmission
export function sanitizePII(text: string): string {
  if (!text) return '';
  return text
    // Email addresses
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]')
    // Phone numbers with country code or 10-digit formats (e.g. +91 98450 12345, 9845012345, 98450-12345)
    .replace(
      /(?:\+?\d{1,3}[-.\s]*)?(?:\d{5}[-.\s]*\d{5}|\d{4}[-.\s]*\d{3}[-.\s]*\d{3}|\d{3}[-.\s]*\d{3}[-.\s]*\d{4}|\b[6-9]\d{9}\b)/g,
      '[REDACTED_PHONE]'
    )
    // Card numbers (16 digits separated by space or hyphen)
    .replace(/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, '[REDACTED_CARD]');
}

export class LiveAIError extends Error {
  code: string;
  latencyMs?: number;
  upstreamStatus?: number;
  constructor(message: string, code: string, latencyMs?: number, upstreamStatus?: number) {
    super(message);
    this.name = 'LiveAIError';
    this.code = code;
    this.latencyMs = latencyMs;
    this.upstreamStatus = upstreamStatus;
  }
}

export class LiveGeminiConciergeProvider implements AIProvider {
  name = 'SkillNear AI (Live Gemini)';
  private endpoint = '/api/ai-concierge';

  constructor(endpoint?: string) {
    if (endpoint) this.endpoint = endpoint;
  }

  private getAbsoluteUrl(path: string): string {
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const origin =
      typeof window !== 'undefined' &&
      window.location?.origin &&
      window.location.origin !== 'null'
        ? window.location.origin
        : 'http://localhost:5173';
    return `${origin}${path}`;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(this.getAbsoluteUrl(`${this.endpoint}/health`), {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) return false;
      const data = await res.json();
      return Boolean(data.hasKey);
    } catch {
      return false;
    }
  }

  async sendMessage(
    messages: ChatMessage[],
    context?: AIConversationContext
  ): Promise<AIProviderResponse> {
    // 1. Sanitize messages before sending to server proxy
    const sanitizedMessages = messages.map((m) => ({
      ...m,
      content: m.role === 'user' ? sanitizePII(m.content) : m.content,
    }));

    let res: Response;
    // Client timeout of 90 seconds ensures the client does not prematurely abort
    // while the server (which uses an 85s upstream timeout) is legitimately waiting for Gemini.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    try {
      res = await fetch(this.getAbsoluteUrl(this.endpoint), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: sanitizedMessages,
          context,
        }),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const isAbort = err instanceof Error && err.name === 'AbortError';
      const code = isAbort ? 'CLIENT_TIMEOUT' : 'PROXY_UNREACHABLE';
      const message = isAbort
        ? 'Gemini request timed out after 90 seconds. Please click Retry.'
        : 'Gemini connectivity failed: Unable to connect to the SkillNear server proxy. Please verify your connection and click Retry.';
      throw new LiveAIError(message, code);
    }

    clearTimeout(timeoutId);

    // 2. Parse response body
    let data: any = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    // 3. Handle non-200 or structured error response from server
    if (!res.ok || data.error) {
      const errorCode = data.error || (res.status === 429 ? 'QUOTA_EXCEEDED' : 'UPSTREAM_ERROR');
      const errorMsg =
        data.message ||
        `Gemini API error (HTTP ${res.status}). Please verify API credentials and retry.`;

      // Live-Only Invariant: strictly throw live error, never fall back to offline chatbot
      throw new LiveAIError(errorMsg, errorCode, data.latencyMs, data.upstreamStatus || res.status);
    }

    if (!data.reply) {
      throw new LiveAIError(
        'Gemini returned an empty response. Please rephrase your question.',
        'EMPTY_RESPONSE',
        data.latencyMs,
        data.upstreamStatus || 200
      );
    }

    return {
      reply: data.reply,
      draftRequest: data.draftRequest,
      suggestedPrompts: data.suggestedPrompts,
      providerName: data.providerName || 'SkillNear AI (Gemini 3.8 Flash)',
      isFallback: false,
      model: data.model || 'gemini-3.8-flash',
      usageNotice: data.usageNotice || 'Powered by Google Gemini 3.8 Flash (Official Free Tier API)',
      latencyMs: data.latencyMs,
      upstreamStatus: data.upstreamStatus,
    };
  }
}

// Alias for backwards compatibility with existing imports
export const ServerProxyConciergeProvider = LiveGeminiConciergeProvider;
