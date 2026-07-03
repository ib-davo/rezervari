import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Mapare cod ISO → numele de țară pe care îl folosim intern (cel din picker
// și din DB-ul de Country). Doar țările pe care DAVO le deservește; restul
// pică prin → null și clientul nu pre-completează nimic.
const COUNTRY_NAMES: Record<string, string> = {
  MD: "Moldova",
  GB: "Anglia",
  DE: "Germania",
  BE: "Belgia",
  NL: "Olanda",
  LU: "Luxemburg",
};

// Citește țara utilizatorului din headerele platformei (Vercel le adaugă
// automat în prod; Cloudflare are propriile sale). Local/dev returnează
// null — UI-ul rămâne la valori implicite.
export async function GET(request: NextRequest) {
  const code =
    request.headers.get("x-vercel-ip-country") ||
    request.headers.get("cf-ipcountry") ||
    request.headers.get("x-country-code") ||
    null;

  const upper = code ? code.toUpperCase() : null;
  const name = upper ? COUNTRY_NAMES[upper] ?? null : null;

  return NextResponse.json({
    countryCode: upper,
    countryName: name,
  });
}
