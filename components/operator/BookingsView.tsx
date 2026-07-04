"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight, Phone, Users, Package, User, Check, X,
  Archive, RefreshCw, Search, Wifi, WifiOff, ChevronDown,
  AlertTriangle, CalendarDays, Loader2, Armchair, Mail, Ticket,
} from "lucide-react";
import { getSupabase } from "@/lib/supabaseClient";

export type OperatorBooking = {
  id: string;
  bookingNumber: string;
  type: string;
  status: string;
  tripType: string | null;
  departureCity: string;
  arrivalCity: string;
  departureDate: string;
  returnDate: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  adults: number;
  children: number;
  price: number;
  currency: string;
  paymentStatus: string;
  payMethod: string | null;
  passengerResponse: string | null;
  source: string;
  createdByName: string | null;
  createdAt: string;
  archivedAt: string | null;
  tripId: string | null;
  returnTripId: string | null;
  manualBusId: string | null;
  seatBookings: { seatNumber: number; tripId: string }[];
};

const fmtDate = new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "short" });
const fmtTime = new Intl.DateTimeFormat("ro-RO", { hour: "2-digit", minute: "2-digit" });
const fmtDay = new Intl.DateTimeFormat("ro-RO", { weekday: "short", day: "numeric", month: "long" });
const fmtDayYear = new Intl.DateTimeFormat("ro-RO", { weekday: "short", day: "numeric", month: "long", year: "numeric" });

function curr(c: string) {
  return c === "GBP" ? "£" : c === "EUR" ? "€" : c;
}

/** Cheie de zi locală (YYYY-MM-DD) pentru gruparea pe data plecării. */
function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  const base = date.getFullYear() === today.getFullYear() ? fmtDay.format(date) : fmtDayYear.format(date);
  if (diffDays === 0) return `Astăzi · ${base}`;
  if (diffDays === 1) return `Mâine · ${base}`;
  if (diffDays === -1) return `Ieri · ${base}`;
  return base;
}

type QuickFilter = "all" | "today" | "pending" | "unpaid" | "parcel";

