// Token HMAC-SHA256 pentru link-uri de confirmare/anulare în email-uri.
// Format: `${payloadBase64Url}.${signatureBase64Url}`
// Payload: `${bookingNumber}|${action}|${expiresAtMs}`
// Folosit pentru "Confirm că vin" / "Anulez" din emailul de confirmare.

import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

const DEFAULT_TTL_MS = 60 * 24 * 3600 * 1000; // 60 zile — acoperă inclusiv cursele cu rezervare timpurie

// Secret partajat: preferă SESSION_SECRET (env), altfel cade pe Settings.session_secret
// din DB (același mecanism ca lib/session.ts). Asta evită crash-ul când env-ul nu e setat.
// IMPORTANT: ca butoanele Confirm/Anulează din email să se verifice pe davo.md, setează
// același SESSION_SECRET ca pe davo (Vercel) și în acest proiect.
const SETTINGS_KEY = "session_secret";
let cachedSecret: string | null = null;

async function getSecret(): Promise<string> {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (cachedSecret) return cachedSecret;
  const s = await prisma.settings.upsert({
    where: { key: SETTINGS_KEY },
    update: {},
    create: { id: SETTINGS_KEY, key: SETTINGS_KEY, value: randomBytes(32).toString("hex") },
  });
  cachedSecret = s.value;
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

export type BookingAction = "confirm" | "cancel";

export async function createBookingToken(
  bookingNumber: string,
  action: BookingAction,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<string> {
  const secret = await getSecret();
  const expiresAt = Date.now() + ttlMs;
  const payload = `${bookingNumber}|${action}|${expiresAt}`;
  const payloadB64 = toBase64Url(new TextEncoder().encode(payload));
  const sig = await hmac(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

export type BookingTokenPayload = {
  bookingNumber: string;
  action: BookingAction;
};

export async function verifyBookingToken(
  token: string
): Promise<BookingTokenPayload | null> {
  if (!token) return null;
  const secret = await getSecret();
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;

  const expected = await hmac(payloadB64, secret);
  if (sig !== expected) return null;

  try {
    const decoded = fromBase64Url(payloadB64);
    const parts = decoded.split("|");
    if (parts.length !== 3) return null;
    const [bookingNumber, action, expiresAtRaw] = parts;
    if (!bookingNumber || !action) return null;
    if (action !== "confirm" && action !== "cancel") return null;
    const expiresAt = Number(expiresAtRaw);
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;
    return { bookingNumber, action: action as BookingAction };
  } catch {
    return null;
  }
}

export function bookingResponseUrl(
  appUrl: string,
  bookingNumber: string,
  action: BookingAction,
  token: string
): string {
  const base = appUrl.replace(/\/$/, "");
  const params = new URLSearchParams({ bn: bookingNumber, action, token });
  return `${base}/api/bookings/respond?${params.toString()}`;
}
