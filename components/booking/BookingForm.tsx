"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Calendar,
  Clock,
  CreditCard,
  MapPin,
  Package,
  ShieldCheck,
  Truck,
  Users,
  User,
  Mail,
  Phone,
  Info,
  Search,
} from "lucide-react";
import { destinations, moldovanCities, contactInfo } from "@/lib/data";
import { CountryCityPicker, complementHide, getCountryFromValue } from "@/components/booking/CountryCityPicker";
import { useLocale } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import { CountryFlag, destinationSlugToCode } from "@/components/ui/CountryFlag";
import { getOutboundWeekday, getReturnWeekday } from "@/lib/countrySchedule";
import RouteHero from "@/components/booking/RouteHero";
import { StepBar } from "@/components/booking/StepBar";
import { TripPicker, type PublicTrip } from "@/components/booking/TripPicker";
import SuccessCard from "@/components/ui/SuccessCard";

type PassengerName = { firstName: string; lastName: string };

type Mode = "bilet" | "colet";

type BookingResult = {
  bookingNumber: string;
  price: number;
  currency: string;
  ticketUrl: string;
};

type CityLookup = { id: string; name: string };

const coletSteps = ["Direcție", "Expeditor", "Destinatar", "Detalii colet", "Plată"];

const dateFmtRo = new Intl.DateTimeFormat("ro-RO", {
  weekday: "short",
  day: "numeric",
  month: "long",
});

function formatRoDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return dateFmtRo.format(d);
}

function RezervareFallback() {
  return <div className="container-page py-20">Loading...</div>;
}

export function BookingForm({ embedded = false }: { embedded?: boolean }) {
  return (
    <Suspense fallback={<RezervareFallback />}>
      <RezervareContent embedded={embedded} />
    </Suspense>
  );
}

export default BookingForm;

