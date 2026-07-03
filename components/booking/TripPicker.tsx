"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Phone,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar as CalendarIcon,
  Bus as BusIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BusSeatMap } from "./BusSeatMap";
import type { BusLayout } from "@/lib/adminMock";

export type PublicTrip = {
  id: string;
  departureAt: string;
  arrivalAt: string;
  status: string;
  busId: string;
  busLabel: string;
  busPlate?: string;
  totalSeats: number;
  bookedSeats: number;
  availableSeats: number;
  pricePerSeat: number;
  currency: string;
};

type TripDetail = {
  id: string;
  departureAt: string;
  arrivalAt: string;
  bus: { id: string; label: string; plate?: string; totalSeats: number; layout: BusLayout };
  occupiedSeats: number[];
};

const weekdayFmt = new Intl.DateTimeFormat("ro-RO", { weekday: "long" });
const dateFmt = new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "long" });
const timeFmt = new Intl.DateTimeFormat("ro-RO", { hour: "2-digit", minute: "2-digit" });
const monthYearFmt = new Intl.DateTimeFormat("ro-RO", { month: "long", year: "numeric" });

// Cheia "YYYY-MM-DD" pentru o dată — folosit la corelarea Trip ↔ ziua calendarului.
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Construiește grila lunii: 7 col, 5-6 rânduri, prima zi = Luni (convenția RO).
// Include padding-ul din luna precedentă / următoare ca să avem 7 col întregi.
function buildMonthGrid(view: Date): { date: Date; inMonth: boolean }[] {
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  // JS weekday: 0=Dum..6=Sâm. Convertim la 0=Lun..6=Dum (RO).
  const dow = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(start.getDate() - dow);
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({ date: d, inMonth: d.getMonth() === view.getMonth() });
  }
  // Trunchiem la 5 rânduri dacă ultima săptămână e complet în luna următoare.
  // (Optimizare cosmetică — evită un rând gol când luna are 28 zile bine aliniate.)
  const lastWeek = cells.slice(35);
  if (lastWeek.every((c) => !c.inMonth)) return cells.slice(0, 35);
  return cells;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}


