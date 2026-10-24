import { ChatMessage, AIConversationContext, AIProvider, DraftServiceRequest, AIErrorCode } from './types';
import { LiveGeminiConciergeProvider, LiveAIError } from './serverProxyProvider';

const STORAGE_KEY = 'skillnear_ai_chat_session_v1';
const CONSENT_STORAGE_KEY = 'skillnear_gemini_consent_v1';
const MIN_SEND_INTERVAL_MS = 1200; // Rate limit: at least 1.2s between user messages
export const MAX_MESSAGE_LENGTH = 1000;

export const INITIAL_SUGGESTED_PROMPTS = [
  'Help me understand a home repair problem.',
  'Find the appropriate service category.',
  'Help me create a service request.',
  'Compare two quotes.',
  'Explain my Repair Passport.',
  'How does SkillNear work?',
];

export function createInitialGreeting(): ChatMessage {
  return {
    id: 'msg-welcome-0',
    role: 'assistant',
    content:
      "Hello! I'm **SkillNear AI**, your live assistant powered by **Google Gemini 3.8 Flash**.\n\nI can help you diagnose home repairs, recommend the right trade category, draft a ScopeLock™ service specification, or explain your home's Repair Passport™.\n\nHow can I help you today?",
    timestamp: Date.now(),
    suggestedPrompts: [...INITIAL_SUGGESTED_PROMPTS],
    providerName: 'SkillNear AI (Gemini 3.8 Flash)',
    model: 'gemini-3.8-flash',
    isFallback: false,
  };
}

export class AIService {
  private static instance: AIService | null = null;
  private provider: AIProvider;
  private messages: ChatMessage[] = [];
  private lastSendTimestamp = 0;
  private activeDraft: DraftServiceRequest | null = null;

  constructor(provider?: AIProvider) {
    this.provider = provider || new LiveGeminiConciergeProvider();
    this.loadHistory();
  }

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  // Provider configuration
  public setProvider(provider: AIProvider) {
    this.provider = provider;
  }

  public getProviderName(): string {
    return this.provider.name;
  }

  public getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  public getActiveDraft(): DraftServiceRequest | null {
    return this.activeDraft;
  }

  public clearActiveDraft() {
    this.activeDraft = null;
  }

  // Informed User Consent Management
  public hasUserConsent(): boolean {
    try {
      return localStorage.getItem(CONSENT_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  public setUserConsent(consent: boolean): void {
    try {
      if (consent) {
        localStorage.setItem(CONSENT_STORAGE_KEY, 'true');
      } else {
        localStorage.removeItem(CONSENT_STORAGE_KEY);
      }
    } catch (e) {
      console.warn('[AIService] Failed to update consent in localStorage', e);
    }
  }

  public resetRateLimitForTesting() {
    this.lastSendTimestamp = 0;
  }

  private loadHistory(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.messages = parsed;
          const lastWithDraft = [...parsed].reverse().find((m) => m.draftRequest);
          if (lastWithDraft) {
            this.activeDraft = lastWithDraft.draftRequest;
          }
          return;
        }
      }
    } catch (e) {
      console.warn('[AIService] Failed to parse stored chat history', e);
    }

    // Default: initialize with greeting
    this.messages = [createInitialGreeting()];
    this.saveHistory();
  }

  private saveHistory(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.messages));
    } catch (e) {
      console.warn('[AIService] Failed to save chat history to localStorage', e);
    }
  }

  public clearConversation(): void {
    this.messages = [createInitialGreeting()];
    this.activeDraft = null;
    this.lastSendTimestamp = 0;
    this.saveHistory();
  }

  public async sendMessage(
    content: string,
    context?: AIConversationContext
  ): Promise<ChatMessage> {
    const trimmed = content.trim();

    // 1. Validation: Non-empty
    if (!trimmed) {
      throw new Error('Please enter a question or describe your repair issue.');
    }

    // 2. Validation: Max length
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      throw new Error(
        `Message is too long (${trimmed.length} characters). Please keep it under ${MAX_MESSAGE_LENGTH} characters.`
      );
    }

    // 3. Validation: Informed User Consent Invariant
    if (!this.hasUserConsent()) {
      throw new LiveAIError(
        'Informed User Consent Required: Please review and accept the Gemini AI data processing disclosure before sending messages.',
        'CONSENT_REQUIRED'
      );
    }

    // 4. Validation: Rate limiting
    const now = Date.now();
    if (now - this.lastSendTimestamp < MIN_SEND_INTERVAL_MS) {
      const remainingSecs = Math.ceil((MIN_SEND_INTERVAL_MS - (now - this.lastSendTimestamp)) / 1000);
      throw new Error(`Please wait a moment (${remainingSecs}s) before sending another message.`);
    }
    this.lastSendTimestamp = now;

    // 5. Create and push user message
    const userMsg: ChatMessage = {
      id: `msg-user-${now}`,
      role: 'user',
      content: trimmed,
      timestamp: now,
    };
    this.messages.push(userMsg);
    this.saveHistory();

    // 6. Query Live Gemini Provider
    try {
      const response = await this.provider.sendMessage(this.messages, context);

      const assistantMsg: ChatMessage = {
        id: `msg-asst-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        timestamp: Date.now(),
        draftRequest: response.draftRequest,
        suggestedPrompts: response.suggestedPrompts,
        providerName: response.providerName,
        model: response.model || 'gemini-3.8-flash',
        isFallback: false,
        latencyMs: response.latencyMs,
        upstreamStatus: response.upstreamStatus,
      };

      if (response.draftRequest) {
        this.activeDraft = response.draftRequest;
      }

      this.messages.push(assistantMsg);
      this.saveHistory();

      return assistantMsg;
    } catch (err: unknown) {
      const errorCode = (err as { code?: AIErrorCode })?.code || 'UPSTREAM_ERROR';
      const errorMessage =
        err instanceof Error ? err.message : 'An unexpected error occurred connecting to Gemini.';
      const latencyMs = (err as { latencyMs?: number })?.latencyMs;
      const upstreamStatus = (err as { upstreamStatus?: number })?.upstreamStatus;

      const errorMsg: ChatMessage = {
        id: `msg-err-${Date.now()}`,
        role: 'assistant',
        content: errorMessage,
        timestamp: Date.now(),
        isError: true,
        errorCode,
        suggestedPrompts: [...INITIAL_SUGGESTED_PROMPTS.slice(0, 3)],
        providerName: this.provider.name,
        isFallback: false,
        latencyMs,
        upstreamStatus,
      };

      this.messages.push(errorMsg);
      this.saveHistory();
      return errorMsg;
    }
  }
}

export const aiService = AIService.getInstance();
