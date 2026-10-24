/**
 * SkillNear AI Concierge — Server-Side Live Gemini Handler
 *
 * Grounded in SkillNear's 10 service categories, ScopeLock™, FairDeal™,
 * Change-Order Lock, Crew Mode, and Repair Passport™.
 *
 * Uses official Google Gemini REST API:
 * https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 *
 * Model: gemini-3.8-flash (Standard Free Tier: $0 cost / zero billing)
 */

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

export const SKILLNEAR_SYSTEM_INSTRUCTION = `You are SkillNear AI, the live conversational assistant for SkillNear — a trusted hyperlocal marketplace for verified home repair and maintenance services.

SkillNear Core Marketplace Principles:
1. CANONICAL SERVICE CATEGORIES (10 Core Trades):
   - Electrician (trade: 'electrician', ₹450/hr): Wiring diagnosis, MCB tripping, inverter setup, switches & lighting.
   - Plumber (trade: 'plumber', ₹400/hr): Pipe leaks, washbasin/tap repair, drain clog clearing, cistern fixes.
   - Home Cleaning (trade: 'cleaner', ₹350/hr, Crew Mode suggested: 2): Deep cleaning, bathroom acid scrub, floor buffing, kitchen degreasing.
   - Painter (trade: 'painter', ₹320/hr, Crew Mode suggested: 3): Interior/exterior emulsion, waterproof coating, wall putty & primer.
   - AC Repair & Servicing (trade: 'ac_repair', ₹480/hr, Crew Mode suggested: 2): Jet pump foam wash, refrigerant gas check, cooling loss diagnosis.
   - Appliance Repair (trade: 'appliance_repair', ₹420/hr): Washing machine drum/motor, refrigerator thermostat/defrost, microwave repairs.
   - Carpentry & Furniture Repair (trade: 'carpenter', ₹390/hr): Door hinge alignment, wardrobe latches, wooden furniture repair, drawer tracks.
   - Handyman & Installation (trade: 'handyman', ₹300/hr): Curtain rod mounting, TV wall mounting, shelf drilling, mirror hanging.
   - Water Purifier Service (trade: 'water_purifier', ₹380/hr): RO+UV membrane overhaul, sediment/carbon filter change, TDS calibration.
   - Pest Control (trade: 'pest_control', ₹360/hr, Crew Mode suggested: 2): Cockroach odorless gel baiting, termite drilling, bedbug treatment.

2. ARCHITECTURAL GUARANTEES:
   - ScopeLock™: Fixed tasks, deliverables, and exclusions defined before technicians submit quotes. Prevents on-site scope creep or verbal disputes.
   - FairDeal™: Itemized quotes (labor rate, duration, material costs, crew headcount) compared side-by-side against an identical ScopeLock baseline.
   - Change-Order Lock: Technicians are strictly prohibited from raising prices on-site. Any unforeseen work requires an itemized digital Change Order with delta price that only the customer can approve or reject.
   - Crew Mode: Team-based booking for large projects (1-20 workers) with duration (hours or days) and supervisor dispatch.
   - Repair Passport™: Tamper-resistant permanent digital maintenance history locked to verified booking financials.

3. CRITICAL LIFE-SAFETY PROTOCOLS:
   - Gas Leak / Cylinder Smell: IMMEDIATELY instruct: (1) Do NOT operate any electrical switches, appliances, doorbells, or lighters; (2) Shut off cylinder regulator / main valve; (3) Open all windows for cross-ventilation; (4) Evacuate premises; (5) Call emergency services (112) or gas distributor helpline from outside.
   - Electrical Sparking / Burning Smell: Instruct turning off the main MCB breaker immediately, avoiding wet areas, and booking a verified licensed electrician.

4. RESTRAINT & CONFIRMATION INVARIANTS:
   - NEVER fabricate specific live technician availability, technician names, phone numbers, customer bookings, ratings, or database records.
   - NEVER claim that you have booked a worker, published a request, or finalized a booking. You only draft proposals for customer inspection.
   - When the user asks for a service, wants to post a job, or describes a repair they need done, provide diagnostic advice, recommend the appropriate trade, and output a structured JSON ScopeLock Draft block at the end of your response:
\`\`\`json
{
  "draftRequest": {
    "category": "plumber",
    "title": "Kitchen Sink Drain Pipe Leak Repair",
    "description": "Diagnosis and repair of leaking kitchen sink drain pipe with test run.",
    "budget": 800,
    "crew_size": 1,
    "scope": {
      "tasks": ["Inspect trap & drain pipe joints", "Replace worn washer/pipe", "Water leak pressure test"],
      "deliverables": ["Zero leakage under full sink flow", "Area cleared"],
      "exclusions": ["Main vertical building drainage stack repair"]
    }
  }
}
\`\`\`
Keep your conversational tone professional, helpful, transparent, and concise.`;

