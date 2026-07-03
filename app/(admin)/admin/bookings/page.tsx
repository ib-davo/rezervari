"use client";

import { useEffect, useMemo, useState } from "react";
import {
  RefreshCw,
  Search,
  Eye,
  Mail,
  Download,
  Filter,
  Plus,
  ArrowDownUp,
  Pencil,
  X,
} from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Badge from "@/components/admin/Badge";
import { statusMeta } from "@/lib/adminLabels";
import { destinations, moldovanCities } from "@/lib/data";
import { BusSeatMap } from "@/components/booking/BusSeatMap";
import type { BusLayout } from "@/lib/adminMock";

type Booking = {
  id: string;
  bookingNumber: string;
  type: "passenger" | "parcel";
  status: "pending" | "confirmed" | "cancelled" | "completed";
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  departureCity: string;
  arrivalCity: string;
  departureDate: string;
  price: number;
  currency: string;
  createdAt: string;
  emailSent: boolean;
  passengerResponse: "confirmed" | "cancelled" | null;
  passengerResponseAt: string | null;
  parcelDetails?: string | null;
};

const responseOptions = [
  { value: "confirmed", label: "A confirmat", variant: "green" as const, icon: "✓" },
  { value: "cancelled", label: "A anulat din email", variant: "red" as const, icon: "✗" },
];

const statusOptions = [
  { value: "pending", label: "În așteptare" },
  { value: "confirmed", label: "Confirmată" },
  { value: "cancelled", label: "Anulată" },
  { value: "completed", label: "Finalizată" },
];

// Lookup oraș → țară. Pornim de la `destinations` (orașele străine) și adăugăm
// Moldova pentru toate orașele moldovene + Chișinău (default origin). Cheile
// sunt normalizate (lowercase + diacritice scoase) pentru a tolera variații.
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

const cityToCountry: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const d of destinations) {
    for (const c of d.cities) m.set(normalize(c.name), d.name);
  }
  for (const c of moldovanCities) m.set(normalize(c.name), "Moldova");
  m.set(normalize("Chișinău"), "Moldova");
  m.set(normalize("Chisinau"), "Moldova");
  return m;
})();

const COUNTRY_OPTIONS = ["Moldova", ...destinations.map((d) => d.name)];

// Pentru flow-ul colet-la-cheie arrivalCity e formatată ca "Oraș, Țară" —
// extragem partea după ultima virgulă dacă pică în lista cunoscută.
function countryOf(city: string): string | null {
  const direct = cityToCountry.get(normalize(city));
  if (direct) return direct;
  const idx = city.lastIndexOf(",");
  if (idx >= 0) {
    const tail = city.slice(idx + 1).trim();
    if (COUNTRY_OPTIONS.some((c) => normalize(c) === normalize(tail))) return tail;
    const lookup = cityToCountry.get(normalize(tail));
    if (lookup) return lookup;
  }
  return null;
}

type PeriodFilter = "all" | "today" | "this_week" | "next_week" | "this_month";

const periodOptions: { value: PeriodFilter; label: string }[] = [
  { value: "all", label: "Orice perioadă" },
  { value: "today", label: "Astăzi" },
  { value: "this_week", label: "Săptămâna aceasta" },
  { value: "next_week", label: "Săptămâna viitoare" },
  { value: "this_month", label: "Luna aceasta" },
];

// Range cu zilele de Luni 00:00 → Duminică 23:59:59.999 ale săptămânii care
// conține `ref`. Folosit pentru filtrul „săptămâna aceasta / viitoare” pe
// departureDate. Săptămâna ISO (Luni e prima zi) — convenția RO.
function isoWeekRange(ref: Date): { start: Date; end: Date } {
  const start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const day = start.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diffToMonday);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  end.setMilliseconds(-1);
  return { start, end };
}

