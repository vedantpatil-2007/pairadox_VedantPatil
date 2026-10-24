import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  X,
  Send,
  RotateCcw,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Lock,
  Users,
  IndianRupee,
  AlertCircle,
  HelpCircle,
  Info,
  CheckCircle2,
  Terminal,
  ExternalLink,
} from 'lucide-react';
import { aiService, MAX_MESSAGE_LENGTH, INITIAL_SUGGESTED_PROMPTS } from '../services/ai/aiService';
import { ChatMessage, DraftServiceRequest, AIConversationContext } from '../services/ai/types';
import { Trade } from '../types';

interface AIConciergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRequestWithDraft: (draft: DraftServiceRequest) => void;
  userLocationName?: string;
  activeTrade?: Trade | null;
  activeRequestId?: string | null;
}

// Client-side detection of immediate life-safety physical emergencies
export function checkEmergencyHazardKeywords(text: string): { isHazard: boolean; type: 'gas' | 'electrical' | null } {
  if (!text) return { isHazard: false, type: null };
  const q = text.toLowerCase();
  if (
    q.includes('gas leak') ||
    q.includes('smell gas') ||
    q.includes('lpg leak') ||
    q.includes('cylinder leak') ||
    q.includes('gas cylinder')
  ) {
    return { isHazard: true, type: 'gas' };
  }
  if (
    q.includes('sparking') ||
    q.includes('sparks from') ||
    q.includes('electric shock') ||
    q.includes('smoke from board') ||
    q.includes('burning wire') ||
    q.includes('switchboard burning')
  ) {
    return { isHazard: true, type: 'electrical' };
  }
  return { isHazard: false, type: null };
}

