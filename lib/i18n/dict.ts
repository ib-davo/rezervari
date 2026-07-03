// Client-safe dictionary access. Plain object lookup — no "server-only".
import { ro } from "./dictionaries/ro";
import { ru } from "./dictionaries/ru";
import type { Locale } from "./config";

const dictionaries = { ro, ru } as const;

export function dict(locale: Locale) {
  return dictionaries[locale];
}
