/**
 * Gemini Flash API client.
 * Uses the Google Generative Language REST API directly from the browser.
 * Key is read from VITE_GEMINI_KEY env var — never hardcoded.
 */

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const KEY = import.meta.env.VITE_GEMINI_KEY as string | undefined;

export const geminiAvailable = !!KEY;

// ── In-memory cache: prompt → {text, expiry} ──────────────────────────────────
// Prevents duplicate calls during HMR, tab switches, or rapid re-renders.
const CACHE = new Map<string, { text: string; expiry: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Rate limiter: track last call time globally to prevent burst requests
let lastCallMs = 0;
const MIN_INTERVAL_MS = 3_000; // minimum 3 seconds between any two Gemini calls

interface GeminiResponse {
  candidates?: { content: { parts: { text: string }[] } }[];
}

/**
 * Send a prompt to Gemini Flash and return the text response.
 * Returns null if the key is missing or the call fails.
 */
export async function geminiAsk(prompt: string): Promise<string | null> {
  if (!KEY) return null;

  // Return cached result if still valid
  const cacheKey = prompt.slice(0, 200); // key on first 200 chars
  const cached = CACHE.get(cacheKey);
  if (cached && Date.now() < cached.expiry) return cached.text;

  // Rate limit: skip if called too recently
  const now = Date.now();
  if (now - lastCallMs < MIN_INTERVAL_MS) return cached?.text ?? null;
  lastCallMs = now;

  try {
    const res = await fetch(`${GEMINI_URL}?key=${KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(12_000),
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024,
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        ],
      }),
    });
    if (!res.ok) {
      if (res.status === 429) console.warn("[Gemini] Rate limited — using cache or skipping");
      return cached?.text ?? null;
    }
    const json: GeminiResponse = await res.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
    if (text) CACHE.set(cacheKey, { text, expiry: Date.now() + CACHE_TTL_MS });
    return text;
  } catch {
    return cached?.text ?? null;
  }
}
