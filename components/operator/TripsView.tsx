"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, Phone, Users, Package, User, Check, X, Armchair,
  Archive, RefreshCw, Search, Wifi, WifiOff, ChevronDown, ChevronLeft, ChevronRight,
  AlertTriangle, CalendarDays, Loader2, Bus, Plus, FileSpreadsheet, Printer, Mail, Ticket, Pencil,
} from "lucide-react";
import { getSupabase } from "@/lib/supabaseClient";
import type { OperatorBooking } from "@/components/operator/BookingsView";
import { EditBookingModal } from "@/components/operator/EditBookingModal";
import { buildManifestHtml, type TripGroup } from "@/lib/tripManifest";
import { bookingPax } from "@/lib/manifestRows";
import { displayPassengerNames } from "@/lib/passengerNames";

const fmtTime = new Intl.DateTimeFormat("ro-RO", { hour: "2-digit", minute: "2-digit" });
const fmtDayLong = new Intl.DateTimeFormat("ro-RO", { weekday: "long", day: "numeric", month: "long" });
const monthYearFmt = new Intl.DateTimeFormat("ro-RO", { month: "long", year: "numeric" });

function curr(c: string) {
  return c === "GBP" ? "£" : c === "EUR" ? "€" : c;
}
function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function statusLabel(s: string) {
  return s === "confirmed" ? "Confirmată" : s === "cancelled" ? "Anulată" : "În așteptare";
}
function statusDot(s: string) {
  return s === "confirmed" ? "bg-emerald-500" : s === "cancelled" ? "bg-red-500" : "bg-amber-500";
}
function sourceLabel(b: OperatorBooking) {
  if (b.source === "admin") return `Manual · ${b.createdByName || "Admin"}`;
  if (b.source === "operator") return `Operator · ${b.createdByName || "?"}`;
  return "Client site";
}

function dayKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayKey(): string {
  return dayKeyFromDate(new Date());
}
function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Grila lunii (7 col, Luni-prima) — același stil ca TripPicker.
function buildMonthGrid(view: Date): { date: Date; inMonth: boolean }[] {
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const dow = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(start.getDate() - dow);
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({ date: d, inMonth: d.getMonth() === view.getMonth() });
  }
  const lastWeek = cells.slice(35);
  if (lastWeek.every((c) => !c.inMonth)) return cells.slice(0, 35);
  return cells;
}

// Locurile unei rezervări pe cursele acestui card (dus SAU retur, ambele în
// g.tripIds ale cardului respectiv).
function seatsFor(b: OperatorBooking, g: TripGroup): number[] {
  return (b.seatBookings || [])
    .filter((s) => g.tripIds.includes(s.tripId))
    .map((s) => s.seatNumber);
}
function cityOnly(s: string): string {
  return s.split(",")[0].trim();
}

type BusOption = { id: string; label: string; plate: string | null; totalSeats: number | null };