// Lightweight, safe text formatter for assistant replies
function FormattedMessageContent({ content }: { content: string }) {
  const lines = content.split('\n');

  return (
    <div className="space-y-2 text-sm leading-relaxed text-slate-800">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }

        // Bullet point
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
          const bulletText = trimmed.substring(2);
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="text-sky-500 font-bold shrink-0 mt-0.5">•</span>
              <span>{renderBoldSegments(bulletText)}</span>
            </div>
          );
        }

        // Numbered list item
        const matchNumber = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (matchNumber) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="text-sky-600 font-bold text-xs shrink-0 mt-0.5">
                {matchNumber[1]}.
              </span>
              <span>{renderBoldSegments(matchNumber[2])}</span>
            </div>
          );
        }

        // Heading lines
        if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
          const headingText = trimmed.replace(/^#+\s*/, '');
          return (
            <h4 key={idx} className="font-bold text-slate-900 text-sm pt-1">
              {renderBoldSegments(headingText)}
            </h4>
          );
        }

        // Standard paragraph
        return (
          <p key={idx} className="break-words">
            {renderBoldSegments(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

// Parses **bold** and `code` segments safely
function renderBoldSegments(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={index} className="px-1 py-0.5 rounded bg-slate-100 text-sky-800 text-xs font-mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export const AIConciergeModal: React.FC<AIConciergeModalProps> = ({
  isOpen,
  onClose,
  onOpenRequestWithDraft,
  userLocationName,
  activeTrade,
  activeRequestId,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasConsent, setHasConsent] = useState<boolean>(() => aiService.hasUserConsent());
  const [validationError, setValidationError] = useState<string | null>(null);
  const [activeHazardAlert, setActiveHazardAlert] = useState<'gas' | 'electrical' | null>(null);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Sync state on open
  useEffect(() => {
    if (isOpen) {
      setMessages(aiService.getMessages());
      setHasConsent(aiService.hasUserConsent());
      setTimeout(() => {
        if (hasConsent) {
          inputRef.current?.focus();
        }
        scrollToBottom();
      }, 100);
    }
  }, [isOpen, hasConsent]);

  // Auto-scroll on new message
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, hasConsent]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const scrollToBottom = () => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  };

  const handleGrantConsent = () => {
    aiService.setUserConsent(true);
    setHasConsent(true);
    setValidationError(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const rawContent = textToSend !== undefined ? textToSend : inputText;
    const trimmed = rawContent.trim();

    if (!hasConsent) {
      setValidationError('Please review and accept the Gemini AI disclosure before sending messages.');
      return;
    }

    if (!trimmed) {
      setValidationError('Please enter a question or select a suggested prompt.');
      return;
    }

    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      setValidationError(`Message is too long. Limit is ${MAX_MESSAGE_LENGTH} characters.`);
      return;
    }

    // Check emergency keywords for immediate client-side safety guardrail banner
    const hazardCheck = checkEmergencyHazardKeywords(trimmed);
    if (hazardCheck.isHazard) {
      setActiveHazardAlert(hazardCheck.type);
    }

    setValidationError(null);
    setInputText('');
    setIsLoading(true);

    const context: AIConversationContext = {
      userLocationName,
      activeTrade,
      activeRequestId,
    };

    try {
      await aiService.sendMessage(trimmed, context);
      setMessages(aiService.getMessages());
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : 'Error sending message';
      setValidationError(errMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleResetChat = () => {
    aiService.clearConversation();
    setMessages(aiService.getMessages());
    setValidationError(null);
    setActiveHazardAlert(null);
  };

  const handleRetryLast = () => {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMessage) {
      handleSendMessage(lastUserMessage.content);
    }
  };

  if (!isOpen) return null;

  const lastMessage = messages[messages.length - 1];
  const suggestedPrompts =
    lastMessage?.suggestedPrompts && lastMessage.suggestedPrompts.length > 0
      ? lastMessage.suggestedPrompts
      : INITIAL_SUGGESTED_PROMPTS;

  return (
    <div
      role="dialog"
      aria-label="SkillNear AI Concierge"
      aria-modal="true"
      className="fixed inset-0 sm:inset-auto sm:bottom-5 sm:right-5 sm:w-[440px] sm:h-[620px] sm:max-h-[85vh] z-50 flex flex-col bg-white sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-sky-600 via-sky-700 to-indigo-700 text-white shrink-0 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center backdrop-blur-xs ring-1 ring-white/20">
            <Sparkles className="w-4 h-4 text-sky-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm tracking-tight">SkillNear AI</h2>
              <span className="text-[10px] font-semibold bg-emerald-500/30 text-emerald-100 border border-emerald-400/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Gemini 3.8 Flash (Live)
              </span>
            </div>
            <p className="text-[11px] text-sky-100/80">
              Live AI Marketplace Concierge & Scope Advisor
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleResetChat}
            className="p-1.5 text-sky-200 hover:text-white hover:bg-white/15 rounded-lg transition-colors cursor-pointer"
            title="Start New Conversation"
            aria-label="Reset Conversation"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-sky-200 hover:text-white hover:bg-white/15 rounded-lg transition-colors cursor-pointer"
            aria-label="Close SkillNear AI Concierge"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Emergency Physical Safety Guardrail Banner (Client-Side Protection) */}
      {activeHazardAlert && (
        <div className="px-4 py-2.5 bg-rose-600 text-white text-xs flex items-start gap-2 shadow-sm shrink-0">
          <AlertTriangle className="w-4 h-4 text-rose-200 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold tracking-tight">
              {activeHazardAlert === 'gas'
                ? 'EMERGENCY SAFETY GUARDRAIL: GAS LEAK HAZARD'
                : 'EMERGENCY SAFETY GUARDRAIL: ELECTRICAL HAZARD'}
            </p>
            <p className="text-[11px] text-rose-100 leading-snug">
              {activeHazardAlert === 'gas'
                ? 'Immediately shut off the main cylinder valve, do not touch electrical switches or appliances, cross-ventilate, evacuate, and call emergency services (112) from outside.'
                : 'Immediately shut off the main MCB power switch/breaker. Avoid touching switchboards or standing water. A licensed technician is required for live circuit isolation.'}
            </p>
          </div>
        </div>
      )}

      {/* Messages Feed */}
      <div
        ref={chatScrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50"
      >
        {/* Informed User Consent Disclosure Card (Before first external Gemini request) */}
        {!hasConsent && (
          <div className="p-4 bg-indigo-50/90 border border-indigo-200 rounded-2xl space-y-3 shadow-xs">
            <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
              <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
              <span>Informed User Consent & Disclosure</span>
            </div>
            <p className="text-xs text-indigo-950/80 leading-relaxed">
              SkillNear AI is powered by live <strong>Google Gemini 3.8 Flash</strong>.
              Before continuing, please note:
            </p>
            <ul className="text-xs text-indigo-900/90 space-y-1.5 list-disc list-inside">
              <li>
                <strong>Data Processing:</strong> Your messages will be sent to Google's Gemini API for real-time analysis.
              </li>
              <li>
                <strong>Privacy Shield:</strong> Personal phone numbers, email addresses, and payment card numbers are automatically redacted client-side before transmission.
              </li>
              <li>
                <strong>Customer Control:</strong> The AI only drafts proposals for inspection. It will <em>never</em> book workers, spend funds, or submit requests autonomously.
              </li>
            </ul>
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleGrantConsent}
                className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                I Consent & Continue
              </button>
              <button
                type="button"
                onClick={onClose}
                className="py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
              >
                Decline
              </button>
            </div>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.role === 'user';

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm shadow-xs ${
                  isUser
                    ? 'bg-sky-600 text-white rounded-br-xs'
                    : msg.isError
                    ? 'bg-rose-50 text-rose-900 border border-rose-200 rounded-bl-xs'
                    : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs'
                }`}
              >
                {!isUser && (
                  <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-100 text-[11px] text-slate-400">
                    <span className="font-semibold text-sky-700 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-sky-500" />
                      {msg.providerName || 'SkillNear AI'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {typeof msg.latencyMs === 'number' && msg.latencyMs > 0 && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          {(msg.latencyMs / 1000).toFixed(1)}s
                        </span>
                      )}
                      <span className="text-[10px] bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.5 rounded font-mono font-medium">
                        {msg.model || 'gemini-3.8-flash'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Message Body or Specific Live Error Card */}
                {isUser ? (
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                ) : msg.isError ? (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-rose-950 text-xs">
                          {msg.errorCode === 'NO_API_KEY'
                            ? 'API Configuration Required'
                            : msg.errorCode === 'QUOTA_EXCEEDED'
                            ? 'Free-Tier Quota Exceeded'
                            : msg.errorCode === 'UNAUTHORIZED'
                            ? 'Invalid API Key'
                            : msg.errorCode === 'MODEL_UNAVAILABLE'
                            ? 'Model Unavailable'
                            : msg.errorCode === 'TIMEOUT' || msg.errorCode === 'CLIENT_TIMEOUT'
                            ? 'Gemini Request Timed Out'
                            : msg.errorCode === 'PROXY_UNREACHABLE'
                            ? 'Server Proxy Unreachable'
                            : msg.errorCode === 'UPSTREAM_5XX'
                            ? 'Gemini Service Error'
                            : msg.errorCode === 'EMPTY_RESPONSE'
                            ? 'Empty Response from Gemini'
                            : 'Gemini Temporarily Unavailable'}
                        </h4>
                        <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                          {msg.content}
                        </p>
                        {typeof msg.latencyMs === 'number' && msg.latencyMs > 0 && (
                          <div className="text-[10px] font-mono text-rose-700/80 mt-1">
                            {msg.upstreamStatus ? `HTTP ${msg.upstreamStatus} • ` : ''}
                            {(msg.latencyMs / 1000).toFixed(1)}s elapsed
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Step-by-step API setup instructions if API key is missing */}
                    {msg.errorCode === 'NO_API_KEY' && (
                      <div className="p-2.5 bg-white/80 border border-rose-200 rounded-xl text-[11px] text-slate-700 space-y-1 font-mono">
                        <div className="font-bold text-slate-900 flex items-center gap-1 font-sans text-xs">
                          <Terminal className="w-3.5 h-3.5 text-slate-600" />
                          How to configure GEMINI_API_KEY:
                        </div>
                        <p>1. Visit Google AI Studio: https://aistudio.google.com</p>
                        <p>2. Create a free-tier Gemini API key ($0 cost, no billing).</p>
                        <p>3. In project root, add to .env:</p>
                        <p className="bg-slate-100 p-1 rounded font-bold text-sky-900">
                          GEMINI_API_KEY=your_actual_key_here
                        </p>
                        <p className="font-sans text-[10px] text-slate-500">
                          (Server-side only. Never add VITE_ prefix to keep keys out of client bundles.)
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <FormattedMessageContent content={msg.content} />
                )}

                {/* ScopeLock™ Draft Service Request Preview Card */}
                {msg.draftRequest && (
                  <div className="mt-3 p-3 bg-gradient-to-br from-indigo-50/80 to-sky-50/80 border border-indigo-200 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" /> ScopeLock™ Draft Proposal
                      </span>
                      <span className="text-xs font-semibold text-slate-700 capitalize">
                        {msg.draftRequest.category.replace('_', ' ')}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">
                        {msg.draftRequest.title}
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">
                        {msg.draftRequest.description}
                      </p>
                    </div>

                    {/* Metadata chips */}
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 pt-1">
                      {msg.draftRequest.budget && (
                        <span className="flex items-center gap-0.5 bg-white px-2 py-0.5 rounded border border-slate-200 font-medium">
                          <IndianRupee className="w-3 h-3 text-slate-500" />
                          Est. Budget: ₹{msg.draftRequest.budget}
                        </span>
                      )}
                      {msg.draftRequest.crew_size && msg.draftRequest.crew_size > 1 && (
                        <span className="flex items-center gap-0.5 bg-white px-2 py-0.5 rounded border border-slate-200 font-medium text-indigo-700">
                          <Users className="w-3 h-3 text-indigo-500" />
                          Crew: {msg.draftRequest.crew_size} Techs
                        </span>
                      )}
                    </div>

                    {/* Tasks checklist preview */}
                    {msg.draftRequest.scope?.tasks && msg.draftRequest.scope.tasks.length > 0 && (
                      <div className="text-[11px] space-y-1 bg-white/70 p-2 rounded-lg border border-indigo-100/60">
                        <div className="font-semibold text-slate-700 text-[10px] uppercase">
                          ScopeLock Deliverables:
                        </div>
                        <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                          {msg.draftRequest.scope.tasks.slice(0, 3).map((task, i) => (
                            <li key={i} className="truncate">{task}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Review and Edit in Post Form Button */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (msg.draftRequest) {
                            onOpenRequestWithDraft(msg.draftRequest);
                          }
                        }}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                      >
                        <span>Review & Edit in Post Job Form</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <p className="text-[10px] text-center text-slate-500 mt-1">
                        AI drafts for inspection. You review and confirm before posting.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {msg.isError && (
                <div className="flex items-center gap-3 mt-1">
                  <button
                    type="button"
                    onClick={handleRetryLast}
                    className="text-xs text-rose-600 hover:text-rose-800 font-medium flex items-center gap-1 underline cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" /> Retry with Gemini
                  </button>
                  <button
                    type="button"
                    onClick={handleResetChat}
                    className="text-xs text-slate-500 hover:text-slate-800 font-medium underline cursor-pointer"
                  >
                    Start New Conversation
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-center gap-2.5 p-3 bg-white border border-slate-200 rounded-2xl rounded-bl-xs text-xs text-slate-600 max-w-[80%] shadow-xs">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-sky-500 animate-bounce" />
              <span className="w-2 h-2 rounded-full bg-sky-500 animate-bounce [animation-delay:0.2s]" />
              <span className="w-2 h-2 rounded-full bg-sky-500 animate-bounce [animation-delay:0.4s]" />
            </div>
            <span>Connecting to live Gemini 3.8 Flash...</span>
          </div>
        )}
      </div>

      {/* Suggested Prompts Pill Section */}
      {!isLoading && hasConsent && suggestedPrompts && suggestedPrompts.length > 0 && (
        <div className="px-3 py-2 bg-slate-100/80 border-t border-slate-200/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider shrink-0 flex items-center gap-1">
            <HelpCircle className="w-3 h-3 text-slate-400" />
            Suggested:
          </span>
          {suggestedPrompts.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(prompt)}
              className="text-xs px-2.5 py-1 rounded-full bg-white hover:bg-sky-50 text-slate-700 hover:text-sky-700 border border-slate-200 hover:border-sky-300 font-medium whitespace-nowrap transition-colors shadow-2xs shrink-0 cursor-pointer"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input Composer */}
      <div className="p-3 bg-white border-t border-slate-200 shrink-0">
        {validationError && (
          <div className="flex items-center gap-1.5 text-xs text-rose-600 mb-2 font-medium">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-end gap-2"
        >
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              rows={2}
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                if (validationError) setValidationError(null);
              }}
              onKeyDown={handleKeyDown}
              disabled={isLoading || !hasConsent}
              placeholder={
                hasConsent
                  ? 'Ask about a repair, request draft, or trade advice...'
                  : 'Please accept the Gemini disclosure above to chat...'
              }
              className="w-full text-xs sm:text-sm p-2.5 rounded-xl border border-slate-300 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 resize-none outline-none text-slate-800 placeholder-slate-400 disabled:bg-slate-100 disabled:cursor-not-allowed"
            />
            <div className="absolute right-2 bottom-2 text-[10px] text-slate-400 pointer-events-none">
              {inputText.length}/{MAX_MESSAGE_LENGTH}
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={isLoading || !inputText.trim() || !hasConsent}
            className="p-2.5 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl transition-colors shadow-xs shrink-0 cursor-pointer disabled:cursor-not-allowed"
            aria-label="Send message to SkillNear AI"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 px-1">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-sky-600" />
            Live Gemini 3.8 Flash • ScopeLock™ Protected
          </span>
          <span>Press Enter to send</span>
        </div>
      </div>
    </div>
  );
};
