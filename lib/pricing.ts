import { destinations, moldovanCities } from "./data";

export interface PriceInput {
  departureCity: string;
  arrivalCity: string;
  type: "passenger" | "parcel";
  tripType?: "one-way" | "round-trip";
  adults?: number;
  children?: number;
  parcelWeight?: number | null;
}

export interface PriceResult {
  price: number;
  currency: string;
}

function normalize(s: string) {
  return s.trim().toLowerCase();
}

function findCity(cityName: string) {
  const name = normalize(cityName);
  if (moldovanCities.some((c) => normalize(c.name) === name)) {
    return { fromMoldova: true as const, country: null };
  }
  const country = destinations.find((d) =>
    d.cities.some((c) => normalize(c.name) === name)
  );
  return { fromMoldova: false as const, country: country ?? null };
}

const DEFAULT_BASE_PRICE = 100;
// Tur-retur = dus + retur plătite integral (fără reducere): ×2.
const ROUND_TRIP_MULTIPLIER = 2;

// Locuri PREMIUM per autocar: pe DAW 777 (Astromega), locurile 1–8 și 25–28
// costă +30 (în valuta rutei) față de restul. Sursa de adevăr e AICI — serverul
// calculează prețul salvat, frontend-ul doar afișează aceeași formulă.
const PREMIUM_SEATS: Record<string, { seats: number[]; amount: number }> = {
  "DAW 777": { seats: [1, 2, 3, 4, 5, 6, 7, 8, 25, 26, 27, 28], amount: 30 },
};

export function premiumSeatRule(plate: string | null | undefined): { seats: number[]; amount: number } | null {
  if (!plate) return null;
  return PREMIUM_SEATS[plate.trim().toUpperCase()] ?? null;
}

// Suplimentul total pentru locurile alese pe un segment (0 dacă autocarul n-are locuri premium).
export function seatSurcharge(plate: string | null | undefined, seatNumbers: number[]): number {
  const rule = premiumSeatRule(plate);
  if (!rule) return 0;
  const premium = new Set(rule.seats);
  return seatNumbers.reduce((s, n) => s + (premium.has(n) ? rule.amount : 0), 0);
}
const CHILD_DISCOUNT = 0.5;
// Tarif colete: 1.5/kg în valuta rutei (EUR, sau GBP pe Anglia). Aceeași formulă
// ca în UI (BookingForm) — prețul afișat clientului trebuie să fie cel salvat.
const PARCEL_PER_KG = 1.5;

export function calculateParcelPrice(weight: number | null | undefined, currency: string): PriceResult {
  // Sub 1 kg se taxează ca 1 kg — altfel round(0.3 × 1.5) = 0 → colet gratis.
  const w = weight && weight > 0 ? Math.max(1, weight) : 1;
  return { price: Math.round(w * PARCEL_PER_KG), currency };
}

export function calculatePrice(input: PriceInput): PriceResult {
  const from = findCity(input.departureCity);
  const to = findCity(input.arrivalCity);

  const foreign = !from.fromMoldova ? from.country : to.country;

  const basePrice = parseFloat(foreign?.price || "") || DEFAULT_BASE_PRICE;
  const currency = foreign?.currency === "£" ? "GBP" : "EUR";

  if (input.type === "parcel") {
    return calculateParcelPrice(input.parcelWeight, currency);
  }

  const adults = Math.max(1, input.adults ?? 1);
  const children = Math.max(0, input.children ?? 0);
  let total = basePrice * adults + basePrice * CHILD_DISCOUNT * children;
  if (input.tripType === "round-trip") total *= ROUND_TRIP_MULTIPLIER;

  return { price: Math.round(total * 100) / 100, currency };
}

export function calculatePriceFromRoute(input: {
  basePrice: number;
  currency: string;
  seats: number;
  roundTrip: boolean;
}): PriceResult {
  const seats = Math.max(1, input.seats);
  let total = input.basePrice * seats;
  if (input.roundTrip) total *= ROUND_TRIP_MULTIPLIER;
  return { price: Math.round(total * 100) / 100, currency: input.currency };
}
