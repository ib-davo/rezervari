/**
 * „Geografia" site-ului — țările + orașele de pornire (MD) și de sosire (EU).
 *
 * Sursa de adevăr e tabela `City` din DB (admin → Orașe), partajată cu
 * rezervari.davo.md. Listele din `lib/data.ts` rămân doar (1) fallback când DB
 * nu răspunde și (2) sursă pentru seed (`scripts/sync-cities-from-data.ts`).
 *
 * Fișierul e izomorf (server + client): NU importa prisma aici — încărcarea din
 * DB e în `lib/geo.ts`, iar pe client datele vin prin `GeoProvider`.
 */
import { destinations, moldovanCities, mdCitiesFor, mdStopOffset } from "@/lib/data";
import { cityNameI18n, localizeCity } from "@/lib/i18n/dataI18n";
import type { Locale } from "@/lib/i18n/config";

export type GeoCity = {
  id: string;
  name: string; // canonic RO — exact ce se salvează pe rezervări
  nameRu: string | null;
  slug: string;
  sortOrder: number;
  active: boolean;
  /** minute față de ora-ancoră a țării (orar ridicări); null = necunoscut */
  pickupOffsetMin: number | null;
  /** doar MD: slug-urile țărilor destinație pentru care orașul e oferit pasagerilor */
  passengerCountries: string[];
};

export type GeoCountry = {
  id: string;
  name: string; // canonic RO: "Moldova" / "Anglia" / ...
  slug: string;
  flag: string | null;
  /** TOATE orașele (și cele inactive), în ordinea `sortOrder` — filtrează cu activeCities() */
  cities: GeoCity[];
};

export type GeoData = {
  moldova: GeoCountry | null;
  /** țările străine, în ordinea din `destinations` (lib/data.ts) */
  countries: GeoCountry[];
  /** true = vine din DB; false = fallback static din lib/data.ts */
  fromDb: boolean;
};

export const MOLDOVA_NAME = "Moldova";
export const CHISINAU_NAME = "Chișinău";

/** Comparație tolerantă la diacritice/majuscule ("Balti" == "Bălți"). */
export function normalizeCityName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function isChisinau(name: string): boolean {
  return normalizeCityName(name) === "chisinau";
}

/** Orașele active ale unei țări, în ordinea configurată. */
export function activeCities(country: GeoCountry | null | undefined): GeoCity[] {
  return (country?.cities ?? []).filter((c) => c.active);
}

/** Toate țările (Moldova prima), pentru lookup-uri. */
export function allCountries(geo: GeoData): GeoCountry[] {
  return geo.moldova ? [geo.moldova, ...geo.countries] : geo.countries;
}

export function findCountryByName(geo: GeoData, name: string | null | undefined): GeoCountry | null {
  if (!name) return null;
  const n = normalizeCityName(name);
  return allCountries(geo).find((c) => normalizeCityName(c.name) === n) ?? null;
}

export function findCountryBySlug(geo: GeoData, slug: string | null | undefined): GeoCountry | null {
  if (!slug) return null;
  const s = slug.toLowerCase();
  return allCountries(geo).find((c) => c.slug === s) ?? null;
}

/** Orașul (din orice țară, activ sau nu) după nume, tolerant la diacritice. */
export function findCity(geo: GeoData, cityName: string): { city: GeoCity; country: GeoCountry } | null {
  const n = normalizeCityName(cityName);
  if (!n) return null;
  for (const country of allCountries(geo)) {
    const city = country.cities.find((c) => normalizeCityName(c.name) === n);
    if (city) return { city, country };
  }
  return null;
}

/** Țara unui oraș după nume (ex. "Bălți" → Moldova, "Slough" → Anglia). */
export function countryOfCityName(geo: GeoData, cityName: string): GeoCountry | null {
  return findCity(geo, cityName)?.country ?? null;
}

export function isMoldovanCity(geo: GeoData, cityName: string): boolean {
  if (isChisinau(cityName)) return true;
  return countryOfCityName(geo, cityName)?.slug === "moldova";
}

/**
 * Orașele MD (nume canonice) oferite PASAGERILOR pentru o țară destinație —
 * valabil la tur și la retur. Fără țară (încă nealeasă) → reuniunea: toate
 * orașele MD active bifate pentru cel puțin o țară. Coletele NU folosesc asta.
 */
