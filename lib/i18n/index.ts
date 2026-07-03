// Mixed server/client utilities. The dictionary contents are static data
// (no DB / env access) so this module is safe to import from client components.
import { ro } from "./dictionaries/ro";
import { ru } from "./dictionaries/ru";
import type { Locale } from "./config";

const dictionaries = { ro, ru } as const;

export type { Locale };
export type { Dictionary } from "./dictionaries/ro";

export function getDictionary(locale: Locale) {
  return dictionaries[locale];
}

export { locales, defaultLocale, isLocale, localePath, stripLocalePrefix } from "./config";

// Localized day name lookup, used by collection schedule + pickup tables.
// Romanian day names ("Marți", "Miercuri", "Joi") map to translated copy
// without forcing data files to be rewritten.
const dayMap: Record<string, { ro: string; ru: string }> = {
  Luni: { ro: "Luni", ru: "Понедельник" },
  Marți: { ro: "Marți", ru: "Вторник" },
  Miercuri: { ro: "Miercuri", ru: "Среда" },
  Joi: { ro: "Joi", ru: "Четверг" },
  Vineri: { ro: "Vineri", ru: "Пятница" },
  Sâmbătă: { ro: "Sâmbătă", ru: "Суббота" },
  Duminică: { ro: "Duminică", ru: "Воскресенье" },
};

export function localizeDay(day: string, locale: Locale): string {
  return dayMap[day]?.[locale] ?? day;
}