function periodRange(p: PeriodFilter, now: Date): { start: Date; end: Date } | null {
  if (p === "all") return null;
  if (p === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    end.setMilliseconds(-1);
    return { start, end };
  }
  if (p === "this_week") return isoWeekRange(now);
  if (p === "next_week") {
    const next = new Date(now);
    next.setDate(next.getDate() + 7);
    return isoWeekRange(next);
  }
  // this_month
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  end.setMilliseconds(-1);
  return { start, end };
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [responseFilter, setResponseFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  // Filtru pe dată exactă a plecării (YYYY-MM-DD). Când e setat, înlocuiește
  // filtrul de perioadă presetată — userul a ales o zi anume.
  const [dateFilter, setDateFilter] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Booking | null>(null);

  async function fetchBookings() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/bookings");
      const data = await res.json();
      if (data?.success) setBookings(data.bookings);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBookings();
  }, []);

  async function handleStatusChange(id: string, newStatus: string) {
    try {
      const res = await fetch(`/api/admin/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) fetchBookings();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleResendEmail(id: string) {
    try {
      const res = await fetch(`/api/admin/bookings/${id}/resend-email`, {
        method: "POST",
      });
      if (res.ok) {
        alert("Email retrimis cu succes!");
        fetchBookings();
      }
    } catch {
      alert("Eroare la retrimiterea emailului");
    }
  }

  const range = periodRange(periodFilter, new Date());
  const filtered = bookings.filter((b) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      b.bookingNumber.toLowerCase().includes(q) ||
      b.email.toLowerCase().includes(q) ||
      b.phone.includes(searchQuery) ||
      `${b.firstName} ${b.lastName}`.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || b.status === statusFilter;
    const matchesType = typeFilter === "all" || b.type === typeFilter;
    const matchesResponse =
      responseFilter === "all" ||
      (responseFilter === "none"
        ? !b.passengerResponse
        : b.passengerResponse === responseFilter);
    let matchesPeriod = true;
    if (dateFilter) {
      // Comparăm doar partea de dată (YYYY-MM-DD) — ignorăm ora ca să prindem
      // toate cursele din ziua aleasă, indiferent de ora plecării.
      const dep = new Date(b.departureDate);
      const depKey = `${dep.getFullYear()}-${String(dep.getMonth() + 1).padStart(2, "0")}-${String(dep.getDate()).padStart(2, "0")}`;
      matchesPeriod = depKey === dateFilter;
    } else if (range) {
      const dep = new Date(b.departureDate);
      matchesPeriod = dep >= range.start && dep <= range.end;
    }
    const matchesCountry =
      countryFilter === "all" ||
      countryOf(b.departureCity) === countryFilter ||
      countryOf(b.arrivalCity) === countryFilter;
    return matchesSearch && matchesStatus && matchesType && matchesResponse && matchesPeriod && matchesCountry;
  });

  return (
    <div>
      <PageHeader
        title="Rezervări"
        subtitle={`${bookings.length} înregistrări în baza de date`}
        actions={
          <>
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-600"
            >
              <Plus className="h-3.5 w-3.5" /> Rezervare manuală
            </button>
            <button
              onClick={fetchBookings}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Actualizare
            </button>
            <button
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={() => alert("Export CSV — conectăm când avem DB finală")}
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Caută după număr, email, telefon sau nume…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-orange-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Filter className="h-3.5 w-3.5" /> Filtre:
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-200"
        >
          <option value="all">Toate statusurile</option>
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-200"
        >
          <option value="all">Toate tipurile</option>
          <option value="passenger">Pasageri</option>
          <option value="parcel">Colete</option>
        </select>
        <select
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)}
          disabled={!!dateFilter}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-200 disabled:opacity-50"
          title={dateFilter ? "Dezactivat — filtrul de dată exactă e activ" : "Filtrează după data plecării"}
        >
          {periodOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-200"
            title="Dată exactă a plecării"
          />
          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter("")}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
              title="Șterge filtrul de dată"
            >
              ✕
            </button>
          )}
        </div>
        <select
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-200"
          title="Filtrează după țara de plecare sau destinație"
        >
          <option value="all">Toate țările</option>
          {COUNTRY_OPTIONS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={responseFilter}
          onChange={(e) => setResponseFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-200"
          title="Filtrează după răspunsul pasagerului din email (V/X)"
        >
          <option value="all">Toate răspunsurile</option>
          <option value="confirmed">A confirmat</option>
          <option value="cancelled">A anulat din email</option>
          <option value="none">Niciun răspuns</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left">Nr. rezervare</th>
                <th className="px-5 py-3 text-left">Client</th>
                <th className="px-5 py-3 text-left">Rută</th>
                <th className="px-5 py-3 text-left">Dată</th>
                <th className="px-5 py-3 text-left">Preț</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Răspuns pasager</th>
                <th className="px-5 py-3 text-right">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center">
                    <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center text-slate-500">
                    Nu s-au găsit rezervări cu filtrele curente.
                  </td>
                </tr>
              ) : (
                filtered.slice(0, 100).map((b) => {
                  const meta = statusMeta[b.status] ?? statusMeta.pending;
                  return (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <div className="font-mono font-semibold text-slate-900">
                          {b.bookingNumber}
                        </div>
                        <div className="text-xs text-slate-500">
                          {b.type === "passenger" ? "Pasageri" : "Colete"}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-medium text-slate-900">
                          {b.firstName} {b.lastName}
                        </div>
                        <div className="text-xs text-slate-500">{b.phone}</div>
                        <div className="text-xs text-slate-400">{b.email}</div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-medium text-slate-900">{b.departureCity}</span>
                        <span className="mx-1.5 text-slate-400">→</span>
                        <span className="font-medium text-slate-900">{b.arrivalCity}</span>
                      </td>
                      <td className="px-5 py-3 text-slate-700">
                        {new Date(b.departureDate).toLocaleDateString("ro-RO")}
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-semibold text-slate-900">
                          {b.price} {b.currency}
                        </div>
                        <div className={`text-xs ${b.emailSent ? "text-emerald-600" : "text-red-500"}`}>
                          {b.emailSent ? "Email trimis" : "Email netrimis"}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <select
                          value={b.status}
                          onChange={(e) => handleStatusChange(b.id, e.target.value)}
                          className="rounded-full border border-transparent bg-transparent px-0 py-0 text-xs font-semibold focus:outline-none"
                        >
                          {statusOptions.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <div className="mt-1">
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {(() => {
                          const opt = responseOptions.find((o) => o.value === b.passengerResponse);
                          if (!opt) {
                            return (
                              <Badge variant="slate" className="text-slate-500">
                                — Niciun răspuns
                              </Badge>
                            );
                          }
                          const at = b.passengerResponseAt
                            ? new Date(b.passengerResponseAt).toLocaleString("ro-RO", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "";
                          return (
                            <span title={at ? `Răspuns la ${at}` : ""}>
                              <Badge variant={opt.variant}>
                                {opt.icon} {opt.label}
                              </Badge>
                              {at && (
                                <div className="mt-0.5 text-[11px] text-slate-400">{at}</div>
                              )}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditing(b)}
                            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-orange-600"
                            title="Editează rezervarea"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <a
                            href={`/bilet/${b.bookingNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-orange-600"
                            title="Vezi biletul"
                          >
                            <Eye className="h-4 w-4" />
                          </a>
                          <button
                            onClick={() => handleResendEmail(b.id)}
                            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-orange-600"
                            title="Retrimite email"
                          >
                            <Mail className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 100 && (
          <div className="border-t border-slate-100 px-5 py-3 text-center text-xs text-slate-500">
            Se afișează primele 100 din {filtered.length} rezervări
          </div>
        )}
      </div>

      {creating && (
        <ManualBookingModal
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            fetchBookings();
          }}
        />
      )}

      {editing && (
        <EditBookingModal
          booking={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            fetchBookings();
          }}
        />
      )}
    </div>
  );
}