export default function TripsView() {
  const [groups, setGroups] = useState<TripGroup[]>([]);
  const [calendar, setCalendar] = useState<Record<string, number>>({});
  const [scheduledDays, setScheduledDays] = useState<Set<string>>(new Set());
  const [buses, setBuses] = useState<BusOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [live, setLive] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didInitDay = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/operator/trips", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setGroups(data.groups);
        setCalendar(data.calendar || {});
        setScheduledDays(new Set(data.scheduledDays || []));
        setError(false);
      } else setError(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Lista autobuzelor pentru atribuirea manuală (o dată).
  useEffect(() => {
    fetch("/api/operator/buses")
      .then((r) => r.json())
      .then((d) => { if (d?.success) setBuses(d.buses); })
      .catch(() => {});
  }, []);

  const scheduleReload = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(load, 400);
  }, [load]);

  useEffect(() => {
    load();
    const supabase = getSupabase();
    let channel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;
    if (supabase) {
      channel = supabase
        .channel("operator-trips")
        .on("postgres_changes", { event: "*", schema: "public", table: "Booking" }, scheduleReload)
        .subscribe((status) => setLive(status === "SUBSCRIBED"));
    }
    const id = setInterval(load, supabase ? 30000 : 15000);
    return () => {
      clearInterval(id);
      if (supabase && channel) supabase.removeChannel(channel);
    };
  }, [load, scheduleReload]);

  // Selecția zilei implicite: azi dacă are curse, altfel prima zi cu curse.
  useEffect(() => {
    if (didInitDay.current || loading) return;
    const days = Object.keys(calendar).sort();
    if (days.length === 0) return;
    const tk = todayKey();
    const initial = calendar[tk] ? tk : (days.find((d) => d >= tk) ?? days[0]);
    setSelectedDay(initial);
    setViewMonth(parseKey(initial));
    didInitDay.current = true;
  }, [calendar, loading]);

  // Actualizare optimistă per rezervare (în structura grupată).
  const act = useCallback(async (id: string, patch: Record<string, unknown>) => {
    const apply = (b: OperatorBooking): OperatorBooking => {
      const next = { ...b };
      if (typeof patch.status === "string") next.status = patch.status;
      if (typeof patch.paymentStatus === "string") next.paymentStatus = patch.paymentStatus;
      if (patch.archive === true) next.archivedAt = new Date().toISOString();
      return next;
    };
    const snapshot = groups;
    setGroups((cur) =>
      cur.map((g) => ({ ...g, bookings: g.bookings.map((b) => (b.id === id ? apply(b) : b)) }))
    );
    try {
      const res = await fetch(`/api/operator/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      load();
      return true;
    } catch {
      setGroups(snapshot);
      return false;
    }
  }, [groups, load]);

  // Filtrare căutare (pe rezervările din grupuri).
  const matchBooking = useCallback((b: OperatorBooking) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (
      b.bookingNumber.toLowerCase().includes(s) ||
      `${b.firstName} ${b.lastName}`.toLowerCase().includes(s) ||
      b.phone.toLowerCase().includes(s) ||
      b.departureCity.toLowerCase().includes(s) ||
      b.arrivalCity.toLowerCase().includes(s)
    );
  }, [q]);

  // Când se caută, ignorăm ziua selectată și arătăm toate grupurile cu potriviri.
  const searching = q.trim().length > 0;

  const visibleGroups = useMemo(() => {
    return groups
      .map((g) => ({ ...g, bookings: g.bookings.filter(matchBooking) }))
      // Cursele goale (fără rezervări) apar doar când NU cauți (n-au ce potrivi).
      .filter((g) => (g.kind === "empty" ? !searching : g.bookings.length > 0))
      .filter((g) => searching || g.dayKey === selectedDay);
  }, [groups, matchBooking, searching, selectedDay]);

  const monthCells = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);
  const tk = todayKey();

  return (
    <div>
      {/* Antet */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-lg font-extrabold text-[color:var(--navy-900)]">Curse</h1>
          <span className="rounded-full bg-[color:var(--navy-50)] px-2 py-0.5 text-xs font-bold text-[color:var(--navy-900)]">
            {groups.length}
          </span>
          <span
            title={live ? "Timp real activ" : "Reîmprospătare la 15s"}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              live ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
            }`}
          >
            {live ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {live ? "Live" : "15s"}
          </span>
        </div>
        <button
          onClick={load}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--ink-200)] text-[color:var(--ink-500)] active:scale-95 transition-transform"
          title="Reîmprospătează"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Căutare globală */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[color:var(--ink-400)]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Caută pasager, telefon, oraș, nr…"
          className="w-full rounded-full border border-[color:var(--ink-200)] bg-white py-2.5 pl-9 pr-9 text-sm outline-none focus:border-[color:var(--navy-700)]"
        />
        {q && (
          <button
            onClick={() => setQ("")}
            aria-label="Șterge căutarea"
            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full text-[color:var(--ink-400)] hover:bg-[color:var(--ink-100)]"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Calendar lunar — ascuns când cauți. Lățime plafonată pe desktop ca
          celulele aspect-square să nu devină pătrate uriașe. */}
      {!searching && (
        <div className="mb-4 max-w-md rounded-2xl border border-[color:var(--ink-200)] bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <button
              onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--ink-500)] hover:bg-[color:var(--ink-100)]"
              aria-label="Luna precedentă"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-sm font-extrabold text-[color:var(--navy-900)]">
              {cap(monthYearFmt.format(viewMonth))}
            </div>
            <button
              onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--ink-500)] hover:bg-[color:var(--ink-100)]"
              aria-label="Luna următoare"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-[color:var(--ink-400)]">
            {["Lu", "Ma", "Mi", "Jo", "Vi", "Sâ", "Du"].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthCells.map(({ date, inMonth }, i) => {
              const key = dayKeyFromDate(date);
              const count = calendar[key] || 0;
              const isSel = key === selectedDay;
              const isToday = key === tk;
              const hasPax = count > 0;                          // cursă cu pasageri → special
              const schedEmpty = !hasPax && scheduledDays.has(key); // autocar programat, gol → mut
              const clickable = hasPax || schedEmpty;
              return (
                <button
                  key={i}
                  disabled={!clickable}
                  onClick={() => setSelectedDay(key)}
                  title={hasPax ? `${count} ${count === 1 ? "cursă" : "curse"} cu pasageri` : schedEmpty ? "Autocar programat, fără rezervări" : undefined}
                  className={`relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm transition-colors ${
                    isSel
                      ? "bg-[color:var(--navy-900)] font-bold text-white"
                      : hasPax
                        ? "bg-[color:var(--red-50)] font-semibold text-[color:var(--navy-900)] hover:bg-[color:var(--red-100)]"
                        : schedEmpty
                          ? "font-medium text-[color:var(--navy-700)] ring-1 ring-inset ring-[color:var(--ink-200)] hover:bg-[color:var(--ink-50)]"
                          : inMonth
                            ? "text-[color:var(--ink-400)]"
                            : "text-[color:var(--ink-200)]"
                  } ${isToday && !isSel ? "ring-1 ring-[color:var(--red-400)]" : ""} ${clickable ? "cursor-pointer" : "cursor-default"}`}
                >
                  {date.getDate()}
                  {hasPax ? (
                    <span className={`mt-0.5 text-[9px] font-bold leading-none ${isSel ? "text-white/80" : "text-[color:var(--red-500)]"}`}>
                      {count}
                    </span>
                  ) : schedEmpty ? (
                    <span className={`mt-0.5 h-1 w-1 rounded-full ${isSel ? "bg-white/70" : "bg-[color:var(--ink-300)]"}`} />
                  ) : null}
                </button>
              );
            })}
          </div>
          {/* Legendă */}
          <div className="mt-2 flex items-center justify-center gap-4 text-[10px] font-semibold text-[color:var(--ink-400)]">
            <span className="inline-flex items-center gap-1">
              <span className="flex h-4 w-4 items-center justify-center rounded bg-[color:var(--red-50)] text-[8px] font-bold text-[color:var(--red-500)]">3</span>
              cu pasageri
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="flex h-4 w-4 items-center justify-center rounded ring-1 ring-inset ring-[color:var(--ink-200)]"><span className="h-1 w-1 rounded-full bg-[color:var(--ink-300)]" /></span>
              autocar programat, gol
            </span>
          </div>
        </div>
      )}

      {/* Titlul zilei selectate */}
      {!searching && selectedDay && (
        <div className="mb-2 flex items-baseline gap-2">
          <h2 className="text-[13px] font-extrabold uppercase tracking-wide text-[color:var(--navy-900)]">
            {selectedDay === tk ? "Astăzi · " : ""}{cap(fmtDayLong.format(parseKey(selectedDay)))}
          </h2>
          <span className="text-[11px] font-semibold text-[color:var(--ink-400)]">
            {visibleGroups.length} {visibleGroups.length === 1 ? "cursă" : "curse"}
          </span>
        </div>
      )}

      {/* Conținut */}
      {loading ? (
        <SkeletonTrips />
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-10 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-400" />
          <p className="mt-3 text-sm font-semibold text-red-700">Nu am putut încărca cursele.</p>
          <button
            onClick={() => { setLoading(true); load(); }}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[color:var(--navy-900)] px-4 py-2 text-sm font-semibold text-white active:scale-95 transition-transform"
          >
            <RefreshCw className="h-4 w-4" /> Încearcă din nou
          </button>
        </div>
      ) : visibleGroups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--ink-200)] px-4 py-14 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-[color:var(--ink-300)]" />
          <p className="mt-3 text-sm font-semibold text-[color:var(--navy-900)]">
            {searching ? "Nicio rezervare nu se potrivește." : "Nicio cursă în ziua asta."}
          </p>
          {searching && (
            <button onClick={() => setQ("")} className="mt-3 text-xs font-semibold text-[color:var(--red-500)] hover:underline">
              Șterge căutarea
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visibleGroups.map((g) => (
            // Cheie dependentă de căutare: cardurile se remontează la trecerea
            // căutare pornit/oprit, ca `expanded` să pornească din starea corectă.
            <TripCard key={searching ? `${g.key}:s` : g.key} g={g} onAct={act} showDay={searching} buses={buses} />
          ))}
        </div>
      )}
    </div>
  );
}

