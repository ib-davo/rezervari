// Rate-limit simplu în memorie pentru login-ul cu PIN (4 cifre = 10.000
// combinații — fără limită, un script le încearcă pe toate în minute).
// Per instanță serverless e best-effort, dar face brute-force-ul impracticabil
// pe deployment-ul real (fiecare instanță permite doar câteva încercări).

type Bucket = { fails: number; firstFailAt: number; blockedUntil: number };

const buckets = new Map<string, Bucket>();

const MAX_FAILS = 5; // încercări greșite permise…
const WINDOW_MS = 15 * 60 * 1000; // …într-o fereastră de 15 min
const BLOCK_MS = 15 * 60 * 1000; // apoi blocăm 15 min

function bucketFor(key: string): Bucket {
  let b = buckets.get(key);
  const now = Date.now();
  if (!b || (now - b.firstFailAt > WINDOW_MS && now > b.blockedUntil)) {
    b = { fails: 0, firstFailAt: now, blockedUntil: 0 };
    buckets.set(key, b);
  }
  return b;
}

/** Returnează secundele rămase de blocare, sau 0 dacă e permis. */
export function loginBlockedSeconds(key: string): number {
  const b = buckets.get(key);
  if (!b) return 0;
  const left = b.blockedUntil - Date.now();
  return left > 0 ? Math.ceil(left / 1000) : 0;
}

export function recordLoginFailure(key: string): void {
  const b = bucketFor(key);
  b.fails += 1;
  if (b.fails >= MAX_FAILS) {
    b.blockedUntil = Date.now() + BLOCK_MS;
  }
  // Curățare oportunistă ca Map-ul să nu crească nelimitat.
  if (buckets.size > 1000) {
    const now = Date.now();
    for (const [k, v] of buckets) {
      if (now - v.firstFailAt > WINDOW_MS && now > v.blockedUntil) buckets.delete(k);
    }
  }
}

export function recordLoginSuccess(key: string): void {
  buckets.delete(key);
}
