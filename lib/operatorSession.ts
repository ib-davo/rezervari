// Sesiune operator — HMAC-SHA256, cookie separat de cel admin al davo.
// Token = `${payloadB64}.${signature}`; payload = base64url(JSON{id,slug,name}) + "|" + expiresAtMs.
// Secretul: OPERATOR_SESSION_SECRET (env) cu fallback la secretul din tabela Settings (partajat cu davo).

import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export const OPERATOR_COOKIE = "davo_operator";
const WEEK_MS = 7 * 24 * 3600 * 1000;
const SETTINGS_KEY = "session_secret";

export type OperatorSession = { id: string; slug: string; name: string };

let cachedSecret: string | null = null;

async function getSecret(): Promise<string> {
  if (cachedSecret) return cachedSecret;
  if (process.env.OPERATOR_SESSION_SECRET) {
    cachedSecret = process.env.OPERATOR_SESSION_SECRET;
    return cachedSecret;
  }
  const setting = await prisma.settings.upsert({
    where: { key: SETTINGS_KEY },
    update: {},
    create: { id: SETTINGS_KEY, key: SETTINGS_KEY, value: randomBytes(32).toString("hex") },
  });
  cachedSecret = setting.value;
  return cachedSecret;
}

function toB64Url(bytes: Uint8Array | ArrayBuffer): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string): string {
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
  return toB64Url(sig);
}

export async function createOperatorToken(session: OperatorSession, ttlMs = WEEK_MS): Promise<string> {
  const secret = await getSecret();
  const expiresAt = Date.now() + ttlMs;
  const payloadB64 = toB64Url(new TextEncoder().encode(JSON.stringify(session)));
  const body = `${payloadB64}|${expiresAt}`;
  const sig = await hmac(body, secret);
  return `${body}.${sig}`;
}

export async function verifyOperatorToken(token: string | undefined): Promise<OperatorSession | null> {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const secret = await getSecret();
  const expected = await hmac(body, secret);
  if (sig !== expected) return null;
  try {
    const sep = body.lastIndexOf("|");
    if (sep < 0) return null;
    const payloadB64 = body.slice(0, sep);
    const expiresAt = Number(body.slice(sep + 1));
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;
    const session = JSON.parse(fromB64Url(payloadB64)) as OperatorSession;
    if (!session?.id || !session?.slug) return null;
    return session;
  } catch {
    return null;
  }
}

export function operatorCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: WEEK_MS / 1000,
  };
}
