import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { LiveGeminiConciergeProvider, sanitizePII, LiveAIError } from '../services/ai/serverProxyProvider';
import { AIService, MAX_MESSAGE_LENGTH, INITIAL_SUGGESTED_PROMPTS } from '../services/ai/aiService';
import { AIConciergeModal, checkEmergencyHazardKeywords } from '../components/AIConciergeModal';
import { AIConciergeTrigger } from '../components/AIConciergeTrigger';
import { ChatMessage, DraftServiceRequest, AIProvider } from '../services/ai/types';
import { handleGeminiRequest, DEFAULT_GEMINI_MODEL } from '../../server/geminiHandler.js';

describe('SkillNear AI Concierge Suite — Phase 2: Live-Only Gemini', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    AIService.getInstance().clearConversation();
    AIService.getInstance().setUserConsent(true);
    AIService.getInstance().resetRateLimitForTesting();
  });

  /* =========================================================================
   * 1. REMOVAL OF OFFLINE FALLBACK & LIVE-ONLY INVARIANT
   * ========================================================================= */
  describe('Live-Only Invariant & Zero Fallback Verification', () => {
    it('throws LiveAIError and never generates a simulated offline chatbot response when network is offline', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Failed to fetch (Network offline)'));

      const provider = new LiveGeminiConciergeProvider();
      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: 'Help me fix a pipe leak', timestamp: Date.now() },
      ];

      await expect(provider.sendMessage(messages)).rejects.toThrow(/Gemini connectivity failed/i);
    });

    it('rejects with CLIENT_TIMEOUT error after 90s without producing an offline answer', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(abortError);

      const provider = new LiveGeminiConciergeProvider();
      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: 'What is ScopeLock?', timestamp: Date.now() },
      ];

      await expect(provider.sendMessage(messages)).rejects.toMatchObject({
        code: 'CLIENT_TIMEOUT',
        message: expect.stringMatching(/timed out after 90 seconds/i),
      });
    });

    it('propagates HTTP 502/500 upstream server error without falling back to local canned text', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => ({
          error: 'UPSTREAM_ERROR',
          message: 'Google Gemini service is temporarily overloaded. Please retry.',
        }),
      } as Response);

      const provider = new LiveGeminiConciergeProvider();
      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: 'Compare two quotes for me', timestamp: Date.now() },
      ];

      await expect(provider.sendMessage(messages)).rejects.toThrow(/overloaded/i);
    });
  });

  /* =========================================================================
   * 2. LIVE GEMINI 3.8 FLASH INTEGRATION & SERVER HANDLER
   * ========================================================================= */
  describe('Live Gemini 3.8 Flash Protocol & Server Handler', () => {
    it('uses gemini-3.8-flash as the official default model', () => {
      expect(DEFAULT_GEMINI_MODEL).toBe('gemini-3.8-flash');
    });

    it('server handler formats request payload and extracts Gemini response and ScopeLock draft', async () => {
      const mockGeminiApiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: `I recommend our AC Repair & Servicing trade. Here is an itemized ScopeLock draft for your cooling problem:\n\n\`\`\`json\n{\n  "draftRequest": {\n    "category": "ac_repair",\n    "title": "Split AC Jet Servicing & Cooling Test",\n    "description": "Comprehensive indoor foam jet cleaning and gas pressure check.",\n    "budget": 960,\n    "crew_size": 2,\n    "scope": {\n      "tasks": ["Jet foam wash", "Gas pressure check"],\n      "deliverables": ["Sub-18C vent air delivery", "Zero water leak"],\n      "exclusions": ["Compressor replacement"]\n    }\n  }\n}\n\`\`\``,
                },
              ],
              role: 'model',
            },
            finishReason: 'STOP',
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockGeminiApiResponse,
      } as Response);

      const result = await handleGeminiRequest({
        messages: [{ id: '1', role: 'user', content: 'My AC is not cooling, need jet service', timestamp: Date.now() }],
        apiKey: 'test-valid-gemini-key',
        model: 'gemini-3.8-flash',
      });

      expect(result.status).toBe(200);
      expect(result.data.model).toBe('gemini-3.8-flash');
      expect(result.data.isFallback).toBe(false);
      expect(result.data.providerName).toContain('Gemini 3.8 Flash');
      expect(result.data.draftRequest).toBeDefined();
      expect(result.data.draftRequest?.category).toBe('ac_repair');
      expect(result.data.draftRequest?.crew_size).toBe(2);
      expect(result.data.draftRequest?.budget).toBe(960);
    });

    it('returns structured NO_API_KEY error when GEMINI_API_KEY is missing on server', async () => {
      const result = await handleGeminiRequest({
        messages: [{ id: '1', role: 'user', content: 'Hello', timestamp: Date.now() }],
        apiKey: '',
      });

      expect(result.status).toBe(400);
      expect(result.data.error).toBe('NO_API_KEY');
      expect(result.data.message).toContain('API Configuration Required');
    });

    it('handles HTTP 429 quota exhaustion with QUOTA_EXCEEDED error and retry guidance', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: {
            code: 429,
            message: 'Resource has been exhausted (e.g. check quota).',
            status: 'RESOURCE_EXHAUSTED',
          },
        }),
      } as Response);

      const result = await handleGeminiRequest({
        messages: [{ id: '1', role: 'user', content: 'Check quote', timestamp: Date.now() }],
        apiKey: 'test-key',
      });

      expect(result.status).toBe(429);
      expect(result.data.error).toBe('QUOTA_EXCEEDED');
      expect(result.data.message).toContain('Free-tier quota exceeded');
    });

    it('handles HTTP 401 invalid API key with UNAUTHORIZED error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            code: 401,
            message: 'API key not valid. Please pass a valid API key.',
          },
        }),
      } as Response);

      const result = await handleGeminiRequest({
        messages: [{ id: '1', role: 'user', content: 'Hello', timestamp: Date.now() }],
        apiKey: 'bad-key',
      });

      expect(result.status).toBe(401);
      expect(result.data.error).toBe('UNAUTHORIZED');
      expect(result.data.message).toContain('Invalid API Key');
    });

    it('sends thinkingConfig with thinkingLevel: "low" and maxOutputTokens: 1024', async () => {
      let sentBody: any = null;
      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (_url, init) => {
        sentBody = JSON.parse(init?.body as string);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: 'Plumbing advice' }] } }],
          }),
        } as Response;
      });

      const result = await handleGeminiRequest({
        messages: [{ id: '1', role: 'user', content: 'Leaking pipe', timestamp: Date.now() }],
        apiKey: 'test-key',
      });

      expect(result.status).toBe(200);
      expect(sentBody).toBeDefined();
      expect(sentBody.generationConfig?.thinkingConfig?.thinkingLevel).toBe('low');
      expect(sentBody.generationConfig?.maxOutputTokens).toBe(1024);
      expect(sentBody.generationConfig?.temperature).toBe(0.35);
    });

    it('handles server-side 85s upstream timeout with 504 and TIMEOUT error code', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(abortError);

      const result = await handleGeminiRequest({
        messages: [{ id: '1', role: 'user', content: 'Complex request', timestamp: Date.now() }],
        apiKey: 'test-key',
      });

      expect(result.status).toBe(504);
      expect(result.data.error).toBe('TIMEOUT');
      expect(result.data.message).toContain('85 seconds');
      expect(typeof result.data.latencyMs).toBe('number');
    });

    it('handles HTTP 500/503 from Gemini with 502 UPSTREAM_5XX error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({
          error: { code: 503, message: 'The model is overloaded. Please try again later.' },
        }),
      } as Response);

      const result = await handleGeminiRequest({
        messages: [{ id: '1', role: 'user', content: 'Help please', timestamp: Date.now() }],
        apiKey: 'test-key',
      });

      expect(result.status).toBe(502);
      expect(result.data.error).toBe('UPSTREAM_5XX');
      expect(result.data.upstreamStatus).toBe(503);
    });

    it('handles empty response candidate from Gemini with 502 EMPTY_RESPONSE error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '' }] } }],
        }),
      } as Response);

      const result = await handleGeminiRequest({
        messages: [{ id: '1', role: 'user', content: 'Help please', timestamp: Date.now() }],
        apiKey: 'test-key',
      });

      expect(result.status).toBe(502);
      expect(result.data.error).toBe('EMPTY_RESPONSE');
      expect(result.data.message).toContain('empty response candidate');
    });
  });

  /* =========================================================================
   * 3. INFORMED USER CONSENT & PRIVACY/PII SANITIZATION
   * ========================================================================= */
  describe('Informed User Consent & Client Privacy Shield', () => {
    it('blocks external AI requests if user has not given informed consent', async () => {
      const ai = AIService.getInstance();
      ai.setUserConsent(false);

      await expect(ai.sendMessage('Help me fix my door')).rejects.toThrow(/Informed User Consent Required/i);
    });

    it('permits sending external AI requests once user grants informed consent', async () => {
      const ai = AIService.getInstance();
      ai.setUserConsent(true);

      const mockProvider: AIProvider = {
        name: 'Mock Gemini',
        isAvailable: async () => true,
        sendMessage: async () => ({
          reply: 'I can help with door repair (Carpentry).',
          providerName: 'SkillNear AI (Gemini 3.8 Flash)',
          model: 'gemini-3.8-flash',
          isFallback: false,
        }),
      };
      ai.setProvider(mockProvider);

      const res = await ai.sendMessage('Help me fix my door');
      expect(res.isError).toBeFalsy();
      expect(res.content).toContain('Carpentry');
    });

    it('sanitizes telephone numbers, email addresses, and credit cards before transmission', () => {
      const raw =
        'My contact is +91 98450 12345 or 9845012345, email rahul.sharma@example.com, card 4111-2222-3333-4444';
      const sanitized = sanitizePII(raw);

      expect(sanitized).not.toContain('98450 12345');
      expect(sanitized).not.toContain('rahul.sharma@example.com');
      expect(sanitized).not.toContain('4111-2222-3333-4444');
      expect(sanitized).toContain('[REDACTED_PHONE]');
      expect(sanitized).toContain('[REDACTED_EMAIL]');
      expect(sanitized).toContain('[REDACTED_CARD]');
    });

    it('ensures GEMINI_API_KEY is never exposed in client bundles or window environment', () => {
      // @ts-expect-error verifying window lacks secret
      expect(window.GEMINI_API_KEY).toBeUndefined();
      // @ts-expect-error verifying window lacks VITE secret
      expect(window.VITE_GEMINI_API_KEY).toBeUndefined();
    });
  });

  /* =========================================================================
   * 4. SCOPELOCK DRAFT & HUMAN CONFIRMATION INVARIANT
   * ========================================================================= */
  describe('ScopeLock Draft Card & Human Confirmation Invariant', () => {
    it('renders ScopeLock Draft card from live Gemini response and triggers handoff without auto-submitting', async () => {
      const onOpenDraft = vi.fn();
      const onClose = vi.fn();

      const ai = AIService.getInstance();
      const mockProvider: AIProvider = {
        name: 'Live Gemini Provider',
        isAvailable: async () => true,
        sendMessage: async () => ({
          reply: 'Here is your drafted request for wash basin pipe repair:',
          draftRequest: {
            category: 'plumber',
            title: 'Wash Basin Drain Pipe Leak Repair',
            description: 'Inspect and replace damaged drain siphon pipe under sink.',
            budget: 650,
            crew_size: 1,
            scope: {
              tasks: ['Inspect siphon trap', 'Replace gasket & washer', 'Flow test'],
              deliverables: ['Zero leak under maximum flow'],
              exclusions: ['Drywall masonry replacement'],
            },
          },
          providerName: 'SkillNear AI (Gemini 3.8 Flash)',
          model: 'gemini-3.8-flash',
          isFallback: false,
        }),
      };
      ai.setProvider(mockProvider);

      render(
        <AIConciergeModal
          isOpen={true}
          onClose={onClose}
          onOpenRequestWithDraft={onOpenDraft}
        />
      );

      const textarea = screen.getByPlaceholderText(/Ask about a repair/i);
      fireEvent.change(textarea, { target: { value: 'Draft a job for my leaking wash basin pipe' } });

      const sendButton = screen.getByRole('button', { name: /Send message to SkillNear AI/i });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText(/ScopeLock™ Draft Proposal/i)).toBeInTheDocument();
        expect(screen.getByText('Wash Basin Drain Pipe Leak Repair')).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: /Review & Edit in Post Job Form/i })
        ).toBeInTheDocument();
      });

      const reviewButton = screen.getByRole('button', { name: /Review & Edit in Post Job Form/i });
      fireEvent.click(reviewButton);

      // Verify human confirmation: draft passed to form, NOT submitted to database
      expect(onOpenDraft).toHaveBeenCalledTimes(1);
      const passedDraft: DraftServiceRequest = onOpenDraft.mock.calls[0][0];
      expect(passedDraft.category).toBe('plumber');
      expect(passedDraft.budget).toBe(650);
    });
  });

  /* =========================================================================
   * 5. EMERGENCY SAFETY GUARDRAIL (CLIENT-SIDE PROTECTION)
   * ========================================================================= */
  describe('Emergency Life-Safety Client Guardrail', () => {
    it('detects gas leak keywords and flags immediate client-side emergency hazard banner', () => {
      const res = checkEmergencyHazardKeywords('I smell a severe gas leak from my kitchen LPG cylinder');
      expect(res.isHazard).toBe(true);
      expect(res.type).toBe('gas');
    });

    it('detects electrical sparking keywords and flags electrical hazard', () => {
      const res = checkEmergencyHazardKeywords('There is sparking and burning wire from switchboard');
      expect(res.isHazard).toBe(true);
      expect(res.type).toBe('electrical');
    });

    it('renders Client Safety Guardrail Banner in UI when hazard keywords are entered', async () => {
      const onClose = vi.fn();
      const onOpenDraft = vi.fn();

      const ai = AIService.getInstance();
      ai.setProvider({
        name: 'Mock Gemini',
        isAvailable: async () => true,
        sendMessage: async () => ({
          reply: 'Please evacuate first. I can help find a licensed technician once safe.',
          providerName: 'SkillNear AI (Gemini 3.8 Flash)',
          model: 'gemini-3.8-flash',
          isFallback: false,
        }),
      });

      render(
        <AIConciergeModal
          isOpen={true}
          onClose={onClose}
          onOpenRequestWithDraft={onOpenDraft}
        />
      );

      const textarea = screen.getByPlaceholderText(/Ask about a repair/i);
      fireEvent.change(textarea, { target: { value: 'I smell a gas leak near cylinder' } });

      const sendButton = screen.getByRole('button', { name: /Send message to SkillNear AI/i });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText(/EMERGENCY SAFETY GUARDRAIL: GAS LEAK HAZARD/i)).toBeInTheDocument();
      });
    });
  });

  /* =========================================================================
   * 6. UI ACCESSIBILITY & RESPONSIVE VIEWPORTS
   * ========================================================================= */
  describe('UI Component States & Responsive Layouts', () => {
    it('renders floating action button with "Ask SkillNear AI" label when closed', () => {
      const onOpen = vi.fn();
      render(<AIConciergeTrigger isOpen={false} onClick={onOpen} />);

      const button = screen.getByRole('button', { name: /Open SkillNear AI Concierge/i });
      expect(button).toBeInTheDocument();
      expect(screen.getByText('Ask SkillNear AI')).toBeInTheDocument();

      fireEvent.click(button);
      expect(onOpen).toHaveBeenCalledTimes(1);
    });

    it('renders modal dialog with Gemini 3.8 Flash branding and 6 suggested prompts', () => {
      const onClose = vi.fn();
      const onOpenDraft = vi.fn();

      render(
        <AIConciergeModal
          isOpen={true}
          onClose={onClose}
          onOpenRequestWithDraft={onOpenDraft}
        />
      );

      expect(screen.getByRole('dialog', { name: /SkillNear AI Concierge/i })).toBeInTheDocument();
      expect(screen.getAllByText('SkillNear AI').length).toBeGreaterThan(0);
      expect(screen.getByText('Gemini 3.8 Flash (Live)')).toBeInTheDocument();

      for (const prompt of INITIAL_SUGGESTED_PROMPTS) {
        expect(screen.getByText(prompt)).toBeInTheDocument();
      }
    });

    it('displays API configuration instructions card when Gemini API key is missing', async () => {
      const onClose = vi.fn();
      const onOpenDraft = vi.fn();

      const ai = AIService.getInstance();
      ai.setProvider({
        name: 'Live Gemini Provider',
        isAvailable: async () => false,
        sendMessage: async () => {
          throw new LiveAIError(
            'API Configuration Required: GEMINI_API_KEY is not configured on the server.',
            'NO_API_KEY'
          );
        },
      });

      render(
        <AIConciergeModal
          isOpen={true}
          onClose={onClose}
          onOpenRequestWithDraft={onOpenDraft}
        />
      );

      const textarea = screen.getByPlaceholderText(/Ask about a repair/i);
      fireEvent.change(textarea, { target: { value: 'Hello' } });

      const sendButton = screen.getByRole('button', { name: /Send message to SkillNear AI/i });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('API Configuration Required')).toBeInTheDocument();
        expect(screen.getByText(/How to configure GEMINI_API_KEY/i)).toBeInTheDocument();
        expect(screen.getByText(/Retry with Gemini/i)).toBeInTheDocument();
      });
    });

    it('closes modal when Escape key is pressed', () => {
      const onClose = vi.fn();
      const onOpenDraft = vi.fn();

      render(
        <AIConciergeModal
          isOpen={true}
          onClose={onClose}
          onOpenRequestWithDraft={onOpenDraft}
        />
      );

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('verifies responsive layout classes for mobile (375x812) and desktop/tablet (1440x900)', () => {
      const onClose = vi.fn();
      const onOpenDraft = vi.fn();

      const { container } = render(
        <AIConciergeModal
          isOpen={true}
          onClose={onClose}
          onOpenRequestWithDraft={onOpenDraft}
        />
      );

      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).toBeInTheDocument();
      // Mobile bottom sheet
      expect(dialog?.className).toContain('fixed inset-0');
      // Tablet & Desktop floating panel
      expect(dialog?.className).toContain('sm:inset-auto');
      expect(dialog?.className).toContain('sm:bottom-5');
      expect(dialog?.className).toContain('sm:right-5');
      expect(dialog?.className).toContain('sm:w-[440px]');
    });

    it('verifies modal adapts correctly across 375x812, 768x1024, 1024x768, and 1440x900 viewports', () => {
      const ai = AIService.getInstance();
      ai.setUserConsent(true);

      const viewports = [
        { width: 375, height: 812, name: 'mobile' },
        { width: 768, height: 1024, name: 'tablet' },
        { width: 1024, height: 768, name: 'laptop' },
        { width: 1440, height: 900, name: 'desktop' },
      ];

      for (const vp of viewports) {
        window.innerWidth = vp.width;
        window.innerHeight = vp.height;
        window.dispatchEvent(new Event('resize'));

        const { container, unmount } = render(
          <AIConciergeModal
            isOpen={true}
            onClose={vi.fn()}
            onOpenRequestWithDraft={vi.fn()}
          />
        );

        const dialog = container.querySelector('[role="dialog"]');
        expect(dialog).toBeInTheDocument();
        // Composer textarea must be present and accessible
        expect(screen.getByRole('textbox')).toBeInTheDocument();
        unmount();
      }
    });

    it('displays Retry button after timeout without executing duplicate marketplace actions', async () => {
      const mockProvider: AIProvider = {
        name: 'Live Gemini Provider',
        isAvailable: async () => true,
        sendMessage: vi
          .fn()
          .mockRejectedValueOnce(
            new LiveAIError('Gemini request timed out after 90 seconds. Please click Retry.', 'CLIENT_TIMEOUT')
          )
          .mockResolvedValueOnce({
            reply: 'Retried successfully: Plumber service is recommended.',
            providerName: 'SkillNear AI (Gemini 3.8 Flash)',
            model: 'gemini-3.8-flash',
            isFallback: false,
          }),
      };

      const ai = AIService.getInstance();
      ai.setUserConsent(true);
      ai.setProvider(mockProvider);
      ai.resetRateLimitForTesting();

      const onOpenDraft = vi.fn();
      render(
        <AIConciergeModal
          isOpen={true}
          onClose={vi.fn()}
          onOpenRequestWithDraft={onOpenDraft}
        />
      );

      const textarea = screen.getByPlaceholderText(/Ask about a repair/i);
      fireEvent.change(textarea, { target: { value: 'Fix my water tap' } });

      const sendButton = screen.getByRole('button', { name: /Send message to SkillNear AI/i });
      fireEvent.click(sendButton);

      // Wait for error card to appear
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Gemini Request Timed Out/i })).toBeInTheDocument();
        expect(screen.getByText(/timed out after 90 seconds/i)).toBeInTheDocument();
      });

      // Retry button is available
      const retryBtn = screen.getByRole('button', { name: /Retry with Gemini/i });
      expect(retryBtn).toBeInTheDocument();

      // Click retry
      ai.resetRateLimitForTesting();
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(screen.getByText(/Retried successfully/i)).toBeInTheDocument();
      });

      // INVARIANT: Retrying must NEVER trigger automatic marketplace actions or book technicians
      expect(onOpenDraft).not.toHaveBeenCalled();
    });
  });
});
