// Locale config — single source of truth.
// Romanian is the default and lives at "/", Russian lives under "/ru/...".
// Slugs themselves stay in Romanian (Google indexed "/ru/autocar-chisinau-moldova-⇋-tilburg-olanda"),
// so we only switch UI copy, not URL paths.

export const locales = ["ro", "ru"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ro";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

// Build a localized URL: ro stays at "/", ru prefixes "/ru".
// Always returns a leading slash and normalizes trailing slashes away.
export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  const normalized = clean === "/" ? "" : clean.replace(/\/$/, "");
  if (locale === "ro") return normalized === "" ? "/" : normalized;
  return `/ru${normalized}`;
}

// Strip the /ru prefix from a path, if present. Idempotent for ro paths.
export function stripLocalePrefix(path: string): { locale: Locale; rest: string } {
  if (path === "/ru" || path === "/ru/") return { locale: "ru", rest: "/" };
  if (path.startsWith("/ru/")) return { locale: "ru", rest: path.slice(3) };
  return { locale: "ro", rest: path === "" ? "/" : path };
}
