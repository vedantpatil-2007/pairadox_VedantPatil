import { ChatMessage, AIConversationContext } from '../src/services/ai/types';

export const DEFAULT_GEMINI_MODEL: string;
export const SKILLNEAR_SYSTEM_INSTRUCTION: string;

export interface GeminiHandlerParams {
  messages: ChatMessage[];
  context?: AIConversationContext;
  apiKey?: string;
  model?: string;
}

export interface GeminiHandlerResponse {
  status: number;
  data: {
    reply?: string;
    draftRequest?: any;
    suggestedPrompts?: string[];
    model?: string;
    providerName?: string;
    isFallback?: boolean;
    usageNotice?: string;
    error?: string;
    message?: string;
    latencyMs?: number;
    upstreamStatus?: number;
  };
}

export function handleGeminiRequest(params: GeminiHandlerParams): Promise<GeminiHandlerResponse>;