function toLocalInput(d: Date) {
  const tz = d.getTimezoneOffset();
  const local = new Date(d.getTime() - tz * 60000);
  return local.toISOString().slice(0, 16);
}

const OTHER = "__other__";

function ManualBookingModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [originCountrySelect, setOriginCountrySelect] = useState<string>("Moldova");
  const [originCountryCustom, setOriginCountryCustom] = useState("");
  const [originCity, setOriginCity] = useState<string>("Chișinău");
  const [originAddress, setOriginAddress] = useState("");

  const [destCountrySelect, setDestCountrySelect] = useState<string>(destinations[0]?.name ?? OTHER);
  const [destCountryCustom, setDestCountryCustom] = useState("");
  const [destCity, setDestCity] = useState("");
  const [destAddress, setDestAddress] = useState("");

  const [tripType, setTripType] = useState<"one-way" | "round-trip">("one-way");
  const [departureDate, setDepartureDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(20, 0, 0, 0);
    return toLocalInput(d);
  });
  const [returnDate, setReturnDate] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);

  const [price, setPrice] = useState<string>("");
  const [currency, setCurrency] = useState<"EUR" | "GBP" | "MDL">("GBP");
  const [payMethod, setPayMethod] = useState<"cash_on_pickup" | "card_on_pickup" | "paid_in_advance">("cash_on_pickup");

  const [status, setStatus] = useState<"confirmed" | "pending">("confirmed");
  const [sendEmail, setSendEmail] = useState(true);
  const [notes, setNotes] = useState("");

  // Asociere cu o cursă existentă: previne suprapunerile de locuri între
  // rezervările manuale și cele publice. Opțional — dacă admin nu alege
  // nicio cursă, rezervarea rămâne stand-alone (cazul ambasadei).
  type TripOption = {
    id: string;
    departureAt: string;
    arrivalAt: string;
    availableSeats: number;
    totalSeats: number;
    busLabel: string;
  };
  const [tripOptions, setTripOptions] = useState<TripOption[]>([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState<string>("");
  // Map nume oraș (lowercase) → ID, populat o singură dată la mount din
  // /api/public/cities. Endpoint-ul de curse cere `originCityId` și
  // `destCityId` (UUID), deci trebuie să rezolvăm înainte de a căuta.
  const [cityIndex, setCityIndex] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/cities")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d?.success) return;
        const map: Record<string, string> = {};
        for (const c of [...(d.origins ?? []), ...(d.destinations ?? [])]) {
          map[String(c.name).trim().toLowerCase()] = String(c.id);
        }
        setCityIndex(map);
      })
      .catch(() => {
        if (!cancelled) setCityIndex({});
      });
    return () => {
      cancelled = true;
    };
  }, []);
  type TripDetail = {
    layout: BusLayout;
    occupiedSeats: number[];
  };
  const [tripDetail, setTripDetail] = useState<TripDetail | null>(null);
  const [tripDetailLoading, setTripDetailLoading] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState<number[]>([]);

  const [saving, setSaving] = useState(false);

  const originCountry = originCountrySelect === OTHER ? originCountryCustom.trim() : originCountrySelect;
  const destinationCountry = destCountrySelect === OTHER ? destCountryCustom.trim() : destCountrySelect;

  // Caut curse când origine + destinație + data sunt completate. Rezolvăm
  // numele orașelor la ID-urile DB (cityIndex) ca să putem chema endpointul
  // public/trips care cere UUID-uri. Orașele custom (necunoscute în DB) →
  // listă goală, admin lasă rezervarea stand-alone.
  useEffect(() => {
    if (!originCity.trim() || !destCity.trim() || !cityIndex) {
      setTripOptions([]);
      setSelectedTripId("");
      setSelectedSeats([]);
      return;
    }
    const originId = cityIndex[originCity.trim().toLowerCase()];
    const destId = cityIndex[destCity.trim().toLowerCase()];
    if (!originId || !destId) {
      setTripOptions([]);
      setSelectedTripId("");
      setSelectedSeats([]);
      return;
    }
    const ac = new AbortController();
    setTripsLoading(true);
    const params = new URLSearchParams({
      originCityId: originId,
      destCityId: destId,
      limit: "30",
    });
    fetch(`/api/public/trips?${params.toString()}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((d) => {
        if (!d?.success) return;
        const all = (d.trips ?? []) as TripOption[];
        // Dacă admin a tastat o dată exactă, prioritizăm cursele din ziua aia
        // dar tot afișăm restul ca fallback (dacă nu există ziua respectivă).
        if (departureDate) {
          const target = new Date(departureDate);
          const sameDay = (a: Date, b: Date) =>
            a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate();
          const sameDayTrips = all.filter((t) =>
            sameDay(new Date(t.departureAt), target),
          );
          setTripOptions(sameDayTrips.length > 0 ? sameDayTrips : all.slice(0, 16));
        } else {
          setTripOptions(all.slice(0, 16));
        }
      })
      .catch(() => setTripOptions([]))
      .finally(() => setTripsLoading(false));
    return () => ac.abort();
  }, [originCity, destCity, departureDate, cityIndex]);

  // Detaliul cursei (layout autocar + locuri ocupate) — folosit de SeatPicker.
  // Sub-fetch în paralel: detalii admin pe scaune (cine a rezervat fiecare).
  type SeatInfo = {
    bookingNumber: string;
    passengerName: string;
    phone: string;
    email: string;
    status: string;
    bookingId: string;
  };
  const [seatInfoMap, setSeatInfoMap] = useState<Record<number, SeatInfo>>({});
  const [inspectedSeat, setInspectedSeat] = useState<number | null>(null);

  useEffect(() => {
    setTripDetail(null);
    setSelectedSeats([]);
    setSeatInfoMap({});
    setInspectedSeat(null);
    if (!selectedTripId) return;
    const ac = new AbortController();
    setTripDetailLoading(true);
    Promise.all([
      fetch(`/api/public/trips/${selectedTripId}`, { signal: ac.signal })
        .then((r) => r.json())
        .catch(() => null),
      fetch(`/api/admin/trips/${selectedTripId}/seats`, { signal: ac.signal })
        .then((r) => r.json())
        .catch(() => null),
    ])
      .then(([trip, seats]) => {
        if (trip?.success && trip.trip?.bus) {
          setTripDetail({
            layout: trip.trip.bus.layout,
            occupiedSeats: trip.trip.occupiedSeats ?? [],
          });
        }
        if (seats?.success && Array.isArray(seats.seats)) {
          const map: Record<number, SeatInfo> = {};
          for (const s of seats.seats) {
            if (s.booking) {
              map[s.seatNumber] = {
                bookingId: s.booking.id,
                bookingNumber: s.booking.bookingNumber,
                passengerName: s.booking.passengerName,
                phone: s.booking.phone,
                email: s.booking.email,
                status: s.booking.status,
              };
            }
          }
          setSeatInfoMap(map);
        }
      })
      .finally(() => setTripDetailLoading(false));
    return () => ac.abort();
  }, [selectedTripId]);

  const maxSeats = Math.max(0, adults) + Math.max(0, children);

  function swapDirection() {
    setOriginCountrySelect(destCountrySelect);
    setOriginCountryCustom(destCountryCustom);
    setOriginCity(destCity);
    setOriginAddress(destAddress);
    setDestCountrySelect(originCountrySelect);
    setDestCountryCustom(originCountryCustom);
    setDestCity(originCity);
    setDestAddress(originAddress);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!originCountry || !originCity.trim()) {
      alert("Completează țara și orașul de plecare.");
      return;
    }
    if (!destinationCountry || !destCity.trim()) {
      alert("Completează țara și orașul de destinație.");
      return;
    }
    const pricePerSeat = Number(price);
    if (!Number.isFinite(pricePerSeat) || pricePerSeat < 0) {
      alert("Tarif invalid.");
      return;
    }
    // Tariful tastat e per LOC. Totalul = tarif × (adulți + copii) ×
    // 2 dacă e tur-retur. Nu există tarif copii — un copil ocupă un loc.
    const seats = Math.max(0, adults) + Math.max(0, children);
    const directionMultiplier = tripType === "round-trip" ? 2 : 1;
    const totalPrice = pricePerSeat * seats * directionMultiplier;
    if (seats === 0) {
      alert("Adaugă cel puțin un pasager (adult sau copil).");
      return;
    }
    // Sanity: dacă admin a ales o cursă dar n-a ales locuri pentru toți
    // pasagerii, blocăm — vrem ca lista locurilor să fie exhaustivă, altfel
    // se pot suprapune cu rezervările publice ulterioare.
    if (selectedTripId && selectedSeats.length !== seats) {
      alert(`Alege ${seats} loc${seats === 1 ? "" : "uri"} în autocar.`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone,
          originCountry,
          originCity: originCity.trim(),
          originAddress,
          destinationCountry,
          destinationCity: destCity.trim(),
          destinationAddress: destAddress,
          departureDate: new Date(departureDate).toISOString(),
          returnDate: tripType === "round-trip" && returnDate ? new Date(returnDate).toISOString() : null,
          tripType,
          adults,
          children,
          price: totalPrice,
          currency,
          payMethod,
          status,
          sendEmail,
          notes,
          tripId: selectedTripId || undefined,
          seatNumbers: selectedTripId ? selectedSeats : undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error ?? "Eroare la creare");
        return;
      }
      onSaved();
    } catch (err) {
      console.error(err);
      alert("Eroare la creare");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
          <Plus className="h-4 w-4 text-orange-500" />
          <h3 className="text-base font-semibold text-slate-900">Rezervare manuală</h3>
        </div>
        <form className="grid gap-4 px-5 py-4" onSubmit={submit}>
          <Section title="Client">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prenume">
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} required />
              </Field>
              <Field label="Nume">
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} required />
              </Field>
              <Field label="Email">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} required />
              </Field>
              <Field label="Telefon">
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} required />
              </Field>
            </div>
          </Section>

          <Section title="Plecare">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Țară">
                <select value={originCountrySelect} onChange={(e) => setOriginCountrySelect(e.target.value)} className={inputCls}>
                  <option value="Moldova">Moldova</option>
                  {destinations.map((d) => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                  <option value={OTHER}>Altă țară…</option>
                </select>
                {originCountrySelect === OTHER && (
                  <input
                    value={originCountryCustom}
                    onChange={(e) => setOriginCountryCustom(e.target.value)}
                    placeholder="ex: Suedia"
                    className={`${inputCls} mt-2`}
                    required
                  />
                )}
              </Field>
              <Field label="Oraș">
                <CityDropdown
                  country={originCountry}
                  value={originCity}
                  onChange={setOriginCity}
                  placeholder="Alege oraș…"
                  required
                />
              </Field>
            </div>
            <Field label="Adresă exactă (opțional)">
              <input
                value={originAddress}
                onChange={(e) => setOriginAddress(e.target.value)}
                placeholder="ex: str. Mihai Eminescu 5"
                className={inputCls}
              />
            </Field>
            <Field label="Data + ora plecării">
              <input type="datetime-local" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} className={inputCls} required />
            </Field>
          </Section>

          <div className="-my-2 flex justify-center">
            <button
              type="button"
              onClick={swapDirection}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 hover:text-orange-600"
              title="Inversează sensul (plecare ↔ destinație)"
            >
              <ArrowDownUp className="h-3.5 w-3.5" /> Inversează sensul
            </button>
          </div>

          <Section title="Destinație">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Țară">
                <select value={destCountrySelect} onChange={(e) => setDestCountrySelect(e.target.value)} className={inputCls}>
                  <option value="Moldova">Moldova</option>
                  {destinations.map((d) => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                  <option value={OTHER}>Altă țară…</option>
                </select>
                {destCountrySelect === OTHER && (
                  <input
                    value={destCountryCustom}
                    onChange={(e) => setDestCountryCustom(e.target.value)}
                    placeholder="ex: Suedia"
                    className={`${inputCls} mt-2`}
                    required
                  />
                )}
              </Field>
              <Field label="Oraș">
                <CityDropdown
                  country={destinationCountry}
                  value={destCity}
                  onChange={setDestCity}
                  placeholder="Alege oraș…"
                  required
                />
              </Field>
            </div>
            <Field label="Adresă exactă (fermă, șantier, depou)">
              <input
                value={destAddress}
                onChange={(e) => setDestAddress(e.target.value)}
                placeholder="ex: Hopgrove Farm, Malton Rd, YO32 9TA"
                className={inputCls}
              />
              <span className="mt-1 block text-[11px] text-slate-500">
                Apare doar pentru intern/ambasadă, nu se publică pe site.
              </span>
            </Field>
          </Section>

          <Section title="Călătorie">
            <div className="flex items-center gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  checked={tripType === "one-way"}
                  onChange={() => setTripType("one-way")}
                />
                Doar dus
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  checked={tripType === "round-trip"}
                  onChange={() => setTripType("round-trip")}
                />
                Dus-întors
              </label>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {tripType === "round-trip" && (
                <Field label="Data întoarcerii">
                  <input type="datetime-local" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className={inputCls} />
                </Field>
              )}
              <Field label="Adulți">
                <input type="number" min={1} value={adults} onChange={(e) => setAdults(Number(e.target.value))} className={inputCls} />
              </Field>
              <Field label="Copii">
                <input type="number" min={0} value={children} onChange={(e) => setChildren(Number(e.target.value))} className={inputCls} />
              </Field>
            </div>
          </Section>

          <Section title="Cursa & locuri (opțional, evită suprapuneri)">
            <Field label="Atașează la o cursă programată">
              <select
                value={selectedTripId}
                onChange={(e) => setSelectedTripId(e.target.value)}
                className={inputCls}
                disabled={tripsLoading}
              >
                <option value="">
                  {tripsLoading
                    ? "Caut curse…"
                    : tripOptions.length === 0
                      ? "Nicio cursă programată — rezervarea rămâne stand-alone"
                      : "— fără cursă atașată —"}
                </option>
                {tripOptions.map((t) => {
                  const dt = new Date(t.departureAt);
                  const dateStr = new Intl.DateTimeFormat("ro-RO", {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Europe/Chisinau",
                  }).format(dt);
                  return (
                    <option key={t.id} value={t.id}>
                      {dateStr} · {t.busLabel} · {t.availableSeats}/{t.totalSeats} libere
                    </option>
                  );
                })}
              </select>
              <span className="mt-1 block text-[11px] text-slate-500">
                Când e atașată, locurile alese mai jos blochează vânzarea publică pe acele scaune.
              </span>
            </Field>

            {selectedTripId && (
              <div>
                {tripDetailLoading || !tripDetail ? (
                  <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 py-8 text-sm text-slate-500">
                    Încarc layout-ul autocarului…
                  </div>
                ) : (
                  <>
                    <div className="mb-2 text-[11px] text-slate-600">
                      Alege exact <strong>{maxSeats}</strong> loc{maxSeats === 1 ? "" : "uri"} (= {adults} adulți + {children} copii). Selectate: {selectedSeats.length}. Click pe locurile ocupate ca să vezi cine le-a rezervat.
                    </div>
                    <BusSeatMap
                      layout={tripDetail.layout}
                      occupiedSeats={tripDetail.occupiedSeats}
                      selected={selectedSeats}
                      onSelect={setSelectedSeats}
                      max={maxSeats}
                      onSeatInspect={(n) => setInspectedSeat(n)}
                    />
                    {inspectedSeat !== null && (
                      <SeatInspector
                        seatNumber={inspectedSeat}
                        info={seatInfoMap[inspectedSeat] ?? null}
                        onClose={() => setInspectedSeat(null)}
                      />
                    )}
                  </>
                )}
              </div>
            )}
          </Section>

          <Section title="Preț & plată">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Tarif per loc">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="ex: 120"
                  className={inputCls}
                  required
                />
                <span className="mt-1 block text-[11px] text-slate-500">
                  Tarif pentru UN loc; copiii plătesc la fel ca adulții.
                </span>
              </Field>
              <Field label="Monedă">
                <select value={currency} onChange={(e) => setCurrency(e.target.value as typeof currency)} className={inputCls}>
                  <option value="GBP">GBP £</option>
                  <option value="EUR">EUR €</option>
                  <option value="MDL">MDL lei</option>
                </select>
              </Field>
              <Field label="Metodă plată">
                <select value={payMethod} onChange={(e) => setPayMethod(e.target.value as typeof payMethod)} className={inputCls}>
                  <option value="cash_on_pickup">Cash la îmbarcare</option>
                  <option value="card_on_pickup">Card la îmbarcare</option>
                  <option value="paid_in_advance">Achitată în avans</option>
                </select>
              </Field>
            </div>
            {/* Total live: tariful × locuri (adulți + copii). Calc identic
                cu cel din submit ca să nu existe drift între ce vede admin
                și ce salvăm. Tur-retur ×2 (one-way × 2 = total dus-întors). */}
            <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm">
              <span className="font-semibold text-slate-700">Total calculat:</span>{" "}
              <span className="font-bold text-orange-700">
                {(() => {
                  const seats = Math.max(0, Number(adults) || 0) + Math.max(0, Number(children) || 0);
                  const direction = tripType === "round-trip" ? 2 : 1;
                  const t = (Number(price) || 0) * seats * direction;
                  return `${(Number(price) || 0)} × ${seats} loc${seats === 1 ? "" : "uri"}${direction === 2 ? " × 2 (tur-retur)" : ""} = ${t.toFixed(2)} ${currency}`;
                })()}
              </span>
            </div>
          </Section>

          <Section title="Status & email">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Status inițial">
                <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={inputCls}>
                  <option value="confirmed">Confirmată</option>
                  <option value="pending">În așteptare</option>
                </select>
              </Field>
              <label className="flex items-end gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Trimite email de confirmare clientului
              </label>
            </div>
            <Field label="Notițe pe bilet (opțional)">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} placeholder="ex: viză muncă fermă căpșuni" />
              <span className="mt-1 block text-[11px] text-slate-500">
                Apar pe biletul tipărit, sub datele pasagerului.
              </span>
            </Field>
          </Section>

          <div className="mt-2 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              Anulează
            </button>
            <button type="submit" disabled={saving} className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60">
              {saving ? "Salvez…" : "Creează rezervarea"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</div>
      <div className="grid gap-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

const inputCls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-200";

// Dropdown de orașe filtrat după țara selectată. Folosește numele canonice
// din lib/data.ts (care reflectă seed-ul DB-ului) — astfel valorile salvate
// matchează exact City.name din DB, ca lookup-ul /api/public/trips să găsească
// cursele atașate. Pentru țări custom sau orașe care nu-s în listă, oferim
// opțiunea "Alt oraș…" cu input text.
function CityDropdown({
  country,
  value,
  onChange,
  placeholder,
  required,
}: {
  country: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const cities = useMemo(() => {
    if (!country) return [] as string[];
    if (country === "Moldova") {
      return ["Chișinău", ...moldovanCities.map((c) => c.name)];
    }
    const dest = destinations.find((d) => d.name === country);
    return dest ? dest.cities.map((c) => c.name) : [];
  }, [country]);

  const isCustom = value !== "" && !cities.includes(value);
  const [usingCustom, setUsingCustom] = useState(isCustom);

  // Reset usingCustom când se schimbă țara — listele sunt diferite, e ușor
  // să rămâi cu un text liber stale din altă țară.
  useEffect(() => {
    setUsingCustom(false);
    if (value && !cities.includes(value) && cities.length > 0) {
      // valoare invalidă pe noua țară → o golim
      onChange("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country]);

  if (cities.length === 0 || usingCustom) {
    return (
      <div className="space-y-1.5">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "Tastează orașul…"}
          className={inputCls}
          required={required}
        />
        {cities.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setUsingCustom(false);
              if (value && !cities.includes(value)) onChange("");
            }}
            className="text-[11px] text-orange-600 hover:underline"
          >
            ← Înapoi la lista de orașe predefinite
          </button>
        )}
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === "__custom__") {
          setUsingCustom(true);
          onChange("");
        } else {
          onChange(e.target.value);
        }
      }}
      className={inputCls}
      required={required}
    >
      <option value="">{placeholder ?? "Alege oraș…"}</option>
      {cities.map((c) => (
        <option key={c} value={c}>{c}</option>
      ))}
      <option value="__custom__">Alt oraș (tastează manual)…</option>
    </select>
  );
}

function EditBookingModal({
  booking,
  onClose,
  onSaved,
}: {
  booking: Booking;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Câmpuri editabile, preîncărcate cu valorile curente
  const [firstName, setFirstName] = useState(booking.firstName);
  const [lastName, setLastName] = useState(booking.lastName);
  const [email, setEmail] = useState(booking.email);
  const [phone, setPhone] = useState(booking.phone);
  const [departureCity, setDepartureCity] = useState(booking.departureCity);
  const [arrivalCity, setArrivalCity] = useState(booking.arrivalCity);
  const [departureDate, setDepartureDate] = useState(toLocalInput(new Date(booking.departureDate)));
  const [tripType, setTripType] = useState<"one-way" | "round-trip">("one-way");
  const [returnDate, setReturnDate] = useState<string>("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [price, setPrice] = useState<string>(String(booking.price));
  const [currency, setCurrency] = useState<string>(booking.currency);
  const [payMethod, setPayMethod] = useState<string>("cash_on_pickup");
  const [paymentStatus, setPaymentStatus] = useState<string>("pending");
  const [status, setStatus] = useState<string>(booking.status);
  const [notes, setNotes] = useState<string>("");

  // Date stocate doar la fetch: scaune curente + tripIds
  const [outboundSeats, setOutboundSeats] = useState<number[]>([]);
  const [returnSeats, setReturnSeats] = useState<number[]>([]);
  const [removeOutbound, setRemoveOutbound] = useState<number[]>([]);
  const [removeReturn, setRemoveReturn] = useState<number[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Detalii extra (parcelDetails ca JSON pentru rezervări manuale)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/bookings/${booking.bookingNumber}`);
        const data = await res.json();
        if (cancelled || !data?.success || !data.booking) return;
        const b = data.booking;
        setAdults(b.adults ?? 1);
        setChildren(b.children ?? 0);
        setTripType(b.tripType === "round-trip" ? "round-trip" : "one-way");
        if (b.returnDate) setReturnDate(toLocalInput(new Date(b.returnDate)));
        setPayMethod(b.payMethod ?? "cash_on_pickup");
        setPaymentStatus(b.paymentStatus ?? "pending");
        setOutboundSeats(Array.isArray(b.outboundSeats) ? b.outboundSeats : []);
        setReturnSeats(Array.isArray(b.returnSeats) ? b.returnSeats : []);
        // Extragem notițele din parcelDetails dacă e JSON manual
        if (b.parcelDetails) {
          try {
            const parsed = JSON.parse(b.parcelDetails);
            if (parsed && typeof parsed.notes === "string") setNotes(parsed.notes);
          } catch {
            // nu e JSON manual — îl lăsăm așa
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [booking.bookingNumber]);

  function toggleRemoveOutbound(seat: number) {
    setRemoveOutbound((prev) => (prev.includes(seat) ? prev.filter((s) => s !== seat) : [...prev, seat]));
  }
  function toggleRemoveReturn(seat: number) {
    setRemoveReturn((prev) => (prev.includes(seat) ? prev.filter((s) => s !== seat) : [...prev, seat]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      alert("Numele și prenumele sunt obligatorii.");
      return;
    }
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      alert("Preț invalid.");
      return;
    }
    await save(status);
  }

  async function cancelBooking() {
    if (!confirm("Sigur vrei să anulezi rezervarea? Clientul va primi email de anulare.")) return;
    await save("cancelled");
  }

  async function save(targetStatus: string) {
    setSaving(true);
    try {
      // Reconstruim parcelDetails dacă era JSON manual (păstrăm structura)
      let parcelDetails: string | null | undefined = undefined;
      if (booking.parcelDetails) {
        try {
          const parsed = JSON.parse(booking.parcelDetails);
          if (parsed && parsed.manual) {
            parcelDetails = JSON.stringify({ ...parsed, notes: notes.trim() || undefined });
          }
        } catch {
          // nu atingem dacă nu e structura noastră
        }
      }

      const res = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          departureCity: departureCity.trim(),
          arrivalCity: arrivalCity.trim(),
          departureDate: new Date(departureDate).toISOString(),
          tripType,
          returnDate: tripType === "round-trip" && returnDate ? new Date(returnDate).toISOString() : null,
          adults: Math.max(0, Number(adults) || 0),
          children: Math.max(0, Number(children) || 0),
          price: Number(price),
          currency,
          payMethod,
          paymentStatus,
          status: targetStatus,
          ...(parcelDetails !== undefined ? { parcelDetails } : {}),
          removeOutboundSeats: removeOutbound,
          removeReturnSeats: removeReturn,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error ?? "Eroare la salvare");
        return;
      }
      onSaved();
    } catch (err) {
      console.error(err);
      alert("Eroare la salvare");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
          <Pencil className="h-4 w-4 text-orange-500" />
          <h3 className="text-base font-semibold text-slate-900">
            Editează rezervarea <span className="font-mono text-orange-600">{booking.bookingNumber}</span>
          </h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          </div>
        ) : (
          <form className="grid gap-4 px-5 py-4" onSubmit={submit}>
            <Section title="Client">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Prenume (separat cu virgulă pt. mai mulți)">
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} required />
                </Field>
                <Field label="Nume">
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} required />
                </Field>
                <Field label="Email">
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Telefon">
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
                </Field>
              </div>
            </Section>

            <Section title="Rută & date">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Plecare (oraș, țară)">
                  <input value={departureCity} onChange={(e) => setDepartureCity(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Sosire (oraș, țară)">
                  <input value={arrivalCity} onChange={(e) => setArrivalCity(e.target.value)} className={inputCls} />
                </Field>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input type="radio" checked={tripType === "one-way"} onChange={() => setTripType("one-way")} />
                  Doar dus
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" checked={tripType === "round-trip"} onChange={() => setTripType("round-trip")} />
                  Dus-întors
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Data plecării">
                  <input type="datetime-local" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} className={inputCls} required />
                </Field>
                {tripType === "round-trip" && (
                  <Field label="Data întoarcerii">
                    <input type="datetime-local" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className={inputCls} />
                  </Field>
                )}
              </div>
            </Section>

            <Section title="Pasageri">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Adulți">
                  <input type="number" min={0} value={adults} onChange={(e) => setAdults(Number(e.target.value))} className={inputCls} />
                </Field>
                <Field label="Copii">
                  <input type="number" min={0} value={children} onChange={(e) => setChildren(Number(e.target.value))} className={inputCls} />
                </Field>
              </div>
            </Section>

            {(outboundSeats.length > 0 || returnSeats.length > 0) && (
              <Section title="Locuri rezervate">
                {outboundSeats.length > 0 && (
                  <Field label="Dus — click pe × să eliberezi locul">
                    <div className="flex flex-wrap gap-2">
                      {outboundSeats.map((s) => {
                        const removed = removeOutbound.includes(s);
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => toggleRemoveOutbound(s)}
                            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-sm font-semibold transition-colors ${
                              removed
                                ? "border-red-300 bg-red-50 text-red-700 line-through"
                                : "border-slate-200 bg-white text-slate-700 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                            }`}
                            title={removed ? "Click ca să anulezi ștergerea" : "Click ca să eliberezi locul"}
                          >
                            Loc {s} <X className="h-3 w-3" />
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                )}
                {returnSeats.length > 0 && (
                  <Field label="Retur — click pe × să eliberezi locul">
                    <div className="flex flex-wrap gap-2">
                      {returnSeats.map((s) => {
                        const removed = removeReturn.includes(s);
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => toggleRemoveReturn(s)}
                            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-sm font-semibold transition-colors ${
                              removed
                                ? "border-red-300 bg-red-50 text-red-700 line-through"
                                : "border-slate-200 bg-white text-slate-700 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                            }`}
                          >
                            Loc {s} <X className="h-3 w-3" />
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                )}
                {(removeOutbound.length > 0 || removeReturn.length > 0) && (
                  <span className="text-[11px] text-red-600">
                    Vor fi eliberate: {removeOutbound.length + removeReturn.length} loc(uri) la salvare.
                  </span>
                )}
              </Section>
            )}

            <Section title="Preț & plată">
              <div className="grid grid-cols-3 gap-3">
                <Field label="Sumă">
                  <input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} required />
                </Field>
                <Field label="Monedă">
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
                    <option value="GBP">GBP £</option>
                    <option value="EUR">EUR €</option>
                    <option value="MDL">MDL lei</option>
                  </select>
                </Field>
                <Field label="Metodă plată">
                  <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className={inputCls}>
                    <option value="cash_on_pickup">Cash la îmbarcare</option>
                    <option value="card_on_pickup">Card la îmbarcare</option>
                    <option value="paid_in_advance">Achitată în avans</option>
                    <option value="cash_on_delivery">Cash la livrare</option>
                  </select>
                </Field>
              </div>
              <Field label="Status plată">
                <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className={inputCls}>
                  <option value="pending">Neachitată</option>
                  <option value="paid">Achitată</option>
                </select>
              </Field>
            </Section>

            <Section title="Status rezervare">
              <Field label="Status">
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
                  <option value="pending">În așteptare</option>
                  <option value="confirmed">Confirmată</option>
                  <option value="cancelled">Anulată</option>
                  <option value="completed">Finalizată</option>
                </select>
              </Field>
              <Field label="Notițe pe bilet (opțional)">
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
                <span className="mt-1 block text-[11px] text-slate-500">
                  Editabile doar pentru rezervări manuale (cu adresă custom).
                </span>
              </Field>
            </Section>

            <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={cancelBooking}
                disabled={saving || status === "cancelled"}
                className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
              >
                Anulează rezervarea
              </button>
              <div className="flex items-center gap-2">
                <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                  Renunță
                </button>
                <button type="submit" disabled={saving} className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60">
                  {saving ? "Salvez…" : "Salvează"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// Mic panou inline ce apare sub SeatPicker când admin a făcut click pe un
// loc ocupat. Decuplat de modal-ul propriu-zis ca să nu suprapună restul
// formularului.
function SeatInspector({
  seatNumber,
  info,
  onClose,
}: {
  seatNumber: number;
  info: {
    bookingNumber: string;
    passengerName: string;
    phone: string;
    email: string;
    status: string;
    bookingId: string;
  } | null;
  onClose: () => void;
}) {
  return (
    <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-orange-700">
            Loc {seatNumber} — ocupat
          </div>
          {info ? (
            <div className="mt-1 space-y-0.5 text-slate-700">
              <div className="font-semibold text-slate-900">{info.passengerName || "(fără nume)"}</div>
              <div className="text-xs">
                Rezervare <span className="font-mono font-semibold">{info.bookingNumber}</span> ·{" "}
                <span className="font-medium">{info.status}</span>
              </div>
              <div className="text-xs">
                <a href={`tel:${info.phone}`} className="text-orange-700 hover:underline">{info.phone}</a>
                <span className="mx-1.5 text-slate-300">·</span>
                <a href={`mailto:${info.email}`} className="text-orange-700 hover:underline">{info.email}</a>
              </div>
            </div>
          ) : (
            <div className="mt-1 text-xs text-slate-600">
              Loc rezervat fără pasager asociat în DB (date legacy sau rezervare anulată în curs).
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-orange-100"
          aria-label="Închide panoul"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
