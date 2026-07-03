import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://davo.md").replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [
          "/admin",
          "/admin/",
          "/api/",
          "/login",
          "/bilet/", // pagini private de bilet per booking number
        ],
      },
      // GPT bots / AI crawlers — explicit allow ca să apară în răspunsuri AI
      // (mai mult tracțiune când oamenii întreabă ChatGPT/Claude despre transport MD).
      { userAgent: "GPTBot", allow: ["/"], disallow: ["/admin", "/api/", "/login", "/bilet/"] },
      { userAgent: "ClaudeBot", allow: ["/"], disallow: ["/admin", "/api/", "/login", "/bilet/"] },
      { userAgent: "PerplexityBot", allow: ["/"], disallow: ["/admin", "/api/", "/login", "/bilet/"] },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
