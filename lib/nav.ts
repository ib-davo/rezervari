// Localized nav builder. Returns NavItems with translated labels but
// untranslated URLs (the proxy handles locale prefixing for /ru, and
// /<path> stays the same in both locales).

import type { NavItem } from "@/types";
import { destinations, services } from "@/lib/data";
import { countryLandingUrl } from "@/lib/utils";
import { ro } from "@/lib/i18n/dictionaries/ro";
import { ru } from "@/lib/i18n/dictionaries/ru";
import { localePath } from "@/lib/i18n/config";
import { localizeDestinationName, localizeServiceTitle } from "@/lib/i18n/dataI18n";
import type { Locale } from "@/lib/i18n/config";

const dicts = { ro, ru } as const;

export function getNavItems(locale: Locale): NavItem[] {
  const d = dicts[locale];

  // Always prefix URLs with the current locale so the user stays in the
  // chosen language when clicking nav items.
  const lp = (path: string) => localePath(locale, path);

  return [
    { label: d.nav.bookTicket, href: lp("/rezervare") },
    {
      label: d.nav.destinations,
      href: lp("/destinatii"),
      children: destinations.map((dest) => ({
        label: d.nav.moldovaTo(localizeDestinationName(dest.slug, locale, dest.name)),
        href: lp(countryLandingUrl(dest)),
      })),
    },
    { label: d.nav.sendParcel, href: lp("/rezervare?mode=colet") },
    {
      label: d.nav.services,
      href: lp("/serviciile-noastre"),
      children: services.map((s) => ({
        label: localizeServiceTitle(s.slug, locale, s.title),
        href: lp(`/serviciile-noastre/${s.slug}`),
      })),
    },
    {
      label: d.nav.usefulInfo,
      href: lp("/informatii-utile"),
      children: [
        { label: d.nav.aboutUs, href: lp("/despre-noi") },
        { label: d.nav.bankDetails, href: lp("/rechizitele-bancare") },
      ],
    },
    { label: d.nav.contacts, href: lp("/contact") },
  ];
}