export function TripPicker({
  title,
  subtitle,
  originCityId,
  destCityId,
  fromDate,
  maxSeats,
  selectedTripId,
  selectedSeats,
  onSelect,
  allowedWeekday,
  parcelMode = false,
  autoSelectTripId = null,
}: {
  title: string;
  subtitle?: string;
  originCityId: string | null;
  destCityId: string | null;
  /** ISO date string — earliest acceptable departure (e.g. outbound's departureAt for return picker). */
  fromDate?: string | null;
  maxSeats: number;
  selectedTripId: string | null;
  selectedSeats: number[];
  onSelect: (tripId: string | null, seats: number[], trip?: PublicTrip | null) => void;
  /** Filtru defensiv pe FE: 0=duminică, ..., 6=sâmbătă. Dacă e set, ascundem
   *  cursele care nu cad în ziua respectivă (backend-ul ar trebui să genereze
   *  doar zilele corecte; filtrul ăsta acoperă date vechi/de test din DB). */
  allowedWeekday?: number | null;
  /** Coletele călătoresc cu autocarul de pasageri — folosesc același calendar
   *  de curse dar nu rezervă scaune. Cu `parcelMode`, ascundem SeatPicker-ul
   *  și nu mai cerem `maxSeats` să fie sincronizat cu nimic. */
  parcelMode?: boolean;
  /** Preselectează automat cursa cu acest id când lista s-a încărcat (folosit
   *  de butonul "+ Rezervare pe cursă" din panoul operatorilor). */
  autoSelectTripId?: string | null;
}) {
  const hasRoute = Boolean(originCityId && destCityId);
  const [trips, setTrips] = useState<PublicTrip[] | null>(null);
  // Pornim direct pe loading=true dacă deja avem origine+destinație la mount —
  // altfel primul paint era gol până când useEffect setează loading=true, iar
  // userul vedea un card alb înainte să apară skeleton-ul.
  const [loading, setLoading] = useState(hasRoute);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<TripDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!originCityId || !destCityId) {
      setTrips([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ originCityId, destCityId });
    if (fromDate) params.set("from", fromDate);
    fetch(`/api/public/trips?${params.toString()}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        if (d?.success) setTrips(d.trips ?? []);
        else setError(d?.error ?? "Eroare la încărcarea curselor");
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError("Eroare de rețea");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [originCityId, destCityId, fromDate]);

  useEffect(() => {
    if (!selectedTripId) {
      setDetail(null);
      return;
    }
    const controller = new AbortController();
    setDetailLoading(true);
    fetch(`/api/public/trips/${selectedTripId}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        if (d?.success) setDetail(d.trip);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError("Nu s-a putut încărca layoutul autocarului");
      })
      .finally(() => setDetailLoading(false));
    return () => controller.abort();
  }, [selectedTripId]);

  // Filtrăm defensiv după ziua săptămânii dacă e dată. Util când DB conține
  // curse generate manual sau din date de test în zile care nu corespund
  // programului real al rutei (ex. retur EU→MD trebuie să fie doar duminică
  // pentru Belgia/Olanda/Germania/Anglia).
  const filteredTrips = useMemo(() => {
    if (!trips || allowedWeekday == null) return trips;
    return trips.filter((t) => new Date(t.departureAt).getDay() === allowedWeekday);
  }, [trips, allowedWeekday]);

  const total = filteredTrips?.length ?? 0;

  // Map zi-calendar → Trip pentru randare rapidă în calendar.
  const tripByDay = useMemo(() => {
    const m = new Map<string, PublicTrip>();
    for (const t of filteredTrips ?? []) {
      m.set(dayKey(new Date(t.departureAt)), t);
    }
    return m;
  }, [filteredTrips]);

  // Pornește la luna primului trip disponibil (sau luna curentă dacă nu sunt).
  const initialMonth = useMemo(() => {
    const first = (filteredTrips ?? [])[0];
    const ref = first ? new Date(first.departureAt) : new Date();
    return new Date(ref.getFullYear(), ref.getMonth(), 1);
  }, [filteredTrips]);
  const [viewMonth, setViewMonth] = useState<Date>(initialMonth);

  // Resincronizăm view-ul când lista de trips se schimbă (nouă rută → poate primul
  // trip e în altă lună).
  useEffect(() => {
    setViewMonth(initialMonth);
  }, [initialMonth]);

  const monthCells = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);
  // Permitem navigare doar către luni care conțin trip-uri din listă (capătă-mâini).
  const allTripMonths = useMemo(() => {
    const set = new Set<string>();
    for (const t of filteredTrips ?? []) {
      const d = new Date(t.departureAt);
      set.add(`${d.getFullYear()}-${d.getMonth()}`);
    }
    return set;
  }, [filteredTrips]);
  const viewKey = `${viewMonth.getFullYear()}-${viewMonth.getMonth()}`;
  const sortedMonthKeys = useMemo(() => {
    return Array.from(allTripMonths).sort((a, b) => {
      const [ay, am] = a.split("-").map(Number);
      const [by, bm] = b.split("-").map(Number);
      return ay !== by ? ay - by : am - bm;
    });
  }, [allTripMonths]);
  const monthIdx = sortedMonthKeys.indexOf(viewKey);
  const canPrev = monthIdx > 0;
  const canNext = monthIdx >= 0 && monthIdx < sortedMonthKeys.length - 1;
  const gotoMonth = (delta: number) => {
    const next = sortedMonthKeys[monthIdx + delta];
    if (!next) return;
    const [y, m] = next.split("-").map(Number);
    setViewMonth(new Date(y, m, 1));
  };

  const pickTrip = (trip: PublicTrip) => {
    if (selectedTripId === trip.id) {
      onSelect(null, [], null);
    } else {
      onSelect(trip.id, [], trip);
    }
  };

  // Auto-select (buton "+ Rezervare pe cursă"): odată ce lista de curse s-a
  // încărcat, selectăm cursa cerută prin `pickTrip` (trece PublicTrip complet →
  // preț + dată corecte, spre deosebire de setarea directă a tripId-ului). Căutăm
  // în lista NEfiltrată ca filtrul de zi să nu ascundă cursa țintă. O singură dată.
  const autoSelectDone = useRef(false);
  useEffect(() => {
    if (autoSelectDone.current || !autoSelectTripId || selectedTripId) return;
    const t = (trips ?? []).find((x) => x.id === autoSelectTripId);
    if (t) {
      autoSelectDone.current = true;
      onSelect(t.id, [], t);
    }
    // onSelect e stabil funcțional; nu-l punem în deps ca să nu re-rulăm.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSelectTripId, trips, selectedTripId]);

  const updateSeats = (seats: number[]) => {
    if (selectedTripId) onSelect(selectedTripId, seats);
  };

  return (
    <div className="card-elevated p-6 md:p-8">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-[color:var(--red-500)]">
          {title}
        </span>
        {subtitle && (
          <h2 className="display-hero text-2xl md:text-3xl text-[color:var(--navy-900)]">{subtitle}</h2>
        )}
      </div>

      {loading && <TripsSkeleton />}

      {error && !loading && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {!loading && !error && filteredTrips && filteredTrips.length === 0 && <NoTripsCard />}

      {!loading && total > 0 && (
        <div>
          {/* Header calendar: navigare lună + count */}
          <div className="mb-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => gotoMonth(-1)}
              disabled={!canPrev}
              aria-label="Luna anterioară"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--ink-200)] bg-white text-[color:var(--navy-900)] hover:border-[color:var(--navy-500)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex flex-col items-center text-center">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-[color:var(--red-500)]">
                <CalendarIcon className="h-3 w-3" />
                {total} {total === 1 ? "dată disponibilă" : "date disponibile"}
              </div>
              <div className="mt-0.5 font-[family-name:var(--font-montserrat)] text-lg font-extrabold text-[color:var(--navy-900)] capitalize">
                {monthYearFmt.format(viewMonth)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => gotoMonth(1)}
              disabled={!canNext}
              aria-label="Luna următoare"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--ink-200)] bg-white text-[color:var(--navy-900)] hover:border-[color:var(--navy-500)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Header zile săptămână */}
          <div className="grid grid-cols-7 gap-1.5 mb-2 text-center text-[10px] font-bold uppercase tracking-wider text-[color:var(--ink-500)]">
            {["Lun", "Mar", "Mie", "Joi", "Vin", "Sâm", "Dum"].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>

          {/* Grilă calendar */}
          <div className="grid grid-cols-7 gap-1.5">
            {monthCells.map(({ date, inMonth }, i) => {
              const key = dayKey(date);
              const trip = tripByDay.get(key);
              const isActive = trip && selectedTripId === trip.id;
              const isAvailable = !!trip && trip.availableSeats > 0;
              const isSoldOut = !!trip && trip.availableSeats === 0;
              const isToday = key === dayKey(new Date());

              return (
                <button
                  key={i}
                  type="button"
                  disabled={!isAvailable && !isActive}
                  onClick={() => trip && isAvailable && pickTrip(trip)}
                  className={cn(
                    "relative aspect-square rounded-xl border text-left p-1.5 md:p-2 transition-all",
                    // Zilele din afara lunii afișate (overflow de la luna
                    // următoare) sunt paliate doar când NU au cursă pe ele.
                    // Altfel o cursă reală e indistinctibilă de un day gol.
                    !inMonth && !trip && "opacity-30",
                    isActive
                      ? "border-[color:var(--red-500)] bg-[color:var(--red-500)] text-white shadow-[0_8px_24px_-12px_rgba(225,30,43,0.55)]"
                      : isAvailable
                        ? "border-[color:var(--ink-200)] bg-white hover:border-[color:var(--red-400)] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-16px_rgba(11,38,83,0.35)] cursor-pointer"
                        : isSoldOut
                          ? "border-[color:var(--ink-200)] bg-[color:var(--ink-50)] cursor-not-allowed"
                          : "border-transparent bg-transparent cursor-default"
                  )}
                >
                  <div
                    className={cn(
                      "font-[family-name:var(--font-montserrat)] font-extrabold leading-none",
                      isActive ? "text-white" : isAvailable ? "text-[color:var(--navy-900)]" : "text-[color:var(--ink-400)]",
                      "text-base md:text-lg"
                    )}
                  >
                    {date.getDate()}
                  </div>
                  {isToday && !isActive && (
                    <div className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[color:var(--red-500)]" />
                  )}
                  {trip && (
                    <div className="absolute inset-x-1 bottom-1 text-[9px] md:text-[10px] font-bold leading-tight">
                      {isActive ? (
                        <div className="text-white/95">
                          {timeFmt.format(new Date(trip.departureAt))}
                        </div>
                      ) : isSoldOut ? (
                        <div className="text-red-600">Ocupat</div>
                      ) : (
                        <>
                          <div className="text-[color:var(--navy-700)]">
                            {timeFmt.format(new Date(trip.departureAt))}
                          </div>
                          <div className="text-[color:var(--ink-400)] hidden md:block">
                            {trip.pricePerSeat}{trip.currency === "GBP" ? "£" : "€"}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Detalii cursa selectată */}
          {selectedTripId && filteredTrips && (() => {
            const t = filteredTrips.find((x) => x.id === selectedTripId);
            if (!t) return null;
            const dep = new Date(t.departureAt);
            const currency = t.currency === "GBP" ? "£" : "€";
            return (
              <div className="mt-5 rounded-2xl border border-[color:var(--red-500)] bg-white p-4 md:p-5 shadow-[0_10px_30px_-18px_rgba(225,30,43,0.4)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-[color:var(--red-500)]">
                      Cursa selectată
                    </div>
                    <div className="mt-1 font-[family-name:var(--font-montserrat)] text-lg font-extrabold text-[color:var(--navy-900)]">
                      {capitalize(weekdayFmt.format(dep))} · {dateFmt.format(dep)}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[color:var(--ink-700)]">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3 text-[color:var(--red-500)]" />
                        Plecare {timeFmt.format(dep)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <BusIcon className="h-3 w-3 text-[color:var(--red-500)]" />
                        {t.busLabel}
                        {t.busPlate && (
                          <span className="font-mono text-[color:var(--ink-500)]">
                            · {t.busPlate}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-[family-name:var(--font-montserrat)] text-2xl font-extrabold text-[color:var(--navy-900)]">
                      {t.pricePerSeat}{currency}
                    </div>
                    <div className="text-[11px] font-semibold text-[color:var(--ink-500)] inline-flex items-center gap-1">
                      <Users className="h-3 w-3" /> {t.availableSeats} libere
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      <AnimatePresence>
        {selectedTripId && !parcelMode && (
          <motion.div
            key="seat-picker"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-6 overflow-hidden"
          >
            {detailLoading && <SeatLayoutSkeleton />}
            {!detailLoading && detail && (
              <BusSeatMap
                layout={detail.bus.layout}
                occupiedSeats={detail.occupiedSeats}
                selected={selectedSeats}
                onSelect={updateSeats}
                max={maxSeats}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TripsSkeleton() {
  return (
    <div>
      <div className="mb-4 flex items-center gap-3 rounded-xl bg-[color:var(--navy-50)] border border-[color:var(--navy-200,rgba(20,58,122,0.18))] px-4 py-3">
        <div className="relative flex h-7 w-7 shrink-0 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-[color:var(--red-500)]/30" />
          <span className="relative h-5 w-5 animate-spin rounded-full border-2 border-[color:var(--red-500)] border-t-transparent" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[color:var(--navy-900)]">
            Caut cursele disponibile pe ruta ta…
          </div>
          <div className="text-[11px] text-[color:var(--ink-500)] mt-0.5">
            Durează câteva secunde — verificăm orarul, autocarele și locurile libere.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <DateCardSkeleton key={i} delay={i * 120} />
        ))}
      </div>
    </div>
  );
}

function DateCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-[color:var(--ink-200)] bg-white p-4"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* shimmer layer */}
      <div
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[color:var(--ink-100)]/60 to-transparent"
        style={{ animation: `tripShimmer 1.6s linear ${delay}ms infinite` }}
      />

      <div className="absolute right-3 top-3 h-5 w-5 rounded-full border-2 border-[color:var(--ink-100)] bg-[color:var(--ink-50)]" />

      <div className="pr-7 space-y-2">
        <div className="h-2.5 w-16 rounded bg-[color:var(--ink-100)]" />
        <div className="h-6 w-28 rounded-md bg-[color:var(--ink-100)]" />
      </div>

      <div className="rounded-xl bg-[color:var(--ink-50)] px-3 py-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="h-2.5 w-14 rounded bg-[color:var(--ink-100)]" />
          <div className="h-3.5 w-12 rounded bg-[color:var(--ink-100)]" />
        </div>
        <div className="flex items-center justify-between">
          <div className="h-2.5 w-20 rounded bg-[color:var(--ink-100)]" />
          <div className="h-2.5 w-10 rounded bg-[color:var(--ink-100)]" />
        </div>
        <div className="h-2 w-16 rounded bg-[color:var(--ink-100)]" />
      </div>

      <div className="flex items-end justify-between">
        <div className="h-3 w-20 rounded bg-[color:var(--ink-100)]" />
        <div className="space-y-1.5 text-right">
          <div className="ml-auto h-2.5 w-14 rounded bg-[color:var(--ink-100)]" />
          <div className="ml-auto h-4 w-12 rounded bg-[color:var(--ink-100)]" />
        </div>
      </div>

      <style jsx>{`
        @keyframes tripShimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}

function SeatLayoutSkeleton() {
  return (
    <div>
      <div className="mb-4 flex items-center gap-3 rounded-xl bg-[color:var(--navy-50)] border border-[color:var(--navy-200,rgba(20,58,122,0.18))] px-4 py-3">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-[color:var(--red-500)] border-t-transparent" />
        <div className="text-sm font-semibold text-[color:var(--navy-900)]">
          Pregătesc planul autocarului…
        </div>
      </div>
      <div className="rounded-2xl border border-[color:var(--ink-200)] bg-white p-5">
        <div className="grid grid-cols-5 gap-2 max-w-xs mx-auto">
          {Array.from({ length: 25 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-md bg-[color:var(--ink-100)] animate-pulse"
              style={{ animationDelay: `${(i % 5) * 80}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function NoTripsCard() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="font-semibold text-amber-900">Nu sunt curse programate pe această rută</div>
          <div className="mt-1 text-sm text-amber-800">
            Sună-ne — confirmăm disponibilitatea și aranjăm transport personalizat.
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href="tel:+37368065699"
              className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--red-500)] px-4 py-2 text-sm font-semibold text-white hover:bg-[color:var(--red-600)]"
            >
              <Phone className="h-3.5 w-3.5" /> +373 68 065 699
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