export default function BookingsView({ scope }: { scope: "active" | "archived" }) {
  const [bookings, setBookings] = useState<OperatorBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<QuickFilter>("all");
  const [live, setLive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/operator/bookings?scope=${scope}`, { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setBookings(data.bookings);
        setError(false);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [scope]);

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
        .channel("operator-bookings")
        .on("postgres_changes", { event: "*", schema: "public", table: "Booking" }, scheduleReload)
        .subscribe((status) => setLive(status === "SUBSCRIBED"));
    }
    const id = setInterval(load, supabase ? 30000 : 15000);
    return () => {
      clearInterval(id);
      if (supabase && channel) supabase.removeChannel(channel);
    };
  }, [load, scheduleReload]);

  const act = useCallback(async (id: string, patch: Record<string, unknown>): Promise<boolean> => {
    // Optimist: aplicăm local instant; la eșec revenim DOAR cardul afectat
    // (un snapshot pe toată lista ar șterge update-urile concurente reușite
    // de pe alte carduri sau venite prin realtime între timp).
    const original = bookings.find((b) => b.id === id);
    setBookings((cur) =>
      cur.map((b) => {
        if (b.id !== id) return b;
        const next = { ...b };
        if (typeof patch.status === "string") next.status = patch.status;
        if (typeof patch.paymentStatus === "string") next.paymentStatus = patch.paymentStatus;
        if (patch.archive === true) next.archivedAt = new Date().toISOString();
        if (patch.archive === false) next.archivedAt = null;
        return next;
      })
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
      if (original) {
        setBookings((cur) => cur.map((b) => (b.id === id ? original : b)));
      }
      return false;
    }
  }, [bookings, load]);

  const todayKey = dayKey(new Date().toISOString());

  // Contoare pentru chip-urile de filtrare rapidă (pe setul complet, nu pe cel căutat).
  const counts = useMemo(() => ({
    all: bookings.length,
    today: bookings.filter((b) => dayKey(b.departureDate) === todayKey).length,
    pending: bookings.filter((b) => b.status === "pending").length,
    unpaid: bookings.filter((b) => b.paymentStatus !== "paid" && b.status !== "cancelled").length,
    parcel: bookings.filter((b) => b.type === "parcel").length,
  }), [bookings, todayKey]);

  const filtered = useMemo(() => bookings.filter((b) => {
    if (filter === "today" && dayKey(b.departureDate) !== todayKey) return false;
    if (filter === "pending" && b.status !== "pending") return false;
    if (filter === "unpaid" && (b.paymentStatus === "paid" || b.status === "cancelled")) return false;
    if (filter === "parcel" && b.type !== "parcel") return false;
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (
      b.bookingNumber.toLowerCase().includes(s) ||
      `${b.firstName} ${b.lastName}`.toLowerCase().includes(s) ||
      b.phone.toLowerCase().includes(s) ||
      b.departureCity.toLowerCase().includes(s) ||
      b.arrivalCity.toLowerCase().includes(s) ||
      (b.createdByName || "").toLowerCase().includes(s)
    );
  }), [bookings, filter, q, todayKey]);

  // Grupare pe ziua plecării — operatorii gândesc în curse, nu în listă plată.
  const groups = useMemo(() => {
    const map = new Map<string, OperatorBooking[]>();
    for (const b of filtered) {
      const key = dayKey(b.departureDate);
      const arr = map.get(key);
      if (arr) arr.push(b);
      else map.set(key, [b]);
    }
    // API-ul vine sortat (asc pe active, desc pe arhivă) — Map păstrează ordinea.
    return Array.from(map.entries());
  }, [filtered]);

  const chips: Array<{ key: QuickFilter; label: string; count: number; tone?: "warn" | "danger" }> = scope === "active"
    ? [
        { key: "all", label: "Toate", count: counts.all },
        { key: "today", label: "Pleacă azi", count: counts.today },
        { key: "pending", label: "În așteptare", count: counts.pending, tone: "warn" },
        { key: "unpaid", label: "Neachitate", count: counts.unpaid, tone: "danger" },
        { key: "parcel", label: "Colete", count: counts.parcel },
      ]
    : [
        { key: "all", label: "Toate", count: counts.all },
        { key: "parcel", label: "Colete", count: counts.parcel },
      ];

  return (
    <div>
      <div className="mb-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-extrabold text-[color:var(--navy-900)]">
              {scope === "active" ? "Active" : "Arhivă"}
            </h1>
            <span className="rounded-full bg-[color:var(--navy-50)] px-2 py-0.5 text-xs font-bold text-[color:var(--navy-900)]">
              {filtered.length}
            </span>
            {scope === "active" && (
              <span
                title={live ? "Timp real activ" : "Reîmprospătare la 15s"}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  live ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                }`}
              >
                {live ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {live ? "Live" : "15s"}
              </span>
            )}
          </div>
          <button
            onClick={load}
            className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-[color:var(--ink-200)] text-[color:var(--ink-500)] active:scale-95 transition-transform"
            title="Reîmprospătează"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[color:var(--ink-400)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Caută nume, telefon, oraș, nr…"
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

        {/* Filtre rapide — statistici pe care poți apăsa */}
        {!loading && !error && bookings.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex-wrap">
            {chips.map((c) => {
              const active = filter === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => setFilter(active && c.key !== "all" ? "all" : c.key)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? "border-[color:var(--navy-900)] bg-[color:var(--navy-900)] text-white"
                      : "border-[color:var(--ink-200)] bg-white text-[color:var(--ink-500)] hover:border-[color:var(--navy-700)] hover:text-[color:var(--navy-900)]"
                  }`}
                >
                  {c.label}
                  <span
                    className={`rounded-full px-1.5 py-px text-[10px] font-bold ${
                      active
                        ? "bg-white/20 text-white"
                        : c.tone === "danger" && c.count > 0
                          ? "bg-red-50 text-red-600"
                          : c.tone === "warn" && c.count > 0
                            ? "bg-amber-50 text-amber-700"
                            : "bg-[color:var(--ink-100)] text-[color:var(--ink-500)]"
                    }`}
                  >
                    {c.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {loading ? (
        <SkeletonGrid />
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-10 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-400" />
          <p className="mt-3 text-sm font-semibold text-red-700">Nu am putut încărca rezervările.</p>
          <p className="mt-1 text-xs text-red-500">Verifică conexiunea și încearcă din nou.</p>
          <button
            onClick={() => { setLoading(true); load(); }}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[color:var(--navy-900)] px-4 py-2 text-sm font-semibold text-white active:scale-95 transition-transform"
          >
            <RefreshCw className="h-4 w-4" /> Încearcă din nou
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--ink-200)] px-4 py-14 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-[color:var(--ink-300)]" />
          <p className="mt-3 text-sm font-semibold text-[color:var(--navy-900)]">
            {q.trim() || filter !== "all"
              ? "Nimic nu se potrivește cu filtrarea."
              : scope === "active" ? "Nicio rezervare activă." : "Arhiva e goală."}
          </p>
          {(q.trim() || filter !== "all") && (
            <button
              onClick={() => { setQ(""); setFilter("all"); }}
              className="mt-3 text-xs font-semibold text-[color:var(--red-500)] hover:underline"
            >
              Resetează filtrele
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(([key, items]) => (
            <section key={key}>
              <div className="mb-2 flex items-baseline gap-2">
                <h2 className={`text-[13px] font-extrabold uppercase tracking-wide ${
                  key === todayKey ? "text-[color:var(--red-500)]" : "text-[color:var(--navy-900)]"
                }`}>
                  {dayLabel(key)}
                </h2>
                <span className="text-[11px] font-semibold text-[color:var(--ink-400)]">
                  {items.length} {items.length === 1 ? "rezervare" : "rezervări"}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((b) => (
                  <BookingCard key={b.id} b={b} scope={scope} onAct={act} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl border border-[color:var(--ink-200)] bg-white p-3">
          <div className="flex items-center justify-between">
            <div className="h-3 w-32 rounded bg-[color:var(--ink-100)]" />
            <div className="h-4 w-12 rounded bg-[color:var(--ink-100)]" />
          </div>
          <div className="mt-3 h-4 w-3/4 rounded bg-[color:var(--ink-100)]" />
          <div className="mt-2 h-3 w-1/2 rounded bg-[color:var(--ink-100)]" />
          <div className="mt-3 flex items-center justify-between">
            <div className="h-3 w-24 rounded bg-[color:var(--ink-100)]" />
            <div className="h-6 w-28 rounded-full bg-[color:var(--ink-100)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function statusDot(status: string) {
  return status === "confirmed" ? "bg-emerald-500" : status === "cancelled" ? "bg-red-500" : "bg-amber-500";
}
function statusLabel(status: string) {
  return status === "confirmed" ? "Confirmată" : status === "cancelled" ? "Anulată" : "În așteptare";
}
function sourceLabel(b: OperatorBooking) {
  // admin/admin2 din panoul davo → rezervare manuală (cu numele adminului);
  // operator → numele operatorului de pe acest panou; altfel = client de pe site.
  if (b.source === "admin") return `Rezervare manuală · ${b.createdByName || "Admin"}`;
  if (b.source === "operator") return `Operator · ${b.createdByName || "?"}`;
  return "Client site";
}

// Culoare distinctă pentru sursă: manual (admin) = ambru, operator = navy,
// client site = neutru. Ajută operatorul să distingă rapid din privire.
function sourceClass(source: string) {
  if (source === "admin") return "text-amber-700";
  if (source === "operator") return "text-[color:var(--navy-700)]";
  return "text-[color:var(--ink-500)]";
}

function BookingCard({
  b, scope, onAct,
}: {
  b: OperatorBooking;
  scope: "active" | "archived";
  onAct: (id: string, patch: Record<string, unknown>) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const dep = new Date(b.departureDate);
  const ret = b.returnDate ? new Date(b.returnDate) : null;
  const cancelled = b.status === "cancelled";
  // Locurile, separate dus/retur — clientul întreabă mereu "ce loc am?".
  const seats = b.seatBookings ?? [];
  const outboundSeats = seats.filter((s) => s.tripId === b.tripId).map((s) => s.seatNumber);
  const returnSeats = b.returnTripId
    ? seats.filter((s) => s.tripId === b.returnTripId).map((s) => s.seatNumber)
    : [];

  const run = async (label: string, patch: Record<string, unknown>) => {
    setBusy(label);
    await onAct(b.id, patch);
    setBusy(null);
    setConfirmCancel(false);
  };

  return (
    <div className={`min-w-0 rounded-xl border bg-white p-3 ${
      cancelled ? "border-red-100 opacity-75" : "border-[color:var(--ink-200)]"
    }`}>
      {/* Linia 1: status + nr + cine + preț */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot(b.status)}`} title={statusLabel(b.status)} />
          <span className="shrink-0 font-mono text-[11px] font-bold text-[color:var(--navy-900)] truncate">{b.bookingNumber}</span>
          <span className="shrink-0 text-[11px] text-[color:var(--ink-400)]">·</span>
          <span className={`min-w-0 text-[11px] font-semibold truncate ${sourceClass(b.source)}`}>{sourceLabel(b)}</span>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-extrabold leading-none text-[color:var(--navy-900)]">{b.price}{curr(b.currency)}</div>
          <div className={`text-[10px] leading-tight mt-0.5 ${b.paymentStatus === "paid" ? "text-emerald-600 font-semibold" : "text-[color:var(--ink-400)]"}`}>
            {b.paymentStatus === "paid" ? "achitat" : "neachitat"}
          </div>
        </div>
      </div>

      {/* Linia 2: ruta + data + pax */}
      <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-sm font-bold text-[color:var(--navy-900)]">
        <span className="min-w-0 truncate">{b.departureCity}</span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[color:var(--red-500)]" />
        <span className="min-w-0 truncate">{b.arrivalCity}</span>
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-[color:var(--ink-500)]">
        <span>{fmtDate.format(dep)} · {fmtTime.format(dep)}</span>
        {ret && <span>· retur {fmtDate.format(ret)}</span>}
        <span className="inline-flex items-center gap-0.5">
          · {b.type === "parcel" ? <Package className="h-3 w-3" /> : <Users className="h-3 w-3" />}
          {b.type === "parcel" ? "colet" : `${b.adults + b.children}`}
        </span>
        {outboundSeats.length > 0 && (
          <span className="inline-flex items-center gap-0.5 font-semibold text-[color:var(--navy-900)]">
            · <Armchair className="h-3 w-3 text-[color:var(--ink-400)]" /> {outboundSeats.join(", ")}
            {returnSeats.length > 0 && <span className="font-normal text-[color:var(--ink-500)]"> (retur {returnSeats.join(", ")})</span>}
          </span>
        )}
        {cancelled && <span className="font-semibold text-red-600">· anulată</span>}
        {/* Statutul din emailul clientului (V/X) are sens DOAR la rezervările
            făcute de client pe site — la cele manuale (admin/operator) nu. */}
        {b.source === "site" && b.passengerResponse === "confirmed" && <span className="text-emerald-600 font-semibold">· ✓ client</span>}
        {b.source === "site" && b.passengerResponse === "cancelled" && <span className="text-red-600 font-semibold">· ✗ client</span>}
      </div>

      {/* Linia 3: pasager + telefon (tap to call). flex-wrap: numărul nu se mai
          taie pe ecrane înguste — coboară pe rândul următor întreg. */}
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--navy-900)] min-w-0">
          <User className="h-3.5 w-3.5 shrink-0 text-[color:var(--ink-400)]" />
          <span className="min-w-0 truncate">{b.firstName} {b.lastName}</span>
        </span>
        <a
          href={`tel:${b.phone}`}
          className="inline-flex items-center gap-1 shrink-0 rounded-full bg-[color:var(--navy-50)] px-2.5 py-1 text-xs font-semibold text-[color:var(--navy-900)] active:scale-95 transition-transform"
        >
          <Phone className="h-3.5 w-3.5" /> {b.phone}
        </a>
      </div>

      {/* Acțiuni — ascunse sub un buton ca să rămână compact; un tap le deschide */}
      <button
        onClick={() => { setOpen((v) => !v); setConfirmCancel(false); }}
        className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg bg-[color:var(--ink-50)] py-1.5 text-[11px] font-semibold text-[color:var(--ink-500)] active:bg-[color:var(--ink-100)]"
      >
        Acțiuni <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-[color:var(--ink-500)]">
          <a
            href={`/bilet/${b.bookingNumber}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-[color:var(--ink-200)] px-3 py-1.5 text-xs font-semibold text-[color:var(--navy-900)] active:scale-95 transition-transform"
          >
            <Ticket className="h-3.5 w-3.5 text-[color:var(--red-500)]" /> Bilet
          </a>
          <a
            href={`mailto:${b.email}`}
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-[color:var(--ink-200)] px-3 py-1.5 text-xs font-semibold text-[color:var(--navy-900)] active:scale-95 transition-transform"
          >
            <Mail className="h-3.5 w-3.5 shrink-0 text-[color:var(--ink-400)]" />
            <span className="min-w-0 truncate">{b.email}</span>
          </a>
        </div>
      )}
      {open && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {scope === "active" && b.status !== "confirmed" && (
            <ActionBtn busy={busy === "confirm"} onClick={() => run("confirm", { status: "confirmed" })}
              className="bg-emerald-500 text-white">
              <Check className="h-3.5 w-3.5" /> Confirmă
            </ActionBtn>
          )}
          {scope === "active" && !cancelled && (
            confirmCancel ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 pl-3 pr-1 py-1 text-xs font-semibold text-red-700">
                Se eliberează locurile — sigur?
                <ActionBtn busy={busy === "cancel"} onClick={() => run("cancel", { status: "cancelled" })}
                  className="bg-red-600 text-white !px-2.5">
                  Da, anulează
                </ActionBtn>
                <button onClick={() => setConfirmCancel(false)}
                  className="rounded-full px-2 py-1 text-xs font-semibold text-[color:var(--ink-500)] hover:bg-white">
                  Nu
                </button>
              </span>
            ) : (
              <ActionBtn onClick={() => setConfirmCancel(true)}
                className="border border-red-200 text-red-600">
                <X className="h-3.5 w-3.5" /> Anulează
              </ActionBtn>
            )
          )}
          {scope === "active" && b.paymentStatus !== "paid" && (
            <ActionBtn busy={busy === "paid"} onClick={() => run("paid", { paymentStatus: "paid" })}
              className="border border-[color:var(--ink-200)] text-[color:var(--navy-900)]">
              Achitat
            </ActionBtn>
          )}
          {scope === "active" ? (
            <ActionBtn busy={busy === "archive"} onClick={() => run("archive", { archive: true })}
              className="border border-[color:var(--ink-200)] text-[color:var(--ink-500)]">
              <Archive className="h-3.5 w-3.5" /> Arhivează
            </ActionBtn>
          ) : (
            <ActionBtn busy={busy === "unarchive"} onClick={() => run("unarchive", { archive: false })}
              className="border border-[color:var(--ink-200)] text-[color:var(--ink-500)]">
              Dezarhivează
            </ActionBtn>
          )}
        </div>
      )}
    </div>
  );
}

function ActionBtn({
  busy, onClick, className, children,
}: {
  busy?: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
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
