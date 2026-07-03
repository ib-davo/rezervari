// Sesiune simplă HMAC-SHA256. Token = `${payloadBase64Url}.${signatureBase64Url}`.
// Payload: `${email}|${expiresAtMs}`. Folosit în proxy (Node) și în API routes (Node).
// SESSION_SECRET se citește din tabela Settings (Supabase) — generat automat la prima cerere.

import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export const COOKIE_NAME = "davo_admin_session";
const WEEK_MS = 7 * 24 * 3600 * 1000;
const SETTINGS_KEY = "session_secret";

let cachedSecret: string | null = null;

async function getSessionSecret(): Promise<string> {
  if (cachedSecret) return cachedSecret;
  if (process.env.SESSION_SECRET) {
    cachedSecret = process.env.SESSION_SECRET;
    return cachedSecret;
  }
  const setting = await prisma.settings.upsert({
    where: { key: SETTINGS_KEY },
    update: {},
    create: {
      id: SETTINGS_KEY,
      key: SETTINGS_KEY,
      value: randomBytes(32).toString("hex"),
    },
  });
  cachedSecret = setting.value;
  return cachedSecret;
}

function toBase64Url(bytes: Uint8Array | ArrayBuffer): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const padded = s + "=".repeat((4 - (s.length % 4)) % 4);
  return atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
}

async function hmac(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return toBase64Url(sig);
}

export async function createToken(email: string, ttlMs = WEEK_MS): Promise<string> {
  const secret = await getSessionSecret();
  const expiresAt = Date.now() + ttlMs;
  const payload = `${email}|${expiresAt}`;
  const payloadB64 = toBase64Url(new TextEncoder().encode(payload));
  const sig = await hmac(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

export async function verifyToken(token: string): Promise<{ email: string } | null> {
  if (!token) return null;
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;

  const secret = await getSessionSecret();
  const expected = await hmac(payloadB64, secret);
  if (sig !== expected) return null;

  try {
    const decoded = fromBase64Url(payloadB64);
    const sep = decoded.indexOf("|");
    if (sep < 0) return null;
    const email = decoded.slice(0, sep);
    const expiresAt = Number(decoded.slice(sep + 1));
    if (!email || !Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;
    return { email };
  } catch {
    return null;
  }
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: WEEK_MS / 1000,
  };
}