function RezervareContent({ embedded = false }: { embedded?: boolean }) {
  const params = useSearchParams();
  const locale = useLocale();
  const initialMode = (params.get("mode") as Mode) === "colet" ? "colet" : "bilet";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [step, setStep] = useState(0);
  const initialTo = params.get("to") || "";
  // Dacă „+"-ul din panou trimite doar destinația Moldova (cursă retur), plecarea
  // NU poate rămâne default-ul Chișinău — ar ieși Moldova→Moldova, auto-flip-ul
  // golește destinația și direcția pornește invers. O lăsăm goală: operatorul
  // alege plecarea doar dintre țările cursei (param `countries`).
  const initialFrom =
    params.get("from") ??
    (getCountryFromValue(initialTo) === "Moldova" ? "" : "Chișinău, Moldova");
  // "+ Rezervare pe cursă" din panou → preselectăm cursa (tripId) sau ziua (date).
  const initialTripId = params.get("tripId");
  const initialDate = params.get("date");
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  // Direcția determină ce listă apare la "Plecare din" vs "Destinația".
  // Userul o inversează cu butonul swap din DirectionStep — atât tur, cât și
  // retur sunt valide (există rute Europa → Moldova în DB).
  // Detectăm direcția inițială din `from` ca să gestionăm corect cazul când
  // userul vine de pe Hero cu un oraș european (după ce a făcut swap acolo).
  const [direction, setDirection] = useState<"md-to-eu" | "eu-to-md">(() => {
    const f = initialFrom.split(",")[0].trim().toLowerCase();
    // Chișinău e hub-ul implicit MD, dar nu e în `moldovanCities` (lista de
    // opriri intermediare), așa că îl tratăm explicit ca origine MD.
    if (f === "chișinău" || f === "chisinau") return "md-to-eu";
    return moldovanCities.some((c) => c.name.toLowerCase() === f)
      ? "md-to-eu"
      : "eu-to-md";
  });
  const [trip, setTrip] = useState<"one" | "return">("one");
  const [passengers, setPassengers] = useState(1);

  // Noi: selecții de Trip + scaune din DB
  const [cityIndex, setCityIndex] = useState<Record<string, CityLookup> | null>(null);
  const [outboundTripId, setOutboundTripId] = useState<string | null>(null);
  const [outboundSeats, setOutboundSeats] = useState<number[]>([]);
  const [outboundTripInfo, setOutboundTripInfo] = useState<PublicTrip | null>(null);
  const [returnTripId, setReturnTripId] = useState<string | null>(null);
  const [returnSeats, setReturnSeats] = useState<number[]>([]);
  const [returnTripInfo, setReturnTripInfo] = useState<PublicTrip | null>(null);

  // Datele pentru sumar/booking se derivă din cursele alese — nu mai sunt input.
  const date = outboundTripInfo?.departureAt ?? "";
  const returnDate = returnTripInfo?.departureAt ?? "";
  const [result, setResult] = useState<BookingResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [payMethod, setPayMethod] = useState<"card" | "cash">("card");
  // Preț manual (doar operator/embedded) — suprascrie totalul calculat.
  const [customPrice, setCustomPrice] = useState<string>("");
  // Text liber pe bilet (doar operator): suprascrie plecarea/destinația salvate —
  // ex. adresă exactă de îmbarcare („56593 Horhausen") în loc de orașul din listă.
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  const [person, setPerson] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    passport: "",
    note: "",
  });
  // Pasagerii 2..N. Pasagerul 1 e `person` (contact + nume). Lista se sincronizează
  // cu `passengers` în updatePassengers — adăugăm/scoatem perechi când userul
  // schimbă numărul de călători.
  const [extraPassengers, setExtraPassengers] = useState<PassengerName[]>([]);

  const [sender, setSender] = useState({
    name: "",
    phone: "",
    email: "",
    city: "",
    address: "",
  });
  const [recipient, setRecipient] = useState({
    name: "",
    phone: "",
    email: "",
    city: "",
    address: "",
  });
  const [parcel, setParcel] = useState({
    weight: "",
    length: "",
    width: "",
    height: "",
    contents: "",
  });

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  // Scroll automat la începutul pasului curent când userul avansează/se întoarce.
  // Probleme rezolvate: pasul anterior poate fi mai înalt (ex. selectorul de
  // scaune are layout vertical de autocar), iar React doar swap-uiește conținutul
  // la aceeași poziție de scroll → userul rămâne jos și nu vede primul element
  // al pasului următor. Folosim window.scrollTo cu poziție calculată explicit
  // (mai robust decât scrollIntoView, care prinde alt scroll container pe mobile
  // și care e neîncrezut când layout-ul se schimbă concomitent cu AnimatePresence).
  const stepAnchorRef = useRef<HTMLDivElement>(null);
  const isFirstStepRender = useRef(true);
  const scrollToStepTop = () => {
    if (typeof window === "undefined") return;
    const el = stepAnchorRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const top = Math.max(0, window.scrollY + rect.top - 96);
      window.scrollTo({ top, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  // Backup: dacă step se schimbă din alt motiv (programatic), tot scroll-uim.
  // Sare primul render ca să nu provoace jump pe intrarea directă pe pagină.
  useEffect(() => {
    if (isFirstStepRender.current) {
      isFirstStepRender.current = false;
      return;
    }
    scrollToStepTop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, mode]);

  // Fetch city name → id map la mount pentru rezolvare la pas Direcție
  useEffect(() => {
    fetch("/api/public/cities")
      .then((r) => r.json())
      .then((d) => {
        if (!d?.success) return;
        const map: Record<string, CityLookup> = {};
        const norm = (s: string) => s.trim().toLowerCase();
        const add = (c: { id: string; name: string }) => {
          map[norm(c.name)] = { id: c.id, name: c.name };
        };
        (d.origins ?? []).forEach(add);
        (d.destinations ?? []).forEach(add);
        setCityIndex(map);
      })
      .catch(() => setCityIndex({}));
  }, []);

  // Re-derivă direcția din country-ul curent din `from` — userul poate schimba
  // țara liber din picker (Country+City) iar direcția trebuie să țină pasul ca
  // restul logicii (weekday-uri permise, etichete, etc.) să se refacă corect.
  useEffect(() => {
    const country = from.split(",").pop()?.trim().toLowerCase() ?? "";
    if (country === "moldova") {
      setDirection("md-to-eu");
    } else if (country.length > 0) {
      setDirection("eu-to-md");
    }
  }, [from]);

  // Cursa e mereu MD ↔ străinătate. Calculăm constrângerea de simetrie ca să
  // ascundem opțiunile invalide în picker (ex: dacă origin = Anglia, în
  // picker-ul de destinație doar Moldova rămâne vizibilă).
  const fromCountryName = getCountryFromValue(from);
  const toCountryName = getCountryFromValue(to);
  // Restricție „+ Rezervare pe cursă": doar țările pe care le deservește cursa
  // aleasă (ex. DAW 777 = Belgia/Germania — Anglia nu apare deloc în picker).
  // Moldova nu e niciodată ascunsă. Fără param `countries` → nicio restricție.
  const lockHide = useMemo(() => {
    const raw = params.get("countries");
    if (!raw) return [] as string[];
    const allowed = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (allowed.length === 0) return [] as string[];
    return destinations.map((d) => d.name).filter((n) => !allowed.includes(n));
  }, [params]);
  const fromHide = useMemo(() => [...complementHide(toCountryName), ...lockHide], [toCountryName, lockHide]);
  const toHide = useMemo(() => [...complementHide(fromCountryName), ...lockHide], [fromCountryName, lockHide]);

  // Auto-flip pe `to` dacă userul a schimbat `from` și combinația devine
  // ilegală (ambele MD sau ambele străine). Picker-ul `to` va auto-selecta
  // unica țară permisă imediat după reset.
  useEffect(() => {
    if (!fromCountryName || !toCountryName) return;
    const fromMD = fromCountryName === "Moldova";
    const toMD = toCountryName === "Moldova";
    if (fromMD === toMD) {
      setTo("");
      setOutboundTripId(null);
      setOutboundSeats([]);
      setOutboundTripInfo(null);
      setReturnTripId(null);
      setReturnSeats([]);
      setReturnTripInfo(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromCountryName]);

  const steps = mode === "bilet"
    ? (trip === "return"
        ? ["Călătorie", "Cursa retur", "Pasageri", "Plată"]
        : ["Călătorie", "Pasageri", "Plată"])
    : coletSteps;

  const destinationCities = useMemo(
    () =>
      destinations.flatMap((d) =>
        d.cities.map((c) => ({ name: c.name, country: d.name, slug: d.slug }))
      ),
    []
  );

  // Țara/steagul se derivă din câmpul european — la EU→MD, asta e `from`.
  const europeanField = direction === "md-to-eu" ? to : from;
  const matchedCountry = useMemo(() => {
    const hit = destinationCities.find((c) =>
      europeanField.toLowerCase().startsWith(c.name.toLowerCase())
    );
    return hit ? destinations.find((d) => d.slug === hit.slug) : null;
  }, [europeanField, destinationCities]);

  const flagCode = matchedCountry ? destinationSlugToCode[matchedCountry.slug] : undefined;

  const basePrice = useMemo(() => {
    if (outboundTripInfo) return outboundTripInfo.pricePerSeat;
    if (!matchedCountry) return 100;
    const n = parseFloat(matchedCountry.price || "100");
    return isNaN(n) ? 100 : n;
  }, [matchedCountry, outboundTripInfo]);

  const currency = useMemo(() => {
    if (outboundTripInfo) return outboundTripInfo.currency === "GBP" ? "£" : "€";
    return matchedCountry?.currency || "€";
  }, [outboundTripInfo, matchedCountry]);

  // Rezolvare nume oraș → City ID din DB. Strip-uiesc sufixul ", Țară" din
  // ambele câmpuri fiindcă la direcția EU→MD `from` poate fi "London, Anglia".
  const fromCityName = from.split(",")[0].trim();
  const toCityName = to.split(",")[0].trim();
  // Chișinău e HUB-ul: toate cursele merg fizic prin Chișinău. Orașele din Moldova
  // (Comrat, Bălți, Cahul...) sunt puncte de îmbarcare/coborâre pe ACEEAȘI cursă.
  // Deci pentru căutarea cursei mapăm partea Moldova → Chișinău, dar orașul real
  // ales de client rămâne pe rezervare (departureCity/arrivalCity = fromCityName/toCityName).
  const chisinauId = useMemo(() => {
    if (!cityIndex) return null;
    return cityIndex["chișinău"]?.id ?? cityIndex["chisinau"]?.id ?? null;
  }, [cityIndex]);
  const originCityId = useMemo(() => {
    if (!cityIndex) return null;
    if (direction === "md-to-eu") return chisinauId; // origine Moldova → hub
    return cityIndex[fromCityName.toLowerCase()]?.id ?? null;
  }, [cityIndex, fromCityName, direction, chisinauId]);
  const destCityId = useMemo(() => {
    if (!cityIndex) return null;
    if (direction === "eu-to-md") return chisinauId; // destinație Moldova → hub
    return cityIndex[toCityName.toLowerCase()]?.id ?? null;
  }, [cityIndex, toCityName, direction, chisinauId]);

  // Când se schimbă EFECTIV ruta (originCityId/destCityId de trip), cursele alese
  // nu mai sunt valide → le resetăm. Altfel, în panou (calendar colapsat), cursa
  // veche rămânea selectată iar canContinue rămânea true peste o rută nouă →
  // submit pe cursa greșită. Ignorăm prima stabilire (prevRouteKey null).
  const prevRouteKey = useRef<string | null>(null);
  useEffect(() => {
    if (!originCityId || !destCityId) return;
    const key = `${originCityId}|${destCityId}`;
    if (prevRouteKey.current !== null && prevRouteKey.current !== key) {
      setOutboundTripId(null);
      setOutboundSeats([]);
      setOutboundTripInfo(null);
      setReturnTripId(null);
      setReturnSeats([]);
      setReturnTripInfo(null);
    }
    prevRouteKey.current = key;
  }, [originCityId, destCityId]);

  const total = useMemo(() => {
    if (mode === "colet") {
      // Tarif fix: 1.5 EUR/kg pe toate rutele non-UK, 1.5 GBP/kg pe Anglia.
      // Valuta o stabilim din `currency` (£ pentru UK, € altfel). Sub 1 kg se
      // taxează ca 1 kg (aceeași formulă ca serverul — afișat = taxat).
      const w = parseFloat(parcel.weight) || 0;
      const billable = w > 0 ? Math.max(1, w) : 0;
      return Math.round(billable * 1.5);
    }
    const pax = Math.max(1, outboundSeats.length || 1);
    const multi = trip === "return" ? 2 : 1; // tur-retur = dus + retur integral
    return Math.round(basePrice * pax * multi);
  }, [mode, basePrice, outboundSeats.length, trip, parcel.weight]);

  // Preț afișat doar după o selecție relevantă — altfel apărea un "100€" fals
  // (fallback-ul DEFAULT_BASE) înainte ca userul să aleagă măcar destinația.
  const hasPriceBasis = mode === "colet"
    ? (parseFloat(parcel.weight) || 0) > 0
    : Boolean(outboundTripInfo || matchedCountry);
  // Total efectiv: prețul manual al operatorului (embedded) suprascrie calculul.
  const hasCustomPrice = embedded && customPrice.trim() !== "" && Number.isFinite(parseFloat(customPrice));
  const effectiveTotal = hasCustomPrice ? Math.round(parseFloat(customPrice)) : total;
  const displayTotal = hasPriceBasis || hasCustomPrice ? `${effectiveTotal}${currency}` : null;

  if (result) {
    if (embedded) {
      return (
        <div className="mx-auto max-w-xl rounded-2xl border border-[color:var(--ink-200)] bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-2xl">✓</div>
          <h2 className="text-xl font-extrabold text-[color:var(--navy-900)]">Rezervare creată</h2>
          <p className="mt-1 text-sm text-[color:var(--ink-500)]">
            Nr. <span className="font-mono font-bold text-[color:var(--navy-900)]">{result.bookingNumber}</span> ·
            {" "}{result.price}{result.currency === "GBP" ? "£" : "€"} · email trimis clientului
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href="/panou" className="inline-flex items-center gap-2 rounded-full bg-[color:var(--navy-900)] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110">
              Înapoi la panou
            </Link>
            <button
              onClick={() => { setResult(null); setStep(0); }}
              className="inline-flex items-center gap-2 rounded-full bg-[color:var(--red-500)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--red-600)]"
            >
              Rezervare nouă
            </button>
          </div>
        </div>
      );
    }
    return <SuccessCard bookingNumber={result.bookingNumber} ticketUrl={result.ticketUrl} mode={mode} />;
  }

  const next = () => {
    scrollToStepTop();
    setStep((s) => Math.min(steps.length - 1, s + 1));
  };
  const back = () => {
    scrollToStepTop();
    setStep((s) => Math.max(0, s - 1));
  };

  // Schimb numărul de pasageri → resetează scaunele alese (s-ar putea să nu mai
  // fie suficiente / corecte ca număr) și sincronizează lista de extra-pasageri.
  const updatePassengers = (n: number) => {
    const next = Math.max(1, Math.min(4, n));
    if (next === passengers) return;
    setPassengers(next);
    setOutboundSeats([]);
    setReturnSeats([]);
    setExtraPassengers((prev) => {
      const target = next - 1;
      if (prev.length === target) return prev;
      if (prev.length > target) return prev.slice(0, target);
      return [...prev, ...Array.from({ length: target - prev.length }, () => ({ firstName: "", lastName: "" }))];
    });
  };

  // Inversează direcția (Moldova ↔ Europa). Reset cursele alese fiindcă ruta
  // s-a schimbat și ID-urile vechi nu mai sunt valide.
  const swapDirection = () => {
    setFrom(to);
    setTo(from);
    setOutboundTripId(null);
    setOutboundSeats([]);
    setOutboundTripInfo(null);
    setReturnTripId(null);
    setReturnSeats([]);
    setReturnTripInfo(null);
  };

  const canContinue = (() => {
    if (mode !== "bilet") {
      // Colet: fără datele minime nu are sens să avansezi — serverul oricum
      // respinge (nume/telefon/email expeditor lipsă), iar fără greutate prețul
      // afișat e 0. Destinatarul rămâne opțional prin design (se coordonează
      // telefonic — vezi comentariul din PartyForm).
      if (step === 0) return !!from.trim() && !!to.trim();
      // Operatorul poate crea rezervări fără email (mulți clienți nu au).
      if (step === 1) return !!sender.name.trim() && !!sender.phone.trim() && (embedded || !!sender.email.trim());
      if (step === 3) return (parseFloat(parcel.weight) || 0) > 0;
      return true;
    }
    if (step === 0) {
      // Pasul "Călătorie": from/to alese + cursă dus + scaune = pasageri.
      return (
        !!from.trim() &&
        !!to.trim() &&
        !!outboundTripId &&
        outboundSeats.length === passengers
      );
    }
    if (step === 1 && trip === "return") {
      return !!returnTripId && returnSeats.length === passengers;
    }
    // Pasul Pasageri: nume + prenume + telefon obligatorii (serverul oricum
    // respinge fără ele — nu lăsăm operatorul/clientul să ajungă la Plată degeaba).
    // Email obligatoriu doar pe site; operatorul poate să nu-l aibă.
    if ((step === 1 && trip === "one") || (step === 2 && trip === "return")) {
      const extras = extraPassengers.slice(0, Math.max(0, passengers - 1));
      return (
        !!person.firstName.trim() &&
        !!person.lastName.trim() &&
        !!person.phone.trim() &&
        (embedded || !!person.email.trim()) &&
        extras.every((p) => !!p.firstName.trim() && !!p.lastName.trim())
      );
    }
    return true;
  })();

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const pax = Math.max(1, outboundSeats.length || 1);
      // Construim numele tuturor pasagerilor — pasagerul 1 din `person`, restul
      // din `extraPassengers`. Le concatenăm cu ", " ca să încapă în firstName/
      // lastName fără schemă nouă; la afișarea biletului le re-spargem după ", ".
      const allNames: PassengerName[] = [
        { firstName: person.firstName.trim(), lastName: person.lastName.trim() },
        ...extraPassengers
          .slice(0, Math.max(0, pax - 1))
          .map((p) => ({ firstName: p.firstName.trim(), lastName: p.lastName.trim() })),
      ];
      const firstNameCombined = allNames.map((p) => p.firstName).join(", ");
      const lastNameCombined = allNames.map((p) => p.lastName).join(", ");
      const body =
        mode === "bilet"
          ? {
              type: "passenger",
              tripType: trip === "return" ? "round-trip" : "one-way",
              // Operatorul poate personaliza textul de pe bilet (adresă exactă).
              departureCity: embedded && customFrom.trim() ? customFrom.trim() : fromCityName,
              arrivalCity: embedded && customTo.trim() ? customTo.trim() : toCityName,
              departureDate: date,
              returnDate: trip === "return" ? returnDate : undefined,
              firstName: firstNameCombined,
              lastName: lastNameCombined,
              email: person.email,
              phone: person.phone,
              adults: pax,
              children: 0,
              tripId: outboundTripId || undefined,
              seatNumbers: outboundSeats,
              returnTripId: trip === "return" ? returnTripId || undefined : undefined,
              returnSeatNumbers: trip === "return" ? returnSeats : undefined,
              payMethod,
              customPrice: hasCustomPrice ? customPrice : undefined,
            }
          : {
              type: "parcel",
              // Sursă unică pentru oraș: pasul Direcție (from/to). Orașul
              // expeditorului / destinatarului din PartyForm e doar fallback.
              // Operatorul poate suprascrie cu text liber (adresă exactă).
              departureCity: embedded && customFrom.trim() ? customFrom.trim() : (fromCityName || sender.city),
              arrivalCity: embedded && customTo.trim() ? customTo.trim() : (toCityName || recipient.city),
              // Data + ora coletului = plecarea cursei pe care a ales-o.
              // Cădere pe data dintr-un input liber doar dacă userul (rare!)
              // n-a putut alege o cursă (rută fără program activ). Data locală,
              // nu UTC — la 01:00 noaptea toISOString() ar da ziua de IERI.
              departureDate: outboundTripInfo?.departureAt || date || new Date().toLocaleDateString("sv-SE"),
              tripId: outboundTripId || undefined,
              firstName: sender.name.split(" ")[0] || sender.name,
              lastName: sender.name.split(" ").slice(1).join(" ") || "—",
              email: sender.email,
              phone: sender.phone,
              adults: 0,
              children: 0,
              parcelWeight: parseFloat(parcel.weight) || undefined,
              // Adresa de ridicare + destinatarul intră în parcelDetails —
              // altfel se pierd complet (schema Booking nu are câmpuri separate).
              parcelDetails: [
                `Greutate: ${parcel.weight}kg · ${parcel.length}×${parcel.width}×${parcel.height} · ${parcel.contents}`,
                sender.address.trim() ? `Ridicare: ${sender.address.trim()}` : null,
                [recipient.name, recipient.phone, recipient.email, recipient.city, recipient.address]
                  .some((v) => v.trim())
                  ? `Destinatar: ${[recipient.name, recipient.phone, recipient.email, recipient.city, recipient.address]
                      .map((v) => v.trim())
                      .filter(Boolean)
                      .join(", ")}`
                  : null,
              ]
                .filter(Boolean)
                .join(" | "),
              payMethod,
              customPrice: hasCustomPrice ? customPrice : undefined,
            };
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) setResult(data.booking);
      else setSubmitError(data.error || "Eroare la procesarea rezervării");
    } catch {
      setSubmitError("Eroare de rețea. Încearcă din nou.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {!embedded && <RouteHero mode={mode} from={fromCityName} to={toCityName} />}

      <section className={embedded ? "relative" : "relative pt-8 pb-20 bg-[color:var(--ink-50)]"}>
        <div className={embedded ? "" : "container-page"}>
          {/* Ancora pentru scroll-to-top la schimbarea pasului. scroll-mt-24 lasă
              ~96px deasupra ca să nu intre sub header-ul sticky. */}
          <div ref={stepAnchorRef} aria-hidden className="scroll-mt-24" />
          <StepBar
            steps={steps}
            current={step}
            onStepClick={(i) => {
              if (i < step) {
                scrollToStepTop();
                setStep(i);
              }
            }}
          />

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr,340px]">
            <div className="min-w-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${mode}-${step}`}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.25 }}
                >
                  {mode === "bilet" ? (
                    <>
                      {/* Pasul 0: Direcție + cursă dus + scaun (combinat) */}
                      {step === 0 && (
                        <div className="space-y-4">
                          <DirectionStep
                            from={from}
                            to={to}
                            trip={trip}
                            passengers={passengers}
                            onFrom={setFrom}
                            onTo={setTo}
                            onTrip={setTrip}
                            onPassengers={updatePassengers}
                            onSwap={swapDirection}
                            locale={locale}
                            fromHide={fromHide}
                            toHide={toHide}
                          />
                          {originCityId && destCityId && (
                            <TripPicker
                              title="Alege ziua plecării"
                              subtitle="Cursa dus"
                              originCityId={originCityId}
                              destCityId={destCityId}
                              maxSeats={passengers}
                              selectedTripId={outboundTripId}
                              selectedSeats={outboundSeats}
                              autoSelectTripId={initialTripId}
                              // Ziua venită din „+ Rezervare pe cursă" — selectăm automat
                              // cursa din acea zi imediat ce operatorul alege orașul.
                              autoSelectDate={embedded ? initialDate : null}
                              // Operator: după ce cursa e aleasă (auto din „+ Rezervare pe
                              // cursă" sau manual), ascunde calendarul — a ales deja data,
                              // nu i-l mai arătăm la fiecare pas. Buton „Schimbă data" dacă vrea.
                              collapsible={embedded}
                              // Operator: fără grila mare de calendar — listă simplă de
                              // date ca text („Duminică 12 iulie · 11:00").
                              compact={embedded}
                              onSelect={(tripId, seats, tripInfo) => {
                                setOutboundTripId(tripId);
                                setOutboundSeats(seats);
                                if (tripInfo !== undefined) setOutboundTripInfo(tripInfo ?? null);
                              }}
                              // MD→EU = ziua de plecare din MD (outbound al țării destinație);
                              // EU→MD = ziua de retur din EU.
                              allowedWeekday={
                                matchedCountry
                                  ? direction === "md-to-eu"
                                    ? getOutboundWeekday(matchedCountry.slug)
                                    : getReturnWeekday(matchedCountry.slug)
                                  : null
                              }
                            />
                          )}
                        </div>
                      )}

                      {/* Pasul 1 (round-trip): Cursa retur + scaun (filtrat după dus) */}
                      {step === 1 && trip === "return" && (
                        <TripPicker
                          title="Cursa retur"
                          subtitle="Alege ziua întoarcerii"
                          originCityId={destCityId}
                          destCityId={originCityId}
                          fromDate={outboundTripInfo?.arrivalAt ?? null}
                          maxSeats={passengers}
                          selectedTripId={returnTripId}
                          selectedSeats={returnSeats}
                          onSelect={(tripId, seats, tripInfo) => {
                            setReturnTripId(tripId);
                            setReturnSeats(seats);
                            if (tripInfo !== undefined) setReturnTripInfo(tripInfo ?? null);
                          }}
                          // Operator: auto-alege prima dată de retur + ascunde calendarul
                          // (a ales deja data dus). Publicul își alege liber returul.
                          autoSelectFirst={embedded}
                          collapsible={embedded}
                          compact={embedded}
                          // Returul are direcția inversă față de cursul dus —
                          // dacă userul a luat dus MD→EU, returul e EU→MD = ziua de retur.
                          allowedWeekday={
                            matchedCountry
                              ? direction === "md-to-eu"
                                ? getReturnWeekday(matchedCountry.slug)
                                : getOutboundWeekday(matchedCountry.slug)
                              : null
                          }
                        />
                      )}

                      {/* Pasul Pasageri */}
                      {((step === 1 && trip === "one") || (step === 2 && trip === "return")) && (
                        <PersonalForm
                          person={person}
                          onChange={setPerson}
                          passengers={passengers}
                          extra={extraPassengers}
                          onExtraChange={setExtraPassengers}
                          embedded={embedded}
                        />
                      )}

                      {/* Pasul Plată */}
                      {((step === 2 && trip === "one") || (step === 3 && trip === "return")) && (
                        <PaymentStep
                          mode={mode}
                          payMethod={payMethod}
                          onPayMethod={setPayMethod}
                          lines={[
                            { label: `${fromCityName} → ${toCityName}`, value: `${basePrice}${currency}` },
                            { label: `Locuri: ${outboundSeats.length || 1}`, value: `×${outboundSeats.length || 1}` },
                            {
                              label: trip === "return" ? "Tur-retur" : "O direcție",
                              value: trip === "return" ? "+80%" : "—",
                            },
                          ]}
                          total={displayTotal ?? "—"}
                          embedded={embedded}
                          customPrice={customPrice}
                          onCustomPrice={setCustomPrice}
                          currency={currency}
                          customFrom={customFrom}
                          customTo={customTo}
                          onCustomFrom={setCustomFrom}
                          onCustomTo={setCustomTo}
                          defaultFrom={fromCityName}
                          defaultTo={toCityName}
                        />
                      )}
                    </>
                  ) : (
                    <>
                      {step === 0 && (
                        <div className="space-y-4">
                          <DirectionStep
                            from={from}
                            to={to}
                            trip={trip}
                            onFrom={setFrom}
                            onTo={setTo}
                            onTrip={setTrip}
                            onSwap={swapDirection}
                            locale={locale}
                            fromHide={fromHide}
                            toHide={toHide}
                            hideTrip
                          />
                          {/* Coletele călătoresc cu autocarul de pasageri. Reutilizăm
                              același TripPicker (cu parcelMode → fără seat picker)
                              ca data și ora afișate pe email/bilet să fie cele reale
                              ale cursei, nu un input liber al userului. */}
                          {originCityId && destCityId && (
                            <TripPicker
                              title="Alege ziua expedierii"
                              subtitle="Coletul pleacă cu cursa de pasageri"
                              originCityId={originCityId}
                              destCityId={destCityId}
                              maxSeats={1}
                              selectedTripId={outboundTripId}
                              selectedSeats={[]}
                              parcelMode
                              collapsible={embedded}
                              compact={embedded}
                              onSelect={(tripId, _seats, tripInfo) => {
                                setOutboundTripId(tripId);
                                if (tripInfo !== undefined) setOutboundTripInfo(tripInfo ?? null);
                              }}
                              allowedWeekday={
                                matchedCountry
                                  ? direction === "md-to-eu"
                                    ? getOutboundWeekday(matchedCountry.slug)
                                    : getReturnWeekday(matchedCountry.slug)
                                  : null
                              }
                            />
                          )}
                        </div>
                      )}
                      {step === 1 && <PartyForm role="Expeditor" data={sender} onChange={setSender} />}
                      {step === 2 && <PartyForm role="Destinatar" data={recipient} onChange={setRecipient} />}
                      {step === 3 && <ParcelForm parcel={parcel} onChange={setParcel} />}
                      {step === 4 && (
                        <PaymentStep
                          mode={mode}
                          payMethod={payMethod}
                          onPayMethod={setPayMethod}
                          lines={[
                            { label: "Livrare colet", value: "standard" },
                            { label: `Greutate: ${parcel.weight || 0} kg`, value: `${parcel.weight || 0} × 1.5 ${currency}` },
                          ]}
                          total={displayTotal ?? "—"}
                          embedded={embedded}
                          customPrice={customPrice}
                          onCustomPrice={setCustomPrice}
                          currency={currency}
                          customFrom={customFrom}
                          customTo={customTo}
                          onCustomFrom={setCustomFrom}
                          onCustomTo={setCustomTo}
                          defaultFrom={fromCityName}
                          defaultTo={toCityName}
                        />
                      )}
                    </>
                  )}
                </motion.div>
              </AnimatePresence>

              {submitError && (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <Info className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>{submitError}</div>
                </div>
              )}

              {step === steps.length - 1 && (
                <label className="mt-4 flex items-start gap-3 cursor-pointer rounded-xl border border-[color:var(--ink-200)] bg-white p-4 hover:border-[color:var(--navy-500)] transition-colors">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[color:var(--red-500)] cursor-pointer shrink-0"
                  />
                  <span className="text-sm text-[color:var(--ink-700)] leading-relaxed">
                    {embedded ? "Clientul a fost informat și acceptă" : "Am citit și accept"}{" "}
                    <a
                      href={mode === "bilet" ? "/termeni-pasageri" : "/termeni-colete"}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-[color:var(--navy-900)] underline decoration-[color:var(--red-500)] underline-offset-2 hover:text-[color:var(--red-500)]"
                    >
                      Termenii și Condițiile {mode === "bilet" ? "de călătorie pasager" : "de transport colete"}
                    </a>
                    {" "}DAVO Group.
                  </span>
                </label>
              )}

              <div className="mt-6 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={back}
                  disabled={step === 0}
                  className="inline-flex items-center gap-2 rounded-full border border-[color:var(--ink-200)] bg-white px-5 py-3 text-sm font-semibold text-[color:var(--navy-900)] hover:border-[color:var(--navy-700)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Înapoi
                </button>

                {step < steps.length - 1 ? (
                  <button
                    type="button"
                    onClick={next}
                    disabled={!canContinue}
                    className="inline-flex items-center gap-2 rounded-full bg-[color:var(--red-500)] px-6 py-3 text-sm font-semibold text-white hover:bg-[color:var(--red-600)] transition-colors shadow-[0_12px_30px_-10px_rgba(225,30,43,0.55)] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Continuă
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={submit}
                    disabled={submitting || !consent}
                    className="inline-flex items-center gap-2 rounded-full bg-[color:var(--success)] px-6 py-3 text-sm font-semibold text-white hover:brightness-110 transition-all shadow-[0_12px_30px_-10px_rgba(16,196,155,0.55)] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Se procesează..." : (
                      <>
                        <CreditCard className="h-4 w-4" />
                        Achită & confirmă
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            <SummaryCard
              mode={mode}
              from={fromCityName}
              to={toCityName}
              date={date}
              returnDate={trip === "return" ? returnDate : undefined}
              flagCode={flagCode}
              country={matchedCountry?.name}
              seats={outboundSeats.map(String)}
              time={outboundTripInfo
                ? new Intl.DateTimeFormat("ro-RO", { hour: "2-digit", minute: "2-digit" }).format(new Date(outboundTripInfo.departureAt))
                : null}
              weight={parcel.weight}
              total={displayTotal}
              embedded={embedded}
            />
          </div>

          {/* Benefits strip */}
          {!embedded && <BenefitsStrip />}
        </div>
      </section>

      {/* Colet la cheie band */}
      {!embedded && <ColetPromoBand />}
    </>
  );
}

/* ---------- Steps ---------- */

function DirectionStep({
  from,
  to,
  trip,
  passengers,
  onFrom,
  onTo,
  onTrip,
  onPassengers,
  onSwap,
  locale,
  fromHide,
  toHide,
  hideTrip = false,
}: {
  from: string;
  to: string;
  trip: "one" | "return";
  passengers?: number;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  onTrip: (v: "one" | "return") => void;
  onPassengers?: (n: number) => void;
  onSwap?: () => void;
  locale: Locale;
  fromHide?: string[];
  toHide?: string[];
  hideTrip?: boolean;
}) {
  return (
    <div className="card-elevated p-6 md:p-8">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-[color:var(--red-500)]">
          Pasul 1
        </span>
        <h2 className="display-hero text-2xl md:text-3xl text-[color:var(--navy-900)]">Direcția deplasării</h2>
      </div>

      <div className="relative grid md:grid-cols-2 gap-4">
        <FancyField label="Plecare din" icon={<MapPin className="h-4 w-4" />}>
          <CountryCityPicker value={from} onChange={onFrom} locale={locale} hideCountries={fromHide} />
        </FancyField>
        <FancyField label="Destinația" icon={<MapPin className="h-4 w-4" />}>
          <CountryCityPicker value={to} onChange={onTo} locale={locale} hideCountries={toHide} />
        </FancyField>
        {onSwap && (
          <button
            type="button"
            onClick={onSwap}
            aria-label="Inversează direcția"
            title="Inversează direcția"
            className="absolute left-1/2 top-1/2 z-10 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[color:var(--ink-200)] bg-white text-[color:var(--navy-900)] shadow-md transition-all hover:scale-105 hover:border-[color:var(--red-500)] hover:text-[color:var(--red-500)]"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </button>
        )}
        <div className="md:col-span-2 -mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-[color:var(--navy-50)] border border-[color:var(--navy-200,rgba(20,58,122,0.18))] px-4 py-2.5 text-xs text-[color:var(--ink-700)]">
          <Info className="h-3.5 w-3.5 text-[color:var(--red-500)] shrink-0" />
          <span>
            Nu găsești orașul în listă? Aranjăm transport personalizat —
          </span>
          <a
            href={`tel:${contactInfo.phone.replace(/\s/g, "")}`}
            className="inline-flex items-center gap-1 font-semibold text-[color:var(--navy-900)] hover:text-[color:var(--red-500)]"
          >
            <Phone className="h-3 w-3" />
            sună la {contactInfo.phone}
          </a>
        </div>
      </div>

      {!hideTrip && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1 rounded-full bg-[color:var(--ink-50)] p-1">
            <TripTypeTab active={trip === "one"} onClick={() => onTrip("one")}>
              O direcție
            </TripTypeTab>
            <TripTypeTab active={trip === "return"} onClick={() => onTrip("return")}>
              Tur-retur
            </TripTypeTab>
          </div>
          {onPassengers && passengers !== undefined && (
            <div className="inline-flex items-center gap-2 rounded-full bg-[color:var(--ink-50)] px-3 py-1">
              <Users className="h-3.5 w-3.5 text-[color:var(--ink-500)]" />
              <span className="text-xs font-semibold text-[color:var(--ink-700)] mr-1">Pasageri</span>
              <button
                type="button"
                onClick={() => onPassengers(passengers - 1)}
                disabled={passengers <= 1}
                aria-label="Scade număr pasageri"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white border border-[color:var(--ink-200)] text-[color:var(--navy-900)] hover:border-[color:var(--navy-500)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                −
              </button>
              <span className="font-bold text-sm text-[color:var(--navy-900)] min-w-[1ch] text-center">
                {passengers}
              </span>
              <button
                type="button"
                onClick={() => onPassengers(passengers + 1)}
                disabled={passengers >= 4}
                aria-label="Crește număr pasageri"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white border border-[color:var(--ink-200)] text-[color:var(--navy-900)] hover:border-[color:var(--navy-500)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                +
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Autocomplete clienți (doar operator): scrii 2-3 litere din nume / telefon /
// email → apar clienții existenți din evidență → îi alegi și se completează.
type ClientHit = { id: string; firstName: string; lastName: string; email: string; phone: string; vip: boolean; source?: "pasager" | "colet" };
function ClientSearch({ onPick }: { onPick: (c: { firstName: string; lastName: string; email: string; phone: string }) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ClientHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/operator/clients?q=${encodeURIComponent(q.trim())}`)
        .then((r) => r.json())
        .then((d) => { setResults(d.clients || []); setOpen(true); })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="relative mb-4">
      <SimpleField label="Caută client existent" icon={<Search className="h-4 w-4" />}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="scrie 2-3 litere din nume / telefon…"
          className="simple-input"
        />
      </SimpleField>
      {open && q.trim().length >= 2 && (
        <div className="absolute z-30 mt-1 w-full overflow-auto rounded-xl border border-[color:var(--ink-200)] bg-white shadow-lg" style={{ maxHeight: 260 }}>
          {loading && results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-[color:var(--ink-500)]">Caut…</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-[color:var(--ink-500)]">Niciun client — se salvează automat la rezervare.</div>
          ) : (
            results.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { onPick({ firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone }); setQ(`${c.firstName} ${c.lastName}`); setOpen(false); }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[color:var(--ink-50)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold text-[color:var(--navy-900)]">{c.firstName} {c.lastName}{c.vip ? " ⭐" : ""}</span>
                    {c.source === "colet" && (
                      <span className="shrink-0 rounded-full bg-[color:var(--ink-100)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--ink-500)]">colet</span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-[color:var(--ink-500)]">{c.phone}{c.email ? ` · ${c.email}` : ""}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function PersonalForm({
  person,
  onChange,
  passengers,
  extra,
  onExtraChange,
  embedded = false,
}: {
  person: { firstName: string; lastName: string; email: string; phone: string; passport: string; note: string };
  onChange: (p: typeof person) => void;
  passengers: number;
  extra: PassengerName[];
  onExtraChange: (next: PassengerName[]) => void;
  embedded?: boolean;
}) {
  const setField = (k: keyof typeof person, v: string) => onChange({ ...person, [k]: v });
  const setExtraField = (i: number, k: keyof PassengerName, v: string) => {
    const next = extra.map((p, idx) => (idx === i ? { ...p, [k]: v } : p));
    onExtraChange(next);
  };
  return (
    <div className="card-elevated p-6 md:p-8">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-[color:var(--red-500)]">
          Informații personale
        </span>
        <h2 className="display-hero text-2xl md:text-3xl text-[color:var(--navy-900)]">
          {passengers > 1 ? `Datele pasagerilor (${passengers})` : "Datele pasagerului"}
        </h2>
      </div>

      {/* Pasagerul 1 — contact principal: nume + date contact. */}
      <div className="rounded-2xl border border-[color:var(--ink-200)] bg-[color:var(--ink-50)] p-5 md:p-6 mb-4">
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[color:var(--navy-700)] mb-3">
          Pasagerul 1 {passengers > 1 ? "(contact principal)" : ""}
        </div>
        {embedded && <ClientSearch onPick={(c) => onChange({ ...person, ...c })} />}
        <div className="grid md:grid-cols-2 gap-4">
          <SimpleField label="Nume *" icon={<User className="h-4 w-4" />}>
            <input
              required
              value={person.firstName}
              onChange={(e) => setField("firstName", e.target.value)}
              placeholder="Popescu"
              className="simple-input"
            />
          </SimpleField>
          <SimpleField label="Prenume *" icon={<User className="h-4 w-4" />}>
            <input
              required
              value={person.lastName}
              onChange={(e) => setField("lastName", e.target.value)}
              placeholder="Ion"
              className="simple-input"
            />
          </SimpleField>
          <SimpleField label="Email *" icon={<Mail className="h-4 w-4" />}>
            <input
              required
              type="email"
              value={person.email}
              onChange={(e) => setField("email", e.target.value)}
              placeholder="ion@email.com"
              className="simple-input"
            />
          </SimpleField>
          <SimpleField label="Telefon *" icon={<Phone className="h-4 w-4" />}>
            <input
              required
              type="tel"
              value={person.phone}
              onChange={(e) => setField("phone", e.target.value)}
              placeholder="+373 68 065 699"
              className="simple-input"
            />
          </SimpleField>
          <SimpleField label="Serie pașaport" icon={<Info className="h-4 w-4" />}>
            <input
              value={person.passport}
              onChange={(e) => setField("passport", e.target.value)}
              placeholder="AB0000000"
              className="simple-input"
            />
          </SimpleField>
        </div>
      </div>

      {/* Pasagerii 2..N — doar nume + prenume. */}
      {passengers > 1 && (
        <div className="space-y-3 mb-4">
          {Array.from({ length: passengers - 1 }).map((_, i) => {
            const p = extra[i] ?? { firstName: "", lastName: "" };
            return (
              <div key={i} className="rounded-2xl border border-[color:var(--ink-200)] bg-white p-5 md:p-6">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[color:var(--navy-700)] mb-3">
                  Pasagerul {i + 2}
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <SimpleField label="Nume *" icon={<User className="h-4 w-4" />}>
                    <input
                      required
                      value={p.firstName}
                      onChange={(e) => setExtraField(i, "firstName", e.target.value)}
                      placeholder="Popescu"
                      className="simple-input"
                    />
                  </SimpleField>
                  <SimpleField label="Prenume *" icon={<User className="h-4 w-4" />}>
                    <input
                      required
                      value={p.lastName}
                      onChange={(e) => setExtraField(i, "lastName", e.target.value)}
                      placeholder="Maria"
                      className="simple-input"
                    />
                  </SimpleField>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div>
        <SimpleField label="Observații">
          <textarea
            rows={3}
            value={person.note}
            onChange={(e) => setField("note", e.target.value)}
            placeholder="Adaugă o observație (opțional)"
            className="simple-input resize-y min-h-[80px]"
          />
        </SimpleField>
      </div>
      <InputStyles />
    </div>
  );
}

function PartyForm({
  role,
  data,
  onChange,
}: {
  role: "Expeditor" | "Destinatar";
  data: { name: string; phone: string; email: string; city: string; address: string };
  onChange: (d: typeof data) => void;
}) {
  const setField = (k: keyof typeof data, v: string) => onChange({ ...data, [k]: v });
  // Operatorul confirmă fiecare colet manual (verifică dacă autocarul oprește
  // în orașul respectiv, stabilește ora de pickup sau drop-off la oficiu).
  // Deci câmpurile detaliate sunt opționale — userul completează ce știe acum,
  // restul se aliniază prin telefon.
  // - Expeditor: nume + telefon obligatorii (ca să-l putem suna înapoi).
  // - Destinatar: complet opțional (operatorul coordonează cu expeditorul).
  const isSender = role === "Expeditor";
  const helperText = isSender
    ? "Operatorul te sună pentru confirmare și pentru a stabili ora de pickup sau de venire la oficiu (Calea Ieșilor 11/3). Completează ce știi acum."
    : "Datele destinatarului sunt opționale — le poți lăsa goale și le clarificăm la confirmarea telefonică.";

  return (
    <div className="card-elevated p-6 md:p-8">
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-[color:var(--red-500)]">
          {role}
        </span>
        <h2 className="display-hero text-2xl md:text-3xl text-[color:var(--navy-900)]">
          Datele {isSender ? "expeditorului" : "destinatarului"}
        </h2>
      </div>
      <p className="mb-5 text-sm text-[color:var(--ink-500)] leading-relaxed">{helperText}</p>
      <div className="grid md:grid-cols-2 gap-4">
        <SimpleField label={isSender ? "Nume complet *" : "Nume complet"} icon={<User className="h-4 w-4" />}>
          <input
            required={isSender}
            value={data.name}
            onChange={(e) => setField("name", e.target.value)}
            placeholder="Popescu Ion"
            className="simple-input"
          />
        </SimpleField>
        <SimpleField label={isSender ? "Telefon *" : "Telefon"} icon={<Phone className="h-4 w-4" />}>
          <input
            required={isSender}
            type="tel"
            value={data.phone}
            onChange={(e) => setField("phone", e.target.value)}
            className="simple-input"
          />
        </SimpleField>
        {/* Emailul expeditorului e obligatoriu — acolo pleacă confirmarea
            rezervării (serverul respinge fără el). */}
        <SimpleField label={isSender ? "Email *" : "Email"} icon={<Mail className="h-4 w-4" />}>
          <input
            required={isSender}
            type="email"
            value={data.email}
            onChange={(e) => setField("email", e.target.value)}
            className="simple-input"
          />
        </SimpleField>
        {/* Orașul a fost ales la pasul Direcție atât pentru expeditor (originea
            cursei) cât și pentru destinatar (destinația cursei). Nu mai cerem
            re-tastarea — cauza apariției "Recke" liber în DB era exact asta. */}
      </div>
      <div className="mt-4">
        <SimpleField label="Adresă completă" icon={<MapPin className="h-4 w-4" />}>
          <input
            value={data.address}
            onChange={(e) => setField("address", e.target.value)}
            placeholder="Strada, număr, apartament — opțional"
            className="simple-input"
          />
        </SimpleField>
      </div>
      <InputStyles />
    </div>
  );
}

function ParcelForm({
  parcel,
  onChange,
}: {
  parcel: {
    weight: string;
    length: string;
    width: string;
    height: string;
    contents: string;
  };
  onChange: (p: typeof parcel) => void;
}) {
  const setField = (k: keyof typeof parcel, v: string) => onChange({ ...parcel, [k]: v });
  return (
    <div className="card-elevated p-6 md:p-8">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-[color:var(--red-500)]">
          Colet
        </span>
        <h2 className="display-hero text-2xl md:text-3xl text-[color:var(--navy-900)]">Detaliile coletului</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SimpleField label="Greutate (kg) *" icon={<Package className="h-4 w-4" />}>
          <input
            required
            type="number"
            min="0.1"
            step="0.1"
            value={parcel.weight}
            onChange={(e) => setField("weight", e.target.value)}
            placeholder="5"
            className="simple-input"
          />
        </SimpleField>
        <SimpleField label="Lungime (cm)">
          <input
            type="number"
            value={parcel.length}
            onChange={(e) => setField("length", e.target.value)}
            className="simple-input"
          />
        </SimpleField>
        <SimpleField label="Lățime (cm)">
          <input
            type="number"
            value={parcel.width}
            onChange={(e) => setField("width", e.target.value)}
            className="simple-input"
          />
        </SimpleField>
        <SimpleField label="Înălțime (cm)">
          <input
            type="number"
            value={parcel.height}
            onChange={(e) => setField("height", e.target.value)}
            className="simple-input"
          />
        </SimpleField>
      </div>
      <div className="mt-4">
        <SimpleField label="Conținut *">
          <input
            required
            value={parcel.contents}
            onChange={(e) => setField("contents", e.target.value)}
            placeholder="Haine, documente, cadouri…"
            className="simple-input"
          />
        </SimpleField>
      </div>
      <InputStyles />
    </div>
  );
}

function PaymentStep({
  mode,
  lines,
  total,
  payMethod,
  onPayMethod,
  embedded = false,
  customPrice = "",
  onCustomPrice,
  currency = "€",
  customFrom = "",
  customTo = "",
  onCustomFrom,
  onCustomTo,
  defaultFrom = "",
  defaultTo = "",
}: {
  mode: Mode;
  lines: { label: string; value: string }[];
  total: string;
  payMethod: "card" | "cash";
  onPayMethod: (m: "card" | "cash") => void;
  embedded?: boolean;
  customPrice?: string;
  onCustomPrice?: (v: string) => void;
  currency?: string;
  /** Personalizare operator: text liber pe bilet pentru plecare/destinație
   *  (ex. adresă exactă de îmbarcare). Gol = orașele alese în pasul Direcție. */
  customFrom?: string;
  customTo?: string;
  onCustomFrom?: (v: string) => void;
  onCustomTo?: (v: string) => void;
  defaultFrom?: string;
  defaultTo?: string;
}) {
  const moment = mode === "bilet" ? "îmbarcare" : "livrare";
  return (
    <div className="card-elevated p-6 md:p-8">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-[color:var(--red-500)]">
          Plată & confirmare
        </span>
        <h2 className="display-hero text-2xl md:text-3xl text-[color:var(--navy-900)]">
          Aproape gata — confirmă rezervarea
        </h2>
      </div>

      <div className="rounded-2xl bg-[color:var(--ink-50)] border border-[color:var(--ink-200)] p-5">
        <div className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--ink-500)]">
          Sumar
        </div>
        <div className="mt-3 divide-y divide-[color:var(--ink-200)]">
          {lines.map((l) => (
            <div key={l.label} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="min-w-0 text-[color:var(--ink-700)]">{l.label}</span>
              <span className="shrink-0 font-semibold text-[color:var(--navy-900)]">{l.value}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 pt-3 border-t border-[color:var(--ink-200)]">
          <span className="min-w-0 text-sm font-semibold text-[color:var(--ink-700)]">Total de plată</span>
          <span className="shrink-0 font-[family-name:var(--font-montserrat)] text-3xl font-extrabold text-[color:var(--navy-900)]">
            {total}
          </span>
        </div>
      </div>

      {embedded && onCustomPrice && (
        <div className="mt-4 rounded-xl border-2 border-dashed border-[color:var(--red-500)] bg-[color:var(--red-50)] p-4">
          <label className="block text-[11px] font-bold uppercase tracking-widest text-[color:var(--red-500)]">
            Preț manual (opțional — suprascrie totalul)
          </label>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="1"
              value={customPrice}
              onChange={(e) => onCustomPrice(e.target.value)}
              placeholder="lasă gol pentru prețul standard"
              className="w-40 rounded-lg border border-[color:var(--ink-300)] bg-white px-3 py-2 text-base font-bold text-[color:var(--navy-900)] focus:border-[color:var(--red-500)] focus:outline-none"
            />
            <span className="text-lg font-bold text-[color:var(--navy-900)]">{currency}</span>
            {customPrice.trim() !== "" && (
              <button type="button" onClick={() => onCustomPrice("")} className="ml-auto text-xs font-semibold text-[color:var(--ink-500)] underline">
                resetează
              </button>
            )}
          </div>
        </div>
      )}

      {embedded && onCustomFrom && onCustomTo && (
        <div className="mt-4 rounded-xl border-2 border-dashed border-[color:var(--navy-500)] bg-[color:var(--navy-50)] p-4">
          <label className="block text-[11px] font-bold uppercase tracking-widest text-[color:var(--navy-700)]">
            Adresă personalizată pe bilet (opțional)
          </label>
          <p className="mt-1 text-xs text-[color:var(--ink-500)]">
            Scrie orice — adresă exactă, punct de îmbarcare. Gol = orașele alese la pasul Direcție.
          </p>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <input
              type="text"
              value={customFrom}
              onChange={(e) => onCustomFrom(e.target.value)}
              placeholder={defaultFrom ? `Plecare: ${defaultFrom}` : "Plecare (text liber)"}
              className="rounded-lg border border-[color:var(--ink-300)] bg-white px-3 py-2 text-sm font-semibold text-[color:var(--navy-900)] focus:border-[color:var(--navy-500)] focus:outline-none"
            />
            <input
              type="text"
              value={customTo}
              onChange={(e) => onCustomTo(e.target.value)}
              placeholder={defaultTo ? `Destinație: ${defaultTo}` : "Destinație (text liber)"}
              className="rounded-lg border border-[color:var(--ink-300)] bg-white px-3 py-2 text-sm font-semibold text-[color:var(--navy-900)] focus:border-[color:var(--navy-500)] focus:outline-none"
            />
          </div>
        </div>
      )}

      <div className="mt-5 rounded-xl border border-[color:var(--navy-200,rgba(20,58,122,0.18))] bg-[color:var(--navy-50)] p-4 text-sm text-[color:var(--navy-900)] flex items-start gap-3">
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-[color:var(--navy-700)]" />
        <span>
          {embedded
            ? `Plata se face direct la ${moment} — alege metoda convenită cu clientul. Confirmarea ajunge pe emailul clientului imediat.`
            : `Pe site nu se achită cu cardul. Plata se face direct la ${moment} — alege metoda dorită mai jos. Confirmarea îți ajunge pe email imediat.`}
        </span>
      </div>

      <div className="mt-4 grid md:grid-cols-2 gap-3">
        <label
          className={cn(
            "flex cursor-pointer items-center gap-3 rounded-xl p-4 transition-colors",
            payMethod === "card"
              ? "border-2 border-[color:var(--red-500)] bg-[color:var(--red-50)]"
              : "border border-[color:var(--ink-200)] bg-white hover:border-[color:var(--navy-500)]"
          )}
        >
          <input
            type="radio"
            name="pay"
            checked={payMethod === "card"}
            onChange={() => onPayMethod("card")}
            className="accent-[color:var(--red-500)]"
          />
          <CreditCard className="h-5 w-5 text-[color:var(--red-500)]" />
          <div>
            <div className="font-semibold text-[color:var(--navy-900)]">Card la {moment}</div>
            <div className="text-xs text-[color:var(--ink-500)]">
              Visa, MasterCard, Maestro — la {mode === "bilet" ? "șofer" : "livrare"}
            </div>
          </div>
        </label>
        <label
          className={cn(
            "flex cursor-pointer items-center gap-3 rounded-xl p-4 transition-colors",
            payMethod === "cash"
              ? "border-2 border-[color:var(--red-500)] bg-[color:var(--red-50)]"
              : "border border-[color:var(--ink-200)] bg-white hover:border-[color:var(--navy-500)]"
          )}
        >
          <input
            type="radio"
            name="pay"
            checked={payMethod === "cash"}
            onChange={() => onPayMethod("cash")}
            className="accent-[color:var(--red-500)]"
          />
          <Clock className="h-5 w-5 text-[color:var(--navy-900)]" />
          <div>
            <div className="font-semibold text-[color:var(--navy-900)]">Cash la {moment}</div>
            <div className="text-xs text-[color:var(--ink-500)]">
              Numerar — în Lei, Euro sau GBP
            </div>
          </div>
        </label>
      </div>
    </div>
  );
}

/* ---------- Side summary ---------- */

function SummaryCard({
  mode,
  from,
  to,
  date,
  returnDate,
  flagCode,
  country,
  seats,
  time,
  weight,
  total,
  embedded = false,
}: {
  mode: "bilet" | "colet";
  from: string;
  to: string;
  date: string;
  returnDate?: string;
  flagCode?: (typeof destinationSlugToCode)[string];
  country?: string;
  seats: string[];
  time: string | null;
  weight: string;
  total: string | null;
  embedded?: boolean;
}) {
  return (
    <aside className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl bg-[color:var(--navy-900)] bg-hero-navy text-white p-5">
        <div className="bg-noise absolute inset-0 opacity-30" />
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-[color:var(--red-400)]">
                {mode === "bilet" ? "Biletul tău" : "Coletul tău"}
              </div>
              <div className="mt-2 font-[family-name:var(--font-montserrat)] text-2xl font-extrabold leading-tight break-words">
                {from} <span className="text-[color:var(--red-400)]">→</span> {to.split(",")[0]}
              </div>
              {country && <div className="text-xs text-white/55 mt-0.5 break-words">{country}</div>}
            </div>
            {flagCode && <CountryFlag code={flagCode} className="h-9 w-12 shrink-0" />}
          </div>

          <div className="mt-5 space-y-2 text-sm">
            <Row icon={<Calendar className="h-3.5 w-3.5" />} label="Plecare">
              {formatRoDate(date) || "—"}
            </Row>
            {returnDate && (
              <Row icon={<Calendar className="h-3.5 w-3.5" />} label="Întoarcere">
                {formatRoDate(returnDate)}
              </Row>
            )}
            {time && (
              <Row icon={<Clock className="h-3.5 w-3.5" />} label="Ora">
                {time}
              </Row>
            )}
            {mode === "bilet" && (
              <Row icon={<Users className="h-3.5 w-3.5" />} label="Locuri">
                {seats.length > 0 ? seats.join(", ") : "—"}
              </Row>
            )}
            {mode === "colet" && (
              <Row icon={<Package className="h-3.5 w-3.5" />} label="Greutate">
                {weight ? `${weight} kg` : "—"}
              </Row>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between pt-4 border-t border-white/10">
            <span className="text-xs text-white/55 uppercase tracking-widest font-bold">Total</span>
            {total ? (
              <span className="font-[family-name:var(--font-montserrat)] text-2xl font-extrabold">{total}</span>
            ) : (
              <span className="text-xs font-semibold text-white/45">
                {mode === "colet" ? "se calculează după greutate" : "alege destinația"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Ajutor rapid = telefonul firmei — util clientului de pe site, inutil
          operatorilor din panou (e propriul lor număr). */}
      {!embedded && (
        <div className="rounded-2xl bg-white border border-[color:var(--ink-200)] p-5 space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--ink-500)]">
            Ajutor rapid
          </div>
          <a
            href={`tel:${contactInfo.phone.replace(/\s/g, "")}`}
            className="flex items-center gap-3 text-sm text-[color:var(--navy-900)] font-semibold hover:text-[color:var(--red-500)]"
          >
            <Phone className="h-4 w-4 text-[color:var(--red-500)]" />
            {contactInfo.phone}
          </a>
          <a
            href={`mailto:${contactInfo.email}`}
            className="flex items-center gap-3 text-sm text-[color:var(--navy-900)] font-semibold hover:text-[color:var(--red-500)]"
          >
            <Mail className="h-4 w-4 text-[color:var(--red-500)]" />
            {contactInfo.email}
          </a>
        </div>
      )}
    </aside>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-widest font-bold text-white/50">{label}</div>
        <div className="text-sm font-semibold truncate">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Small shared ---------- */

function FancyField({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="group flex flex-col gap-1.5 rounded-xl border border-[color:var(--ink-200)] bg-white px-4 py-3 transition-colors hover:border-[color:var(--navy-500)] focus-within:border-[color:var(--navy-700)]">
      <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-[color:var(--ink-500)]">
        <span className="text-[color:var(--red-500)]">{icon}</span>
        {label}
      </span>
      <div>{children}</div>
    </label>
  );
}

function SimpleField({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-[color:var(--ink-500)] mb-1.5">
        {icon && <span className="text-[color:var(--red-500)]">{icon}</span>}
        {label}
      </span>
      {children}
    </label>
  );
}

function TripTypeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
        active ? "bg-[color:var(--navy-900)] text-white" : "text-[color:var(--ink-500)]"
      )}
    >
      {children}
    </button>
  );
}

function InputStyles() {
  return (
    <style jsx global>{`
      .simple-input {
        width: 100%;
        border-radius: 12px;
        border: 1px solid var(--ink-200);
        background: #fff;
        padding: 0.8rem 1rem;
        font-size: 0.95rem;
        color: var(--navy-900);
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
        outline: none;
      }
      .simple-input:focus {
        border-color: var(--navy-700);
        box-shadow: 0 0 0 3px rgb(20 58 122 / 0.12);
      }
      .simple-input::placeholder {
        color: var(--ink-400);
      }
    `}</style>
  );
}

function BenefitsStrip() {
  const items = [
    { icon: ShieldCheck, label: "Siguranță 100%" },
    { icon: Truck, label: "Curse zilnice" },
    { icon: Users, label: "Însoțitor la bord" },
    { icon: Mail, label: "Confirmare pe email" },
  ];
  return (
    <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((b) => (
        <div
          key={b.label}
          className="flex items-center gap-3 rounded-xl border border-[color:var(--ink-200)] bg-white p-3"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[color:var(--navy-50)] text-[color:var(--navy-800)]">
            <b.icon className="h-4 w-4" />
          </div>
          <div className="text-sm font-semibold text-[color:var(--navy-900)]">{b.label}</div>
        </div>
      ))}
    </div>
  );
}

function ColetPromoBand() {
  return (
    <section className="py-16">
      <div className="container-page">
        <div className="relative overflow-hidden rounded-3xl bg-[color:var(--navy-900)] bg-hero-navy text-white">
          <div className="bg-noise absolute inset-0 opacity-30" />
          <div className="relative px-8 md:px-12 py-12 md:py-14 text-center">
            <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-[color:var(--red-400)]">
              Serviciu premium
            </div>
            <h3 className="mt-3 display-hero text-3xl md:text-4xl">
              Colet la cheie din Moldova
            </h3>
            <p className="mt-3 text-white/65 max-w-xl mx-auto">
              Ambalare, documente, livrare la destinație — noi ne ocupăm de tot, tu doar trimiți.
            </p>
            <div className="mt-7">
              <Link
                href="/rezervare?mode=colet"
                className="inline-flex items-center gap-2 rounded-full bg-[color:var(--red-500)] px-6 py-3.5 font-semibold text-white hover:bg-[color:var(--red-600)] transition-colors shadow-[0_18px_40px_-12px_rgba(225,30,43,0.45)]"
              >
                Solicită oferta
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
