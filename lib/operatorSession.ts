// Sesiune operator — HMAC-SHA256, cookie separat de cel admin al davo.
// Token = `${payloadB64}.${signature}`; payload = base64url(JSON{id,slug,name}) + "|" + expiresAtMs.
// Secretul: OPERATOR_SESSION_SECRET (env) cu fallback la secretul din tabela Settings (partajat cu davo).

import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  effectiveOperatorPermissions,
  normalizeOperatorRole,
  type OperatorRole,
} from "@/lib/operatorPermissions";

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

export type OperatorAccess = {
  role: string;
  active: boolean;
  permissions: string[]; // brut, așa cum e în DB: lista goală = presetul rolului
};

/**
 * Coloana `Operator.permissions` ajunge în baza de producție abia când se
 * aplică migrarea creată în repo-ul davo (baza e partajată, migrarea se rulează
 * o singură dată, de acolo). Până atunci Prisma întoarce P2022 la orice citire
 * a ei.
 */
export function isMissingPermissionsColumn(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  return e?.code === "P2022" && (e.message ?? "").includes("permissions");
}

/** Mesaj comun pentru cazul de mai sus, când operația chiar cerea permisiuni. */
export const PERMISSIONS_UNAVAILABLE =
  "Permisiunile nu pot fi salvate încă: coloana lipsește din baza de date (migrarea se aplică o singură dată, din repo-ul davo).";

/**
 * Rolul, starea și permisiunile operatorului — se citesc din DB fiindcă tokenul
 * conține doar {id,slug,name}. Dacă lipsește coloana `permissions`, cade pe
 * lista goală, adică pe presetul rolului: exact comportamentul de dinainte de
 * permisiuni, nu o eroare care ar bloca tot panoul.
 */
export async function loadOperatorAccess(id: string): Promise<OperatorAccess | null> {
  try {
    const op = await prisma.operator.findUnique({
      where: { id },
      select: { role: true, active: true, permissions: true },
    });
    return op ? { role: op.role, active: op.active, permissions: op.permissions ?? [] } : null;
  } catch (error) {
    if (!isMissingPermissionsColumn(error)) throw error;
    const op = await prisma.operator.findUnique({
      where: { id },
      select: { role: true, active: true },
    });
    return op ? { role: op.role, active: op.active, permissions: [] } : null;
  }
}

export type OperatorRights = OperatorSession & { role: OperatorRole; permissions: string[] };

/**
 * Sesiune validă + cont activ + permisiunea cerută (efectivă: lista proprie
 * dacă e ne-goală, altfel presetul rolului).
 *
 * Rolul rămâne în rezultat fiindcă permisiunea dă doar acces la secțiune —
 * operațiile de scriere din gestiunea operatorilor cer în plus supervizor.
 */
export async function verifyOperatorSection(
  token: string | undefined,
  section: string,
): Promise<OperatorRights | null> {
  const session = await verifyOperatorToken(token);
  if (!session) return null;
  const access = await loadOperatorAccess(session.id);
  if (!access || !access.active) return null;
  const role = normalizeOperatorRole(access.role);
  const permissions = effectiveOperatorPermissions(role, access.permissions);
  if (!permissions.includes(section)) return null;
  return { ...session, role, permissions };
}

// Verifică sesiunea ȘI că operatorul e supervisor ACTIV (rolul se citește din DB,
// nu din token — tokenul are doar {id,slug,name}). Pentru gestiunea operatorilor.
export async function verifyOperatorSupervisor(token: string | undefined): Promise<OperatorSession | null> {
  const session = await verifyOperatorToken(token);
  if (!session) return null;
  const op = await prisma.operator.findUnique({ where: { id: session.id }, select: { role: true, active: true } });
  if (!op || !op.active || op.role !== "supervisor") return null;
  return session;
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
