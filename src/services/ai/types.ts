import { Trade, Urgency } from '../../types';

export interface DraftServiceRequest {
  category: Trade;
  title: string;
  description: string;
  urgency?: Urgency;
  budget?: number;
  crew_size?: number;
  organization_name?: string;
  duration_unit?: 'hours' | 'days';
  duration_value?: number;
  scope?: {
    tasks: string[];
    deliverables: string[];
    exclusions: string[];
  };
}

export type AIErrorCode =
  | 'NO_API_KEY'
  | 'QUOTA_EXCEEDED'
  | 'UNAUTHORIZED'
  | 'MODEL_UNAVAILABLE'
  | 'TIMEOUT'
  | 'CLIENT_TIMEOUT'
  | 'PROXY_UNREACHABLE'
  | 'NETWORK_ERROR'
  | 'EMPTY_RESPONSE'
  | 'UPSTREAM_5XX'
  | 'CONSENT_REQUIRED'
  | 'UPSTREAM_ERROR';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  draftRequest?: DraftServiceRequest;
  suggestedPrompts?: string[];
  isError?: boolean;
  errorCode?: AIErrorCode | string;
  providerName?: string;
  model?: string;
  isFallback?: boolean;
  latencyMs?: number;
  upstreamStatus?: number;
}

export interface AIProviderResponse {
  reply: string;
  draftRequest?: DraftServiceRequest;
  suggestedPrompts?: string[];
  providerName: string;
  isFallback: boolean;
  model?: string;
  usageNotice?: string;
  errorCode?: AIErrorCode | string;
  latencyMs?: number;
  upstreamStatus?: number;
}

export interface AIConversationContext {
  role?: 'customer' | 'worker';
  userLocationName?: string;
  activeTrade?: Trade | null;
  activeRequestId?: string | null;
}

export interface AIProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  sendMessage(
    messages: ChatMessage[],
    context?: AIConversationContext
  ): Promise<AIProviderResponse>;
}
