import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { City, Destination } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPhone(phone: string): string {
  return phone.replace(/\s/g, "").replace(/^\+/, "");
}

// ============================================
// SEO URL helpers — preserve davo.md slug structure
// ============================================

// The diamond character used in davo.md city URLs (U+21CB ⇋).
// Kept as a constant so it's explicit everywhere it's used.
export const CITY_URL_DIAMOND = "⇋"; // ⇋

export function countryLandingUrl(destination: Pick<Destination, "seoSlug">): string {
  return `/${destination.seoSlug}`;
}

export function cityPageSlug(
  city: Pick<City, "slug" | "pageSlug">,
  destination: Pick<Destination, "slug">
): string {
  return city.pageSlug ?? `${city.slug}-${destination.slug}`;
}

export function cityPageUrl(
  city: Pick<City, "slug" | "pageSlug">,
  destination: Pick<Destination, "slug">
): string {
  return `/autocar-chisinau-moldova-${CITY_URL_DIAMOND}-${cityPageSlug(city, destination)}`;
}
