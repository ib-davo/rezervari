"use client";

import { useEffect, useMemo, useState } from "react";
import { Armchair, RefreshCw, Bus as BusIcon, ArrowLeftRight } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import { BusSeatMap } from "@/components/booking/BusSeatMap";
import {
  CountryCityPicker,
  complementHide,
  getCountryFromValue,
} from "@/components/booking/CountryCityPicker";
import { useLocale } from "@/lib/i18n/client";
import type { BusLayout } from "@/lib/adminMock";

// Pagină de vizualizare schemă autocar: admin / admin2 selectează ruta și
// cursa, vede layout-ul autocarului cu locurile ocupate. Click pe un loc
// ocupat → detaliile pasagerului. Nu permite rezervare (read-only).

type TripRow = {
  id: string;
  departureAt: string;
  availableSeats: number;
  totalSeats: number;
  busLabel: string;
};

type SeatInfo = {
  bookingId: string;
  bookingNumber: string;
  passengerName: string;
  phone: string;
  email: string;
  status: string;
};

type UnassignedBooking = {
  id: string;
  bookingNumber: string;
  passengerName: string;
  phone: string;
  email: string;
  status: string;
  type: string;
  paxCount: number;
};

const fullDateFmt = new Intl.DateTimeFormat("ro-RO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Chisinau",
});

