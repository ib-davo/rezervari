/**
 * Încărcarea geografiei (țări + orașe) din DB, cu cache pe tag — SERVER ONLY.
 * Pe client datele ajung prin `components/geo/GeoProvider` (pus în layout-uri).
 *
 * Orașele se editează pe davo.md/admin → Orașe (repo-ul davo); baza fiind
 * partajată, panoul vede schimbarea în cel mult GEO_REVALIDATE_S secunde.
 */
import { unstable_cache, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { destinations } from "@/lib/data";
import { staticGeo, type GeoCity, type GeoCountry, type GeoData } from "@/lib/geoShared";

export const GEO_CACHE_TAG = "geo";
export const GEO_REVALIDATE_S = 60;

async function loadGeoFromDb(): Promise<GeoData> {
  const rows = await prisma.country.findMany({
    include: { cities: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
  });
  const toCountry = (r: (typeof rows)[number]): GeoCountry => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    flag: r.flag,
    cities: r.cities.map(
      (c): GeoCity => ({
        id: c.id,
        name: c.name,
        nameRu: c.nameRu,
        slug: c.slug,
        sortOrder: c.sortOrder,
        active: c.active,
        pickupOffsetMin: c.pickupOffsetMin,
        passengerCountries: c.passengerCountries ?? [],
      })
    ),
  });
  const moldova = rows.find((r) => r.slug === "moldova");
  const order = new Map(destinations.map((d, i) => [d.slug, i]));
  const countries = rows
    .filter((r) => r.slug !== "moldova")
    .sort((a, b) => (order.get(a.slug) ?? 99) - (order.get(b.slug) ?? 99) || a.name.localeCompare(b.name))
    .map(toCountry);
  return { moldova: moldova ? toCountry(moldova) : null, countries, fromDb: true };
}

/** Geografia din DB, cache-uită (tag `geo`, max 60s). Aruncă dacă DB pică. */
export const getGeo = unstable_cache(loadGeoFromDb, ["geo-v1"], {
  tags: [GEO_CACHE_TAG],
  revalidate: GEO_REVALIDATE_S,
});

/** Variantă tolerantă: la eroare DB întoarce listele statice — site-ul nu cade. */
export async function getGeoSafe(): Promise<GeoData> {
  try {
    return await getGeo();
  } catch (err) {
    console.error("getGeo: fallback static —", err instanceof Error ? err.message : err);
    return staticGeo();
  }
}

/** De chemat după orice scriere în City (admin → Orașe). */
export function revalidateGeo(): void {
  revalidateTag(GEO_CACHE_TAG, "max");
}
