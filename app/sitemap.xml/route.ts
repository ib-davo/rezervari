import { destinations, services } from "@/lib/data";
import { countryLandingUrl, cityPageUrl } from "@/lib/utils";
import { locales, localePath, type Locale } from "@/lib/i18n/config";

export const dynamic = "force-static";
export const revalidate = 3600;

type ChangeFreq = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

type SitemapEntry = {
  // Each entry represents a single URL with hreflang alternates linking to its other-locale siblings.
  locByLocale: Record<Locale, string>;
  primaryLocale: Locale;
  lastmod: string;
  changefreq: ChangeFreq;
  priority: number;
};

const STATIC_ROUTES: { path: string; priority: number; changefreq: ChangeFreq }[] = [
  { path: "/", priority: 1.0, changefreq: "weekly" },
  { path: "/rezervare", priority: 0.9, changefreq: "weekly" },
  { path: "/destinatii", priority: 0.9, changefreq: "weekly" },
  { path: "/serviciile-noastre", priority: 0.8, changefreq: "monthly" },
  { path: "/despre-noi", priority: 0.7, changefreq: "monthly" },
  { path: "/informatii-utile", priority: 0.7, changefreq: "monthly" },
  { path: "/contact", priority: 0.6, changefreq: "monthly" },
  { path: "/livrare", priority: 0.5, changefreq: "monthly" },
  { path: "/colet-la-cheie", priority: 0.6, changefreq: "monthly" },
  { path: "/harta-site", priority: 0.4, changefreq: "monthly" },
  { path: "/rechizitele-bancare", priority: 0.3, changefreq: "yearly" },
  { path: "/termeni-pasageri", priority: 0.3, changefreq: "yearly" },
  { path: "/termeni-colete", priority: 0.3, changefreq: "yearly" },
];

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function addRouteAllLocales(
  base: string,
  path: string,
  isoNow: string,
  priority: number,
  changefreq: ChangeFreq,
  entries: SitemapEntry[]
) {
  for (const lang of locales) {
    const locByLocale: Record<Locale, string> = {
      ro: `${base}${localePath("ro", path)}`,
      ru: `${base}${localePath("ru", path)}`,
    };
    entries.push({
      locByLocale,
      primaryLocale: lang,
      lastmod: isoNow,
      changefreq,
      priority: lang === "ro" ? priority : Math.max(0.1, priority - 0.1),
    });
  }
}

function buildEntries(base: string, isoNow: string): SitemapEntry[] {
  const entries: SitemapEntry[] = [];

  for (const r of STATIC_ROUTES) {
    addRouteAllLocales(base, r.path, isoNow, r.priority, r.changefreq, entries);
  }

  for (const s of services) {
    addRouteAllLocales(base, `/serviciile-noastre/${s.slug}`, isoNow, 0.7, "monthly", entries);
  }

  for (const d of destinations) {
    addRouteAllLocales(base, countryLandingUrl(d), isoNow, 0.9, "weekly", entries);
    for (const c of d.cities) {
      addRouteAllLocales(base, cityPageUrl(c, d), isoNow, 0.7, "weekly", entries);
    }
  }

  return entries;
}

export function GET() {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://davo.md").replace(/\/$/, "");
  const isoNow = new Date().toISOString();
  const entries = buildEntries(base, isoNow);

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries
  .map((e) => {
    const alternates = locales
      .map(
        (l) =>
          `    <xhtml:link rel="alternate" hreflang="${l}" href="${escapeXml(e.locByLocale[l])}" />`
      )
      .join("\n");
    return `  <url>
    <loc>${escapeXml(e.locByLocale[e.primaryLocale])}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority.toFixed(1)}</priority>
${alternates}
    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(e.locByLocale.ro)}" />
  </url>`;
  })
  .join("\n")}
</urlset>`;

  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