/**
 * Executes a live call to the Google Gemini API.
 * Pure server-side logic — no frontend leakage.
 */
export async function handleGeminiRequest({
  messages,
  context,
  apiKey,
  model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
}) {
  const startTime = Date.now();

  // 1. Verify API Key presence
  if (!apiKey || apiKey.trim() === '' || apiKey.includes('your-google-gemini-api-key')) {
    return {
      status: 400,
      data: {
        error: 'NO_API_KEY',
        message:
          'API Configuration Required: GEMINI_API_KEY is not configured on the server. Please add your free-tier Gemini API key to the server .env file. Obtain one at https://aistudio.google.com.',
        latencyMs: Date.now() - startTime,
      },
    };
  }

  // 2. Validate messages
  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      status: 400,
      data: {
        error: 'INVALID_REQUEST',
        message: 'No messages provided to AI Concierge.',
        latencyMs: Date.now() - startTime,
      },
    };
  }

  // 3. Transform messages into Gemini API contents structure
  // Keep the most recent 8 messages to prevent prompt bloat and keep generation fast
  const recentMessages = messages.slice(-8);
  const contents = [];
  for (const msg of recentMessages) {
    const role = msg.role === 'assistant' ? 'model' : 'user';
    const text = typeof msg.content === 'string' ? msg.content.trim() : '';
    if (!text) continue;

    // Merge consecutive messages of the same role if any
    const lastItem = contents[contents.length - 1];
    if (lastItem && lastItem.role === role) {
      lastItem.parts[0].text += `\n\n${text}`;
    } else {
      contents.push({
        role,
        parts: [{ text }],
      });
    }
  }

  // Ensure first message has role 'user' (Gemini requirement)
  while (contents.length > 0 && contents[0].role !== 'user') {
    contents.shift();
  }

  if (contents.length === 0) {
    return {
      status: 400,
      data: {
        error: 'INVALID_REQUEST',
        message: 'At least one user message is required.',
        latencyMs: Date.now() - startTime,
      },
    };
  }

  // 4. Build Gemini API URL & Payload
  // Send API key via x-goog-api-key header (standard Google Cloud API practice)
  // to prevent leaking the key in URL query strings, server request logs, or proxy traces.
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent`;

  // Explicitly configure low thinking level for fast, conversational home-repair advice.
  // Note: Gemini 3.8 Flash defaults to 'medium' thinking if omitted, which adds substantial
  // token generation delay. 'low' thinking provides rapid latency while preserving reasoning quality.
  // Do NOT use 'minimal'; gemini-3.8-flash does not support 'minimal'.
  const requestBody = {
    systemInstruction: {
      parts: [{ text: SKILLNEAR_SYSTEM_INSTRUCTION }],
    },
    contents,
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 1024,
      thinkingConfig: {
        thinkingLevel: 'low',
      },
    },
  };

  try {
    // 85-second upstream timeout allows Google Gemini free-tier queue (which takes 50-68s under load)
    // to complete reliably, leaving a 5-second buffer within the 90-second client window.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 85000);

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const upstreamDurationMs = Date.now() - startTime;

    // 5. Handle HTTP Errors from Upstream Gemini API
    if (!geminiRes.ok) {
      const status = geminiRes.status;
      let errBody;
      try {
        errBody = await geminiRes.json();
      } catch {
        errBody = {};
      }
      const rawMsg = errBody?.error?.message || `HTTP ${status}`;
      const safeMsg =
        typeof rawMsg === 'string'
          ? rawMsg.replace(/AIza[0-9A-Za-z-_]{10,}/g, '[REDACTED]')
          : `HTTP ${status}`;

      if (status === 401 || status === 403 || safeMsg.includes('API key not valid')) {
        return {
          status: 401,
          data: {
            error: 'UNAUTHORIZED',
            message:
              'Invalid API Key: The configured GEMINI_API_KEY was rejected by Google Gemini API. Please verify the key in your server .env file.',
            upstreamStatus: status,
            latencyMs: upstreamDurationMs,
          },
        };
      }

      if (status === 404) {
        return {
          status: 404,
          data: {
            error: 'MODEL_UNAVAILABLE',
            message: `Model Unavailable: Model '${model}' or the Gemini API endpoint was not found (HTTP 404).`,
            upstreamStatus: status,
            latencyMs: upstreamDurationMs,
          },
        };
      }

      if (status === 429 || safeMsg.includes('RESOURCE_EXHAUSTED') || safeMsg.includes('quota')) {
        return {
          status: 429,
          data: {
            error: 'QUOTA_EXCEEDED',
            message:
              'Free-tier quota exceeded: The Gemini API free-tier rate limit has been reached. Please wait a moment and click Retry.',
            upstreamStatus: status,
            latencyMs: upstreamDurationMs,
          },
        };
      }

      if (status >= 500) {
        return {
          status: 502,
          data: {
            error: 'UPSTREAM_5XX',
            message: `Google Gemini service temporarily unavailable (HTTP ${status}): ${safeMsg}. Please click Retry.`,
            upstreamStatus: status,
            latencyMs: upstreamDurationMs,
          },
        };
      }

      return {
        status: 502,
        data: {
          error: 'UPSTREAM_ERROR',
          message: `Gemini API error (HTTP ${status}): ${safeMsg}. Please click Retry.`,
          upstreamStatus: status,
          latencyMs: upstreamDurationMs,
        },
      };
    }

    // 6. Parse successful Gemini response
    const data = await geminiRes.json();
    const candidate = data.candidates?.[0];
    const rawReply = candidate?.content?.parts?.[0]?.text;

    if (!rawReply || rawReply.trim() === '') {
      return {
        status: 502,
        data: {
          error: 'EMPTY_RESPONSE',
          message: 'Gemini returned an empty response candidate. Please rephrase your question and retry.',
          upstreamStatus: 200,
          latencyMs: upstreamDurationMs,
        },
      };
    }

    // 7. Extract ScopeLock draft JSON if present in response
    let draftRequest = undefined;
    let cleanReply = rawReply;

    const jsonMatch = rawReply.match(/```json\s*(\{[\s\S]*?"draftRequest"[\s\S]*?\})\s*```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.draftRequest) {
          draftRequest = parsed.draftRequest;
          // Clean the code block from the user-facing text to keep chat clean
          cleanReply = rawReply.replace(jsonMatch[0], '').trim();
        }
      } catch {
        // Leave reply as-is if JSON parsing fails
      }
    }

    // Contextual suggested prompt options
    const suggestedPrompts = [
      'Find the appropriate service category.',
      'Help me create a service request.',
      'Compare two quotes.',
      'Explain my Repair Passport.',
      'How does ScopeLock protect me?',
    ];

    return {
      status: 200,
      data: {
        reply: cleanReply,
        draftRequest,
        suggestedPrompts,
        model,
        providerName: `SkillNear AI (Gemini 3.8 Flash)`,
        isFallback: false,
        usageNotice: 'Powered by Google Gemini 3.8 Flash (Official Free Tier API)',
        latencyMs: upstreamDurationMs,
        upstreamStatus: 200,
      },
    };
  } catch (err) {
    const elapsedMs = Date.now() - startTime;
    if (err.name === 'AbortError') {
      return {
        status: 504,
        data: {
          error: 'TIMEOUT',
          message:
            'Gemini upstream timeout: Request timed out after 85 seconds waiting for Google Gemini. Please check your network and click Retry.',
          latencyMs: elapsedMs,
        },
      };
    }

    const safeErrMsg = (err.message || 'Unknown network error').replace(
      /AIza[0-9A-Za-z-_]{10,}/g,
      '[REDACTED]'
    );
    return {
      status: 500,
      data: {
        error: 'NETWORK_ERROR',
        message: `Gemini connectivity failed: ${safeErrMsg}. Please click Retry.`,
        latencyMs: elapsedMs,
      },
    };
  }
}
