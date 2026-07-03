// Tipurile folosite de UI-ul admin. Datele reale vin din DB prin /api/admin/*.
// Numele cu prefixul `Mock` sunt păstrate pentru a minimiza churn-ul în imports —
// semantica acum este "tipul pe care îl returnează API-ul".

// Elemente non-scaun pentru schemele realiste de autocar:
// - stairs: scară între etaje (sau spre nivelul de bagaje)
// - table: măsuță VIP (între locuri orientate față-în-față)
// - cafe: zonă de café/bar (auxiliar pe etajul VIP)
// - crew: scaun rezervat pentru însoțitorul de bord (nu se vinde)
// - exit: ușă / ieșire (punct de îmbarcare-debarcare, nu se vinde)
export type SeatKind =
  | "seat"
  | "aisle"
  | "wc"
  | "driver"
  | "empty"
  | "stairs"
  | "table"
  | "cafe"
  | "crew"
  | "exit";

export type SeatLayout = {
  rows: number;
  cols: number;
  cells: SeatKind[];
  // Direcția de numerotare în interiorul fiecărui rând:
  //  - "ltr" (default): primul scaun stânga-sus = 1, apoi spre dreapta.
  //  - "rtl": primul scaun dreapta-sus = 1 (convenția europeană uzuală
  //    pentru autocarele cu ușa de îmbarcare pe partea dreaptă).
  direction?: "ltr" | "rtl";
  // Numărul primului scaun (default 1). Util pentru autocarele cu mai
  // multe etaje afișate ca SeatLayout-uri separate: etajul 2 poate
  // continua numerotarea de la unde s-a terminat etajul 1.
  seatStart?: number;
  // Suprascrieri manuale de numerotare, cheie = indexul celulei în `cells`.
  // Un scaun cu override devine "ancoră": numerotarea automată continuă de la
  // acel număr înainte (ex: dacă scaunul #4 e setat la 99, următoarele devin
  // 100, 101…). Permite potrivirea cu numerotarea fizică reală a autocarului.
  seatOverrides?: Record<number, number>;
};

// Calculează numărul afișat pentru fiecare celulă, respectând direcția de
// numerotare, scaunul de start și suprascrierile manuale. Returnează un array
// paralel cu `cells`: numărul scaunului sau `null` pentru celulele non-scaun.
// Folosit identic de SeatPicker (public) și de editorul admin, ca să nu existe
// divergențe între ce vede adminul și ce vede pasagerul.
export function computeSeatNumbers(layout: SeatLayout): (number | null)[] {
  const dir = layout.direction ?? "ltr";
  const overrides = layout.seatOverrides ?? {};
  const result: (number | null)[] = new Array(layout.cells.length).fill(null);
  let n = layout.seatStart ?? 1;
  for (let r = 0; r < layout.rows; r++) {
    const cols = layout.cols;
    const range =
      dir === "rtl"
        ? Array.from({ length: cols }, (_, k) => cols - 1 - k) // dreapta → stânga
        : Array.from({ length: cols }, (_, k) => k); // stânga → dreapta
    for (const c of range) {
      const idx = r * cols + c;
      if (layout.cells[idx] === "seat") {
        const override = overrides[idx];
        if (override != null) n = override; // ancoră: repornește secvența
        result[idx] = n;
        n++;
      }
    }
  }
  return result;
}

// Autocarele pot avea mai multe etaje (ex: Van Hool Astromega). Fiecare etaj
// e un SeatLayout independent, cu propria orientare și interval de scaune.
// Pentru autocarele single-deck folosim direct SeatLayout (back-compat).
export type MultiDeckLayout = {
  decks: { label?: string; layout: SeatLayout }[];
};

export type BusLayout = SeatLayout | MultiDeckLayout;

export function isMultiDeck(b: BusLayout): b is MultiDeckLayout {
  return Array.isArray((b as MultiDeckLayout).decks);
}

export function countSeatsInLayout(b: BusLayout): number {
  if (isMultiDeck(b)) {
    return b.decks.reduce(
      (s, d) => s + d.layout.cells.filter((c) => c === "seat").length,
      0,
    );
  }
  return b.cells.filter((c) => c === "seat").length;
}

export type MockRoute = {
  id: string;
  origin: string;
  destination: string;
  country: string;
  basePrice: number;
  currency: string;
  active: boolean;
  description: string;
  weeklyDepartures: number;
  originCityId?: string;
  destinationCityId?: string;
};

export type MockBus = {
  id: string;
  plate: string;
  label: string;
  model: string;
  year: number;
  totalSeats: number;
  active: boolean;
  layout: SeatLayout;
};

export type TripStatus =
  | "scheduled"
  | "boarding"
  | "en_route"
  | "completed"
  | "cancelled";

export type MockTrip = {
  id: string;
  routeId: string;
  routeLabel: string;
  busId: string;
  busLabel: string;
  departureAt: string;
  arrivalAt: string;
  status: TripStatus;
  capacity: number;
  booked: number;
  revenue: number;
};

export type MockClient = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  bookings: number;
  totalSpent: number;
  lastTripAt: string | null;
  vip: boolean;
  notes?: string | null;
  routes?: string[];
};

export type EmailStatus = "sent" | "failed" | "queued" | "scheduled";
export type EmailType =
  | "confirmation"
  | "reminder_24h"
  | "cancellation";

export type MockEmail = {
  id: string;
  type: EmailType;
  to: string;
  subject: string;
  status: EmailStatus;
  sendAt: string;
  sentAt?: string | null;
  bookingNumber: string;
  error?: string | null;
};

export type CityOption = { id: string; name: string; slug: string; countryName: string };