export default function SeatsPage() {
  const locale = useLocale();

  // Picker-e țară-oraș, ca pe site. Valorile sunt stringuri "Oraș, Țară" sau
  // doar "Țară" cât timp orașul nu e ales încă. Inițial pornim cu MD →
  // Anglia (default uzual operațional), userul poate inversa instant.
  const [from, setFrom] = useState<string>("Chișinău, Moldova");
  const [to, setTo] = useState<string>("");

  const [trips, setTrips] = useState<TripRow[]>([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [tripId, setTripId] = useState<string>("");

  const [tripDetail, setTripDetail] = useState<{
    layout: BusLayout;
    occupiedSeats: number[];
  } | null>(null);
  const [seatInfoMap, setSeatInfoMap] = useState<Record<number, SeatInfo>>({});
  const [unassigned, setUnassigned] = useState<UnassignedBooking[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [inspectedSeat, setInspectedSeat] = useState<number | null>(null);

  // Constraint MD ↔ străinătate (cum e și pe site): cursele DAVO merg mereu
  // între Moldova și o țară străină, niciodată Moldova-Moldova sau
  // foreign-foreign. Picker-ul opus ascunde țările incompatibile.
  const fromCountry = getCountryFromValue(from);
  const toCountry = getCountryFromValue(to);
  const fromHide = useMemo(() => complementHide(toCountry), [toCountry]);
  const toHide = useMemo(() => complementHide(fromCountry), [fromCountry]);

  // Map nume oraș (lowercase) → ID din DB. Endpoint-ul de curse cere UUID,
  // deci trebuie să rezolvăm înainte de fetch. Cache la nivel de mount.
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

  function fromCity(v: string): string {
    const idx = v.indexOf(",");
    return idx > 0 ? v.slice(0, idx).trim() : "";
  }

  // Rezolvare nume → ID pe baza valorii curente a picker-elor.
  const originCityId = useMemo(() => {
    if (!cityIndex) return null;
    const city = fromCity(from).toLowerCase();
    return city ? cityIndex[city] ?? null : null;
  }, [from, cityIndex]);
  const destCityId = useMemo(() => {
    if (!cityIndex) return null;
    const city = fromCity(to).toLowerCase();
    return city ? cityIndex[city] ?? null : null;
  }, [to, cityIndex]);

  function swapDirection() {
    setFrom(to);
    setTo(from);
    setTripId("");
    setTripDetail(null);
    setSeatInfoMap({});
    setInspectedSeat(null);
  }

  // Cursele pe ruta aleasă — public/trips răspunde cu calendar de curse.
  useEffect(() => {
    setTrips([]);
    setTripId("");
    setTripDetail(null);
    setSeatInfoMap({});
    setInspectedSeat(null);
    if (!originCityId || !destCityId) return;
    const ac = new AbortController();
    setTripsLoading(true);
    const params = new URLSearchParams({
      originCityId,
      destCityId,
      limit: "30",
    });
    fetch(`/api/public/trips?${params.toString()}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((d) => {
        if (d?.success) setTrips((d.trips ?? []) as TripRow[]);
      })
      .catch(() => setTrips([]))
      .finally(() => setTripsLoading(false));
    return () => ac.abort();
  }, [originCityId, destCityId]);

  // Detaliul cursei selectate: layout + locuri ocupate + identitate per loc.
  useEffect(() => {
    setTripDetail(null);
    setSeatInfoMap({});
    setUnassigned([]);
    setInspectedSeat(null);
    if (!tripId) return;
    const ac = new AbortController();
    setDetailLoading(true);
    Promise.all([
      fetch(`/api/public/trips/${tripId}`, { signal: ac.signal })
        .then((r) => r.json())
        .catch(() => null),
      fetch(`/api/admin/trips/${tripId}/seats`, { signal: ac.signal })
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
        if (seats?.success && Array.isArray(seats.unassigned)) {
          setUnassigned(seats.unassigned as UnassignedBooking[]);
        }
      })
      .finally(() => setDetailLoading(false));
    return () => ac.abort();
  }, [tripId]);

  return (
    <div>
      <PageHeader
        title="Schemă autocar"
        subtitle="Vezi locurile ocupate pe o cursă fără să faci rezervare"
        actions={
          <button
            onClick={() => {
              setTripDetail(null);
              setSeatInfoMap({});
              setInspectedSeat(null);
              if (tripId) {
                // re-trigger detail fetch by toggling
                const id = tripId;
                setTripId("");
                setTimeout(() => setTripId(id), 0);
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Reîmprospătează
          </button>
        }
      />

      {/* Selectori rută + cursă */}
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Plecare
            </div>
            <CountryCityPicker
              value={from}
              onChange={setFrom}
              locale={locale}
              hideCountries={fromHide}
            />
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Destinație
            </div>
            <CountryCityPicker
              value={to}
              onChange={setTo}
              locale={locale}
              hideCountries={toHide}
            />
          </div>
          <button
            type="button"
            onClick={swapDirection}
            aria-label="Inversează direcția"
            title="Inversează plecarea cu destinația"
            className="hidden sm:flex absolute left-1/2 top-1/2 z-10 h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md transition-all hover:scale-105 hover:border-orange-300 hover:text-orange-600"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </button>
        </div>

        {/* Buton swap pentru mobile (sub picker-e, cu lățime întreagă) */}
        <button
          type="button"
          onClick={swapDirection}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:hidden"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" /> Inversează plecarea cu destinația
        </button>

        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Cursa
          </span>
          <select
            value={tripId}
            onChange={(e) => setTripId(e.target.value)}
            disabled={!originCityId || !destCityId || tripsLoading || trips.length === 0}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-200 disabled:opacity-60"
          >
            <option value="">
              {!originCityId || !destCityId
                ? "Alege întâi plecarea și destinația"
                : tripsLoading
                  ? "Caut cursele…"
                  : trips.length === 0
                    ? "Nicio cursă programată pe această rută"
                    : "Alege cursă…"}
            </option>
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                {fullDateFmt.format(new Date(t.departureAt))} · {t.busLabel} · {t.availableSeats}/{t.totalSeats} libere
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Conținut principal */}
      {!tripId ? (
        <EmptyState
          icon={Armchair}
          title="Selectează o cursă"
          description="Alege plecarea și destinația, apoi cursa concretă. Vei vedea schema autocarului cu locurile ocupate. Click pe un loc ocupat pentru a vedea cine l-a rezervat."
        />
      ) : detailLoading || !tripDetail ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
              <BusIcon className="h-4 w-4 text-orange-500" />
              <span className="font-semibold text-slate-900">
                {fromCity(from)} → {fromCity(to)}
              </span>
              <span className="text-slate-300">·</span>
              <span>{trips.find((t) => t.id === tripId)?.busLabel ?? ""}</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-700">
                {tripDetail.occupiedSeats.length}/
                {trips.find((t) => t.id === tripId)?.totalSeats ?? "?"} locuri ocupate
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Click pe un loc ocupat pentru detalii pasager. Locurile libere sunt afișate doar
              informativ — această pagină nu permite rezervare directă.
            </p>
          </div>

          <BusSeatMap
            layout={tripDetail.layout}
            occupiedSeats={tripDetail.occupiedSeats}
            selected={[]}
            onSelect={() => {
              /* read-only — alegerea de locuri libere nu face nimic aici */
            }}
            max={0}
            onSeatInspect={(n) => setInspectedSeat(n)}
          />

          {inspectedSeat !== null && (
            <SeatDetailCard
              seatNumber={inspectedSeat}
              info={seatInfoMap[inspectedSeat] ?? null}
              onClose={() => setInspectedSeat(null)}
            />
          )}

          {/* Pasageri atașați la cursă dar fără SeatBooking asociat — pot apărea
              când o rezervare manuală a fost legată de cursă, dar admin n-a
              ales locurile concrete în modal. Îi listăm separat ca să nu fie
              invizibili pentru operator. */}
          {unassigned.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                Atașate la cursă, fără loc selectat ({unassigned.length})
              </div>
              <p className="mt-1 text-xs text-amber-900/80">
                Aceste rezervări sunt pe cursa selectată dar nu au un loc concret atribuit.
                Asigură-te că pasagerii vor încăpea în autocar.
              </p>
              <div className="mt-3 space-y-2">
                {unassigned.map((u) => (
                  <div
                    key={u.id}
                    className="rounded-xl bg-white border border-amber-200 p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-bold text-slate-900">
                          {u.passengerName || "(fără nume)"}
                          <span className="ml-2 text-[10px] uppercase font-semibold text-amber-700">
                            {u.type === "parcel" || u.type === "colet_la_cheie" ? "Colet" : `${u.paxCount} pax`}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-slate-600">
                          Rezervare <span className="font-mono">{u.bookingNumber}</span> ·{" "}
                          <span className="uppercase tracking-wider">{u.status}</span>
                        </div>
                        <div className="mt-1 text-xs text-slate-600">
                          <a href={`tel:${u.phone}`} className="text-orange-700 hover:underline">
                            {u.phone}
                          </a>
                          <span className="mx-1.5 text-slate-300">·</span>
                          <a href={`mailto:${u.email}`} className="text-orange-700 hover:underline">
                            {u.email}
                          </a>
                        </div>
                      </div>
                      <a
                        href={`/admin/bookings?search=${u.bookingNumber}`}
                        className="shrink-0 rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-orange-700 ring-1 ring-orange-200 hover:bg-orange-100"
                      >
                        Deschide →
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SeatDetailCard({
  seatNumber,
  info,
  onClose,
}: {
  seatNumber: number;
  info: SeatInfo | null;
  onClose: () => void;
}) {
  return (
    <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-orange-700">
            Loc {seatNumber}
          </div>
          {info ? (
            <div className="mt-2 space-y-1 text-sm">
              <div className="text-lg font-bold text-slate-900">
                {info.passengerName || "(fără nume)"}
              </div>
              <div className="text-slate-700">
                Rezervare <span className="font-mono font-semibold">{info.bookingNumber}</span> ·{" "}
                <span className="font-medium uppercase tracking-wider">{info.status}</span>
              </div>
              <div className="flex flex-wrap gap-2 text-sm text-slate-700">
                <a href={`tel:${info.phone}`} className="text-orange-700 hover:underline">
                  {info.phone}
                </a>
                <span className="text-slate-300">·</span>
                <a href={`mailto:${info.email}`} className="text-orange-700 hover:underline">
                  {info.email}
                </a>
              </div>
              <div className="pt-2">
                <a
                  href={`/admin/bookings?search=${info.bookingNumber}`}
                  className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-orange-700 ring-1 ring-orange-200 hover:bg-orange-100"
                >
                  Deschide rezervarea →
                </a>
              </div>
            </div>
          ) : (
            <div className="mt-2 text-sm text-slate-600">
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