function SkeletonTrips() {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-[color:var(--ink-200)] bg-white p-4">
          <div className="h-4 w-2/3 rounded bg-[color:var(--ink-100)]" />
          <div className="mt-3 h-3 w-1/3 rounded bg-[color:var(--ink-100)]" />
          <div className="mt-4 space-y-2">
            <div className="h-8 rounded bg-[color:var(--ink-100)]" />
            <div className="h-8 rounded bg-[color:var(--ink-100)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TripCard({ g, onAct, showDay, buses }: {
  g: TripGroup;
  onAct: (id: string, patch: Record<string, unknown>) => Promise<boolean>;
  showDay: boolean;
  buses: BusOption[];
}) {
  // Colapsat implicit — se desfășoară pasagerii la click pe antet (ca să nu dai
  // scroll între autocare). La căutare pornește desfășurat.
  const [expanded, setExpanded] = useState(showDay);
  const [showCancelled, setShowCancelled] = useState(showDay);
  const dep = new Date(g.departureAt);
  // Ocupare + „plătite" pe PASAGERI (locuri), nu pe rezervări (o rezervare poate
  // avea mai multe locuri = mai mulți pasageri). Pe circuitul DAW 077 (duminică +
  // luni, același autocar) ocuparea afișată = totalul COMBINAT, ca să nu suprarezervezi.
  const occ = g.circuitOcc
    ? `${g.circuitOcc.taken}/${g.circuitOcc.capacity}`
    : g.capacity ? `${g.seatsTaken}/${g.capacity}` : `${g.seatsTaken}`;
  const paidPax = g.bookings
    .filter((b) => b.status !== "cancelled" && b.paymentStatus === "paid")
    .reduce((s, b) => s + bookingPax(b, g.tripIds), 0);

  // Link "+": endpoint-ul calculează cum se preselectează cursa (tripId / capăt fix).
  const p = new URLSearchParams();
  if (g.add.tripId) p.set("tripId", g.add.tripId);
  if (g.add.from) p.set("from", g.add.from);
  if (g.add.to) p.set("to", g.add.to);
  // Data cursei → formularul selectează automat ziua (fără calendar);
  // țările → restrânge alegerea la țările pe care chiar le deservește cursa.
  if (g.add.date) p.set("date", g.add.date);
  if (g.add.countries?.length) p.set("countries", g.add.countries.join(","));
  const addHref = `/panou/rezervare${p.toString() ? `?${p.toString()}` : ""}`;

  // Cursă PROGRAMATĂ GOALĂ (autobuz în ziua asta, fără rezervări) — card mut, doar
  // cu „+ Rezervare pe cursă".
  if (g.kind === "empty") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed border-[color:var(--ink-200)] bg-[color:var(--ink-50)] p-3 sm:p-4">
        <div className="min-w-0">
          {/* Autocarul = identitatea cardului (ne bazăm pe autocar, nu pe țară). */}
          <div className="flex items-center gap-1.5 text-sm font-extrabold text-[color:var(--navy-900)]">
            <Bus className="h-4 w-4 shrink-0 text-[color:var(--ink-400)]" />
            <span className="truncate">{g.busLabel || "Autocar programat"}</span>
            {g.busPlate && <span className="text-[color:var(--ink-500)]">· {g.busPlate}</span>}
          </div>
          {g.to && (
            <div className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-[color:var(--ink-500)]">
              <span className="truncate">{g.from}</span>
              <ArrowRight className="h-3 w-3 shrink-0 text-[color:var(--ink-400)]" />
              <span className="truncate">{g.to}</span>
            </div>
          )}
          <div className="mt-0.5 text-xs font-semibold text-[color:var(--ink-400)]">
            {showDay && <>{cap(fmtDayLong.format(dep))} · </>}{fmtTime.format(dep)}
            {g.circuitOcc
              ? " · circuit DAW 077 (duminică + luni)"
              : `${" · fără rezervări"}${g.capacity ? ` · ${g.capacity} locuri libere` : ""}`}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {g.circuitOcc && (
            <span
              title="Ocupare pe circuitul DAW 077 (duminică Anglia + luni Belgia/Luxemburg — același autocar)"
              className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[color:var(--navy-900)] ring-1 ring-inset ring-[color:var(--ink-200)]"
            >
              <Users className="h-3.5 w-3.5 text-[color:var(--ink-400)]" /> {occ}
            </span>
          )}
          <Link
            href={addHref}
            className="inline-flex items-center gap-1 rounded-full bg-[color:var(--red-500)] px-3 py-1.5 text-xs font-semibold text-white active:scale-95 transition-transform hover:bg-[color:var(--red-600)]"
          >
            <Plus className="h-3.5 w-3.5" /> Rezervare pe cursă
          </Link>
        </div>
      </div>
    );
  }

  // Excel real (.xlsx stilizat) generat pe server; link cu cookie same-origin.
  const excelHref = `/api/operator/manifest?key=${encodeURIComponent(g.key)}`;
  const exportPdf = () => {
    const html = buildManifestHtml(g);
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  const active = g.bookings.filter((b) => b.status !== "cancelled");
  const cancelledList = g.bookings.filter((b) => b.status === "cancelled");
  // Orașul specific contează mereu pentru șofer (model hub) — îl arătăm când
  // diferă de antetul cursei sau când cursa are mai multe puncte.
  const showRouteFor = (b: OperatorBooking) =>
    g.multi || cityOnly(b.departureCity) !== g.from || cityOnly(b.arrivalCity) !== g.to;
  const canAssignFor = (b: OperatorBooking) => g.busId === null || !!b.manualBusId;

  return (
    <div className="overflow-hidden rounded-2xl border border-[color:var(--ink-200)] bg-white">
      {/* Antet cursă — click pentru a desfășura pasagerii (colapsat implicit, ca
          să nu dai scroll între autocare). */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setExpanded((v) => !v); } }}
        className="flex cursor-pointer select-none items-start justify-between gap-2 bg-[color:var(--navy-50)] p-3 sm:p-4"
      >
        <div className="min-w-0">
          {/* Autocarul = titlul principal; țările = linie secundară. */}
          <div className="flex items-center gap-1.5 text-base font-extrabold text-[color:var(--navy-900)]">
            <Bus className="h-4 w-4 shrink-0 text-[color:var(--red-500)]" />
            <span className="truncate">{g.busLabel || "Fără autocar atribuit"}</span>
            {g.busPlate && <span className="text-[color:var(--ink-500)]">· {g.busPlate}</span>}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-[color:var(--ink-500)]">
            <span className="truncate">{g.from}</span>
            <ArrowRight className="h-3 w-3 shrink-0 text-[color:var(--ink-400)]" />
            <span className="truncate">{g.to}</span>
          </div>
          <div className="mt-0.5 text-xs font-semibold text-[color:var(--ink-500)]">
            {showDay && <>{cap(fmtDayLong.format(dep))} · </>}
            {fmtTime.format(dep)}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
          <div
            title={g.circuitOcc ? "Ocupare pe circuitul DAW 077 (duminică + luni, același autocar)" : undefined}
            className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[color:var(--navy-900)]"
          >
            <Users className="h-3.5 w-3.5 text-[color:var(--ink-400)]" /> {occ}
            {g.circuitOcc && <span className="text-[9px] font-semibold text-[color:var(--ink-400)]">circuit</span>}
          </div>
          <div className="text-[11px] font-bold text-[color:var(--navy-900)]">
            {active.length} {active.length === 1 ? "rezervare" : "rezervări"}
            {paidPax > 0 && <span className="font-semibold text-emerald-600"> · {paidPax} plătite</span>}
          </div>
          {cancelledList.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(true); setShowCancelled((v) => !v); }}
              className="text-[10px] font-semibold text-red-600 hover:underline"
            >
              {cancelledList.length} {cancelledList.length === 1 ? "anulată" : "anulate"}
            </button>
          )}
          <ChevronDown className={`h-4 w-4 text-[color:var(--ink-400)] transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </div>

      {expanded && (
        <>
          {/* Acțiuni cursă: + rezervare, export */}
          <div className="flex flex-wrap items-center gap-1.5 bg-[color:var(--navy-50)] px-3 pb-3 sm:px-4">
            <Link
              href={addHref}
              className="inline-flex items-center gap-1 rounded-full bg-[color:var(--red-500)] px-3 py-1.5 text-xs font-semibold text-white active:scale-95 transition-transform hover:bg-[color:var(--red-600)]"
            >
              <Plus className="h-3.5 w-3.5" /> Rezervare pe cursă
            </Link>
            <a
              href={excelHref}
              className="inline-flex items-center gap-1 rounded-full border border-[color:var(--ink-200)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--navy-900)] active:scale-95 transition-transform"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Excel
            </a>
            <button
              onClick={exportPdf}
              className="inline-flex items-center gap-1 rounded-full border border-[color:var(--ink-200)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--navy-900)] active:scale-95 transition-transform"
            >
              <Printer className="h-3.5 w-3.5 text-[color:var(--red-500)]" /> PDF
            </button>
          </div>

          {/* Pasageri ACTIVI (anulatele NU apar aici) */}
          <div className="divide-y divide-[color:var(--ink-100)]">
            {active.map((b) => (
              <BookingRow key={b.id} b={b} seats={seatsFor(b, g)} showRoute={showRouteFor(b)} canAssign={canAssignFor(b)} buses={buses} onAct={onAct} />
            ))}
          </div>

          {/* Anulate — ascunse până la click pe „y anulate". */}
          {cancelledList.length > 0 && (
            <div className="border-t border-[color:var(--ink-100)]">
              <button
                onClick={() => setShowCancelled((v) => !v)}
                className="flex w-full items-center justify-center gap-1 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                <X className="h-3.5 w-3.5" />
                {showCancelled ? "Ascunde" : "Arată"} {cancelledList.length} {cancelledList.length === 1 ? "anulată" : "anulate"}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showCancelled ? "rotate-180" : ""}`} />
              </button>
              {showCancelled && (
                <div className="divide-y divide-[color:var(--ink-100)]">
                  {cancelledList.map((b) => (
                    <BookingRow key={b.id} b={b} seats={seatsFor(b, g)} showRoute={showRouteFor(b)} canAssign={canAssignFor(b)} buses={buses} onAct={onAct} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BookingRow({ b, seats, showRoute, canAssign, buses, onAct }: {
  b: OperatorBooking;
  seats: number[];
  showRoute: boolean;
  canAssign: boolean;
  buses: BusOption[];
  onAct: (id: string, patch: Record<string, unknown>) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const cancelled = b.status === "cancelled";
  const assignBus = async (busId: string) => {
    setBusy("bus");
    await onAct(b.id, { manualBusId: busId || null });
    setBusy(null);
  };

  const run = async (label: string, patch: Record<string, unknown>) => {
    setBusy(label);
    await onAct(b.id, patch);
    setBusy(null);
    setConfirmCancel(false);
  };

  return (
    <div className={`p-3 ${cancelled ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot(b.status)}`} title={statusLabel(b.status)} />
            <span className="text-sm font-bold text-[color:var(--navy-900)] truncate">{displayPassengerNames(b.firstName, b.lastName)}</span>
            {b.boardedAt && (
              <span className="shrink-0 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white" title={`Îmbarcat${b.boardedBy ? ` de ${b.boardedBy}` : ""}`}>
                Îmbarcat
              </span>
            )}
            {b.type === "parcel" && <Package className="h-3.5 w-3.5 shrink-0 text-[color:var(--ink-400)]" />}
            {seats.length > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[color:var(--navy-900)]">
                <Armchair className="h-3 w-3 text-[color:var(--ink-400)]" /> {seats.join(", ")}
              </span>
            )}
          </div>
          {/* Ruta pasagerului — utilă doar când cursa are mai multe puncte de
              îmbarcare (altfel e aceeași cu antetul cursei). */}
          {showRoute && (
            <div className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-[color:var(--navy-700)]">
              <span className="truncate">{cityOnly(b.departureCity)}</span>
              <ArrowRight className="h-3 w-3 shrink-0 text-[color:var(--red-400)]" />
              <span className="truncate">{cityOnly(b.arrivalCity)}</span>
            </div>
          )}
          {/* Notița operatorului (Observații) + surplus bagaj de la îmbarcare */}
          {b.notes && (
            <div className="mt-0.5 text-[11px] italic text-[color:var(--ink-700)]">📝 {b.notes}</div>
          )}
          {b.baggageSurplus && (
            <div className="mt-0.5 text-[11px] font-semibold text-amber-700">🧳 Surplus bagaj: {b.baggageSurplus}</div>
          )}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-[color:var(--ink-500)]">
            <span className="font-mono">{b.bookingNumber}</span>
            <span>· {sourceLabel(b)}</span>
            {b.source === "site" && b.passengerResponse === "confirmed" && <span className="font-semibold text-emerald-600">· ✓ client</span>}
            {b.source === "site" && b.passengerResponse === "cancelled" && <span className="font-semibold text-red-600">· ✗ client</span>}
            {cancelled && <span className="font-semibold text-red-600">· anulată</span>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-extrabold leading-none text-[color:var(--navy-900)]">{b.price}{curr(b.currency)}</div>
          <div className={`mt-0.5 text-[10px] font-semibold ${b.paymentStatus === "paid" ? "text-emerald-600" : "text-[color:var(--ink-400)]"}`}>
            {b.paymentStatus === "paid" ? "achitat" : "neachitat"}
          </div>
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <a
          href={`tel:${b.phone}`}
          className="inline-flex items-center gap-1 rounded-full bg-[color:var(--navy-50)] px-2.5 py-1 text-xs font-semibold text-[color:var(--navy-900)] active:scale-95 transition-transform"
        >
          <Phone className="h-3.5 w-3.5" /> {b.phone}
        </a>
        <button
          onClick={() => { setOpen((v) => !v); setConfirmCancel(false); }}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-[color:var(--ink-500)] hover:bg-[color:var(--ink-50)]"
        >
          Acțiuni <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <a href={`/bilet/${b.bookingNumber}`} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-[color:var(--ink-200)] px-3 py-1.5 text-xs font-semibold text-[color:var(--navy-900)] active:scale-95 transition-transform">
            <Ticket className="h-3.5 w-3.5 text-[color:var(--red-500)]" /> Bilet
          </a>
          <a href={`mailto:${b.email}`}
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-[color:var(--ink-200)] px-3 py-1.5 text-xs font-semibold text-[color:var(--navy-900)] active:scale-95 transition-transform">
            <Mail className="h-3.5 w-3.5 shrink-0 text-[color:var(--ink-400)]" /> <span className="truncate">{b.email}</span>
          </a>
          {!cancelled && (
            <RowBtn onClick={() => setEditOpen(true)} className="border border-[color:var(--navy-200,rgba(20,58,122,0.2))] bg-[color:var(--navy-50)] text-[color:var(--navy-900)]">
              <Pencil className="h-3.5 w-3.5 text-[color:var(--red-500)]" /> Editează
            </RowBtn>
          )}
          {b.status !== "confirmed" && (
            <RowBtn busy={busy === "confirm"} onClick={() => run("confirm", { status: "confirmed" })} className="bg-emerald-500 text-white">
              <Check className="h-3.5 w-3.5" /> Confirmă
            </RowBtn>
          )}
          {!cancelled && (
            confirmCancel ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 pl-3 pr-1 py-1 text-xs font-semibold text-red-700">
                Eliberezi locurile — sigur?
                <RowBtn busy={busy === "cancel"} onClick={() => run("cancel", { status: "cancelled" })} className="bg-red-600 text-white !px-2.5">Da</RowBtn>
                <button onClick={() => setConfirmCancel(false)} className="rounded-full px-2 py-1 text-xs font-semibold text-[color:var(--ink-500)] hover:bg-white">Nu</button>
              </span>
            ) : (
              <RowBtn onClick={() => setConfirmCancel(true)} className="border border-red-200 text-red-600">
                <X className="h-3.5 w-3.5" /> Anulează
              </RowBtn>
            )
          )}
          {b.paymentStatus !== "paid" && (
            <RowBtn busy={busy === "paid"} onClick={() => run("paid", { paymentStatus: "paid" })} className="border border-[color:var(--ink-200)] text-[color:var(--navy-900)]">
              Marchează achitat
            </RowBtn>
          )}
          <RowBtn busy={busy === "archive"} onClick={() => run("archive", { archive: true })} className="border border-[color:var(--ink-200)] text-[color:var(--ink-500)]">
            <Archive className="h-3.5 w-3.5" /> Arhivează
          </RowBtn>

          {/* Atribuire autobuz — doar la rezervările fără cursă cu autocar (sau
              deja atribuite manual, ca să poți schimba/scoate). Alătură
              rezervarea foii fizice a autobuzului ales. */}
          {canAssign && buses.length > 0 && (
            <label className="inline-flex items-center gap-1 rounded-full border border-[color:var(--navy-200,rgba(20,58,122,0.2))] bg-[color:var(--navy-50)] pl-2.5 pr-1 py-1 text-xs font-semibold text-[color:var(--navy-900)]">
              <Bus className="h-3.5 w-3.5 text-[color:var(--red-500)]" />
              {busy === "bus" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <select
                  value={b.manualBusId ?? ""}
                  onChange={(e) => assignBus(e.target.value)}
                  className="max-w-[9rem] cursor-pointer truncate bg-transparent pr-1 text-xs font-semibold outline-none"
                >
                  <option value="">Atribuie autocar…</option>
                  {buses.map((bus) => (
                    <option key={bus.id} value={bus.id}>
                      {bus.label}{bus.plate ? ` · ${bus.plate}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </label>
          )}
        </div>
      )}

      {editOpen && (
        <EditBookingModal b={b} onClose={() => setEditOpen(false)} onSubmit={(patch) => onAct(b.id, patch)} />
      )}
    </div>
  );
}

function RowBtn({ busy, onClick, className, children }: {
  busy?: boolean; onClick: () => void; className?: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold active:scale-95 transition-transform disabled:opacity-60 ${className ?? ""}`}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      {children}
    </button>
  );
}
