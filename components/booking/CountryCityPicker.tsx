"use client";

import { useEffect, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { destinations, moldovanCities } from "@/lib/data";
import { localizeCity, localizeDestinationName } from "@/lib/i18n/dataI18n";
import type { Locale } from "@/lib/i18n/config";

// Numele țărilor "străinătate" pe care DAVO le deservește. Folosit pentru
// regula de simetrie: o cursă validă merge mereu Moldova ↔ străinătate. Dacă
// origin = MD → destination ∈ aceste 5; dacă origin ∈ aceste 5 → destination
// = Moldova. Listă derivată din `destinations` (lib/data.ts) — dacă apare o
// țară nouă acolo, e luată în considerare automat prin export-ul de mai jos.
export const FOREIGN_COUNTRIES = destinations.map((d) => d.name);
export const MOLDOVA = "Moldova";

// Extrage numele țării din valoarea picker-ului ("Oraș, Țară" sau "Țară") —
// folosit de Hero & rezervare ca să decidă ce să ascundă în picker-ul opus.
export function getCountryFromValue(v: string): string | null {
  if (!v) return null;
  const idx = v.lastIndexOf(",");
  if (idx >= 0) {
    const c = v.slice(idx + 1).trim();
    return c || null;
  }
  // Fără virgulă: putem fi pe valoarea inițială ".... ?" Tratează ca țară doar
  // dacă e exact unul din numele cunoscute.
  const trimmed = v.trim();
  if (trimmed === MOLDOVA || FOREIGN_COUNTRIES.includes(trimmed)) return trimmed;
  return null;
}

// Pentru o țară aleasă într-o parte (origin/dest), returnează lista țărilor
// care TREBUIE ascunse pe partea opusă. Aplicat: dacă origin = Moldova →
// destination NU poate fi Moldova; dacă origin = orice țară străină →
// destination trebuie să fie Moldova (deci hide-uim toate cele străine).
export function complementHide(otherCountry: string | null): string[] {
  if (!otherCountry) return [];
  if (otherCountry === MOLDOVA) return [MOLDOVA];
  return FOREIGN_COUNTRIES;
}

// Lista țărilor pe care DAVO le deservește (Moldova + cele 5 europene din
// `lib/data.ts`). Valorile interne folosesc întotdeauna numele canonic
// românesc; doar labelul afișat trece prin localize() ca să suporte și /ru.
type CountryOption = {
  name: string; // canonical: "Moldova" / "Anglia" / ...
  label: string; // localized for display
  cities: { name: string; label: string }[];
};

function useCountries(locale: Locale): CountryOption[] {
  return useMemo(() => {
    const moldova: CountryOption = {
      name: "Moldova",
      label: locale === "ru" ? "Молдова" : "Moldova",
      cities: [
        { name: "Chișinău", label: localizeCity("Chișinău", locale) },
        ...moldovanCities.map((c) => ({
          name: c.name,
          label: localizeCity(c.name, locale),
        })),
      ],
    };
    const foreign: CountryOption[] = destinations.map((d) => ({
      name: d.name,
      label: localizeDestinationName(d.slug, locale, d.name),
      cities: d.cities.map((c) => ({
        name: c.name,
        label: localizeCity(c.name, locale),
      })),
    }));
    return [moldova, ...foreign];
  }, [locale]);
}

// Parsează un string "Oraș, Țară" / "Țară" / "Oraș" / "" în (city, country).
// Suportă URL-uri legacy unde s-a pasat doar orașul — facem o căutare după
// nume ca să inferăm țara automat (ex: ?from=Bruxelles → Belgia).
function parseValue(v: string, countries: CountryOption[]): { city: string; country: string } {
  if (!v) return { city: "", country: "" };
  const trimmed = v.trim();
  const idx = trimmed.lastIndexOf(",");
  if (idx >= 0) {
    const city = trimmed.slice(0, idx).trim();
    const country = trimmed.slice(idx + 1).trim();
    // Permitem și "Țară" doar (city vid)
    return { city, country };
  }
  // Legacy: doar oraș — inferăm țara
  const lower = trimmed.toLowerCase();
  // Match exact pe label-ul de țară (utilizator care a tastat doar "Anglia")
  const asCountry = countries.find((c) => c.name.toLowerCase() === lower || c.label.toLowerCase() === lower);
  if (asCountry) return { city: "", country: asCountry.name };
  // Match pe oraș
  for (const c of countries) {
    const cityHit = c.cities.find(
      (city) => city.name.toLowerCase() === lower || city.label.toLowerCase() === lower
    );
    if (cityHit) return { city: cityHit.name, country: c.name };
  }
  return { city: trimmed, country: "" };
}

// Construiește string-ul canonic pe care îl emitem prin onChange.
function buildValue(city: string, country: string): string {
  if (!country && !city) return "";
  if (!city) return country; // doar țara setată
  if (!country) return city;
  return `${city}, ${country}`;
}

export type CountryCityPickerProps = {
  value: string;
  onChange: (v: string) => void;
  locale: Locale;
  countryPlaceholder?: string;
  cityPlaceholder?: string;
  // Excluded: nume de țări care NU trebuie să apară în dropdown (ex: pentru
  // destinație, când origine e deja Moldova, am putea ascunde Moldova). În
  // versiunea actuală nu folosim asta — păstrăm libertate totală.
  hideCountries?: string[];
};

export function CountryCityPicker({
  value,
  onChange,
  locale,
  countryPlaceholder,
  cityPlaceholder,
  hideCountries,
}: CountryCityPickerProps) {
  const countries = useCountries(locale);
  const visible = useMemo(
    () => (hideCountries?.length ? countries.filter((c) => !hideCountries.includes(c.name)) : countries),
    [countries, hideCountries]
  );
  const { city, country } = parseValue(value, countries);
  const selectedCountry = countries.find((c) => c.name === country);
  const cities = selectedCountry?.cities ?? [];

  // Auto-select când rămâne o singură țară posibilă (ex: origin=Anglia → în
  // picker-ul de destinație, doar Moldova mai e vizibilă). Economiseste un
  // click utilizatorului și evită faza de "Țară" cu dropdown gol.
  const onlyCountry = visible.length === 1 ? visible[0].name : null;
  useEffect(() => {
    if (!country && onlyCountry) {
      onChange(buildValue(city, onlyCountry));
    }
    // Dacă țara curentă a devenit invalidă (filtrul a ascuns-o), o resetăm
    // — caller-ul (Hero/rezervare) face și auto-flip pe partea opusă.
    if (country && !visible.some((c) => c.name === country)) {
      onChange(buildValue("", onlyCountry ?? ""));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyCountry, country]);

  const countryPh = countryPlaceholder ?? (locale === "ru" ? "Страна" : "Țară");
  const cityPh = cityPlaceholder ?? (locale === "ru" ? "Город" : "Oraș");

  return (
    <div className="grid grid-cols-2 gap-1.5 items-stretch w-full">
      <SelectShell>
        <select
          value={country}
          onChange={(e) => {
            const next = e.target.value;
            // Schimbând țara, golim orașul dacă nu există în noua țară
            const newCountry = countries.find((c) => c.name === next);
            const cityStillValid = newCountry?.cities.some((c) => c.name === city);
            onChange(buildValue(cityStillValid ? city : "", next));
          }}
          className="w-full bg-transparent appearance-none text-[0.95rem] font-semibold text-[color:var(--navy-900)] outline-none cursor-pointer pr-5"
        >
          <option value="">{countryPh}</option>
          {visible.map((c) => (
            <option key={c.name} value={c.name}>
              {c.label}
            </option>
          ))}
        </select>
      </SelectShell>
      <SelectShell disabled={!country}>
        <select
          value={city}
          onChange={(e) => onChange(buildValue(e.target.value, country))}
          disabled={!country}
          className="w-full bg-transparent appearance-none text-[0.95rem] font-semibold text-[color:var(--navy-900)] outline-none cursor-pointer pr-5 disabled:cursor-not-allowed disabled:text-[color:var(--ink-400)]"
        >
          <option value="">{cityPh}</option>
          {cities.map((c) => (
            <option key={c.name} value={c.name}>
              {c.label}
            </option>
          ))}
        </select>
      </SelectShell>
    </div>
  );
}

function SelectShell({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  return (
    <div
      className={`relative flex items-center ${disabled ? "opacity-60" : ""}`}
    >
      {children}
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-0 h-3.5 w-3.5 text-[color:var(--ink-500)]"
      />
    </div>
  );
}

// Helper exportat — util în Hero/rezervare ca să mapeze codul ISO din /api/geo
// (ex: "GB") la numele canonic ("Anglia") care apare în picker.
const ISO_TO_COUNTRY: Record<string, string> = {
  MD: "Moldova",
  GB: "Anglia",
  UK: "Anglia",
  DE: "Germania",
  BE: "Belgia",
  NL: "Olanda",
  LU: "Luxemburg",
};

export function countryFromIsoCode(code: string | null | undefined): string | null {
  if (!code) return null;
  return ISO_TO_COUNTRY[code.toUpperCase()] ?? null;
}
