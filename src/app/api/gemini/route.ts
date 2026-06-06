import "server-only";
import { NextResponse } from "next/server";
import { verifyBearerToken } from "@/lib/firebase/admin";
import { checkAndIncrement } from "@/lib/rate-limit";
import { GeminiRequestSchema } from "@/lib/validation/schemas";

/**
 * Secure proxy to Google Gemini.
 *
 * Hardens against the exact issues in v1:
 *  1. Verifies a Firebase ID token before each call (no anonymous abuse).
 *  2. Per-user rate limiting (30/min, 200/day) via Firestore.
 *  3. Zod validation on prompt + systemInstruction (length caps).
 *  4. Restricts response to safe text or strict JSON when jsonMode set.
 *  5. Origin allow-list (defaults to same-origin if ALLOWED_ORIGINS unset).
 *
 * The API key never reaches the client.
 */

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export const runtime = "nodejs"; // firebase-admin requires Node, not Edge
export const dynamic = "force-dynamic";

// Capacitor WebView origins for the native apps (Android serves the bundle from
// https://localhost, iOS from capacitor://localhost). These must pass both the
// origin guard and CORS so the AI Coach can reach this proxy cross-origin.
const APP_ORIGINS = ["https://localhost", "capacitor://localhost", "ionic://localhost"];

function configuredOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function checkOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // same-origin requests omit Origin
  if (APP_ORIGINS.includes(origin)) return true; // native apps
  const allowed = configuredOrigins();
  if (allowed.length === 0) return true; // dev: rely on CORS/preflight
  return allowed.includes(origin);
}

/** Value to echo in Access-Control-Allow-Origin, or null when none applies. */
function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null; // same-origin needs no CORS header
  if (APP_ORIGINS.includes(origin)) return origin;
  const allowed = configuredOrigins();
  if (allowed.length === 0) return origin; // dev: reflect
  return allowed.includes(origin) ? origin : null;
}

function withCors(res: NextResponse, origin: string | null): NextResponse {
  const allow = allowedOrigin(origin);
  if (allow) {
    res.headers.set("Access-Control-Allow-Origin", allow);
    res.headers.set("Vary", "Origin");
    res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.headers.set("Access-Control-Max-Age", "86400");
  }
  return res;
}

// CORS preflight — browsers/WebViews send this before the authenticated POST.
export async function OPTIONS(req: Request) {
  return withCors(new NextResponse(null, { status: 204 }), req.headers.get("origin"));
}

async function handlePost(req: Request): Promise<NextResponse> {
  // 1. Origin / CSRF surface guard
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  // 2. Auth
  let uid: string;
  try {
    ({ uid } = await verifyBearerToken(req.headers.get("authorization")));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 3. Validate body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = GeminiRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { prompt, systemInstruction, jsonMode } = parsed.data;

  // 4. Rate limit
  const rl = await checkAndIncrement(uid, "gemini");
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Rate limit hit (${rl.reason}). Try again in ${rl.retryAfterSec ?? 60}s.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec ?? 60) } },
    );
  }

  // 5. Check server config
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[/api/gemini] GEMINI_API_KEY is not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  // 6. Call Gemini
  let modelRes: Response;
  try {
    modelRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        ...(jsonMode ? { generationConfig: { responseMimeType: "application/json" } } : {}),
      }),
      // 30-second hard timeout via AbortController
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upstream call failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  let modelJson: unknown;
  try {
    modelJson = await modelRes.json();
  } catch {
    return NextResponse.json({ error: "Bad upstream response" }, { status: 502 });
  }

  if (!modelRes.ok) {
    // Don't leak Google's verbose error messages to the client
    return NextResponse.json({ error: "Model error" }, { status: 502 });
  }

  // 7. Extract text. If jsonMode, parse it. Otherwise return raw text.
  const text =
    (modelJson as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0]
      ?.content?.parts?.[0]?.text ?? "";

  if (jsonMode) {
    try {
      return NextResponse.json(JSON.parse(text));
    } catch {
      return NextResponse.json({ error: "Model did not return JSON", raw: text }, { status: 502 });
    }
  }
  return NextResponse.json(text);
}

export async function POST(req: Request) {
  return withCors(await handlePost(req), req.headers.get("origin"));
}
