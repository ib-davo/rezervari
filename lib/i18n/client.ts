"use client";

// Client-side locale helpers. Reads the locale from the URL pathname
// (since the proxy.ts rewrites "/" → "/ro" internally, the lang segment
// is always present in the rewritten path, but on the client `pathname`
// still shows the public URL — so we infer locale from the prefix).

import { usePathname } from "next/navigation";
import { stripLocalePrefix, type Locale } from "./config";

export function useLocale(): Locale {
  const pathname = usePathname() ?? "/";
  return stripLocalePrefix(pathname).locale;
}

// Strip /ru prefix from the visible pathname so it can be re-prefixed
// when switching locale.
export function usePathWithoutLocale(): string {
  const pathname = usePathname() ?? "/";
  return stripLocalePrefix(pathname).rest;
}
