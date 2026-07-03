/**
 * Returnează URL-ul absolut al aplicației, folosit în email-uri și redirecturi
 * externe. Nu are slash trailing.
 *
 * Ordine de prioritate:
 * 1. NEXT_PUBLIC_APP_URL — atâta timp cât NU conține "localhost".
 *    (Pe Vercel e setat la `https://davo.md`. Local în .env.local e
 *    `http://localhost:3000` — pe care îl ignorăm pentru că link-urile
 *    din email se deschid în clientul utilizatorului, nu pe localhost.)
 * 2. VERCEL_PROJECT_PRODUCTION_URL — domeniul canonic de producție al
 *    proiectului pe Vercel.
 * 3. VERCEL_URL — URL-ul deploymentului curent (preview sau production).
 * 4. Fallback hardcoded: `https://davo.md`. Asta înseamnă că orice email
 *    trimis de pe localhost folosește totuși linkuri reale, navigabile
 *    de către clientul de email.
 */
export function appUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  // În dev local respectăm valoarea explicită chiar dacă e localhost — altfel
  // tokenul de confirmare semnat cu secretul local nu mai e verificabil când
  // browserul deschide link-ul pe https://davo.md.
  if (explicit && process.env.NODE_ENV !== "production") return explicit;
  if (explicit && !explicit.includes("localhost")) return explicit;

  const prodHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prodHost) return `https://${prodHost}`;

  const deployHost = process.env.VERCEL_URL;
  if (deployHost) return `https://${deployHost}`;

  return "https://davo.md";
}

/**
 * Variantă strict publică a URL-ului aplicației — folosită pentru link-uri
 * scanate sau partajate cu lumea de afară (QR pe bilet, share link), unde
 * `localhost` n-are sens. Sare peste valoarea explicită dacă e localhost,
 * indiferent de NODE_ENV.
 */
export function publicAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (explicit && !explicit.includes("localhost")) return explicit;

  const prodHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prodHost) return `https://${prodHost}`;

  const deployHost = process.env.VERCEL_URL;
  if (deployHost) return `https://${deployHost}`;

  return "https://davo.md";
}