export function mdStopsFor(geo: GeoData, countryName: string | null | undefined): string[] {
  const md = activeCities(geo.moldova);
  // Siguranță: dacă nimic nu e configurat încă (seed nerulat), oferim tot.
  const offered = md.some((c) => c.passengerCountries.length > 0)
    ? md.filter((c) => c.passengerCountries.length > 0)
    : md;
  const country = findCountryByName(geo, countryName);
  if (!country || country.slug === "moldova") return offered.map((c) => c.name);
  const forCountry = offered.filter((c) => c.passengerCountries.includes(country.slug));
  // Țară fără nicio bifă (ex. una nouă) → lista implicită, ca înainte.
  return (forCountry.length > 0 ? forCountry : offered).map((c) => c.name);
}

/** Aceeași listă, dar după slug-ul țării ("anglia"). */
export function mdStopsForSlug(geo: GeoData, countrySlug: string | null | undefined): string[] {
  return mdStopsFor(geo, findCountryBySlug(geo, countrySlug)?.name ?? null);
}

/**
 * Echivalentul vechiului `mdCitiesFor(slug)` din lib/data.ts: lista MD pentru
 * o țară după slug, sau null când țara nu e cunoscută/aleasă (= nerestricționat,
 * cazul coletelor).
 */
export function mdCitiesForSlug(geo: GeoData, countrySlug: string | null | undefined): string[] | null {
  const country = findCountryBySlug(geo, countrySlug);
  if (!country || country.slug === "moldova") return null;
  return mdStopsFor(geo, country.name);
}

/** Offsetul (minute) unui oraș MD față de plecarea din Chișinău; 0 dacă necunoscut. */
export function mdStopOffsetMin(geo: GeoData, cityName: string): number {
  if (isChisinau(cityName)) return 0;
  const hit = geo.moldova?.cities.find((c) => normalizeCityName(c.name) === normalizeCityName(cityName));
  return hit?.pickupOffsetMin ?? 0;
}

/** Numele afișat (RU din DB, apoi tabelul static, apoi numele RO). */
export function localizeGeoCity(geo: GeoData, name: string, locale: Locale): string {
  if (locale === "ru") {
    const hit = findCity(geo, name)?.city;
    if (hit?.nameRu) return hit.nameRu;
  }
  return localizeCity(name, locale);
}

/**
 * Dacă textul („Oraș" sau „Oraș, adresă…") începe cu un oraș MD cunoscut care
 * NU e printre opririle permise, întoarce numele orașului; altfel null.
 */
export function offRouteMdCity(geo: GeoData, text: string, allowedCities: string[]): string | null {
  const head = normalizeCityName(text.split(",")[0]);
  if (!head) return null;
  const known = [CHISINAU_NAME, ...(geo.moldova?.cities ?? []).map((c) => c.name)];
  const hit = known.find((name) => {
    const n = normalizeCityName(name);
    return head === n || head.startsWith(n + " ");
  });
  if (!hit) return null;
  return allowedCities.some((a) => normalizeCityName(a) === normalizeCityName(hit)) ? null : hit;
}

// ---------------------------------------------------------------------------
// Fallback static (lib/data.ts) — folosit când DB nu e disponibil sau când un
// component e randat în afara GeoProvider-ului.
// ---------------------------------------------------------------------------
let staticCache: GeoData | null = null;

export function staticGeo(): GeoData {
  if (staticCache) return staticCache;
  const ru = (name: string) => cityNameI18n[name]?.ru ?? null;
  const mdNames = Array.from(
    new Set([
      CHISINAU_NAME,
      ...moldovanCities.map((c) => c.name),
      ...destinations.flatMap((d) => mdCitiesFor(d.slug) ?? []),
    ])
  );
  const moldova: GeoCountry = {
    id: "static-moldova",
    name: MOLDOVA_NAME,
    slug: "moldova",
    flag: "🇲🇩",
    cities: mdNames.map((name, i) => ({
      id: `static-md-${i}`,
      name,
      nameRu: ru(name),
      slug: normalizeCityName(name).replace(/\s+/g, "-"),
      sortOrder: i,
      active: true,
      pickupOffsetMin: (() => {
        const off = destinations.map((d) => mdStopOffset(d.slug, name)).find((o) => o !== 0);
        return off ?? (name === CHISINAU_NAME ? 0 : null);
      })(),
      passengerCountries: destinations
        .filter((d) => (mdCitiesFor(d.slug) ?? []).includes(name))
        .map((d) => d.slug),
    })),
  };
  const countries: GeoCountry[] = destinations.map((d) => ({
    id: `static-${d.slug}`,
    name: d.name,
    slug: d.slug,
    flag: null,
    cities: d.cities.map((c, i) => ({
      id: `static-${d.slug}-${c.slug}`,
      name: c.name,
      nameRu: ru(c.name),
      slug: c.slug,
      sortOrder: i,
      active: true,
      pickupOffsetMin: null,
      passengerCountries: [],
    })),
  }));
  staticCache = { moldova, countries, fromDb: false };
  return staticCache;
}
