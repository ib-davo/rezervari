"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Trash2, Undo2, X, Armchair } from "lucide-react";
import type { OperatorBooking } from "./BookingsView";
import { BusSeatMap } from "@/components/booking/BusSeatMap";
import type { BusLayout } from "@/lib/adminMock";

// Datele de locuri pe un segment (răspunsul /bookings/[id]/seats). Ocuparea e
// circuit-aware (vezi lib/operatorSeats) — identică cu harta din panou.
type Segment = {
  segment: "out" | "ret";
  tripId: string;
  busLabel: string | null;
  busPlate: string | null;
  layout: BusLayout | null;
  layoutSeats: number[];
  occupied: number[];
  mine: number[];
  capacity: number | null;
};

// Editare rezervare: anulare parțială (un pasager din grup renunță → îl scoți,
// îi eliberezi locul pe dus + retur), adresă liberă și preț. Numele pasagerilor
// sunt stocate ca liste unite cu ", " în firstName/lastName — le spargem la fel
// ca la afișarea biletului.
export function EditBookingModal({
  b,
  onClose,
  onSubmit,
}: {
  b: OperatorBooking;
  onClose: () => void;
  onSubmit: (patch: Record<string, unknown>) => Promise<boolean>;
}) {
  const initialPassengers = useMemo(() => {
    const firsts = b.firstName.split(",").map((s) => s.trim());
    const lasts = b.lastName.split(",").map((s) => s.trim());
    const n = Math.max(firsts.length, lasts.length, 1);
    return Array.from({ length: n }, (_, i) => ({
      first: firsts[i] ?? "",
      last: lasts[i] ?? "",
      removed: false,
    }));
  }, [b.firstName, b.lastName]);

  const [passengers, setPassengers] = useState(initialPassengers);
  const [freed, setFreed] = useState<Set<string>>(new Set()); // "tripId|seatNumber"
  const [depCity, setDepCity] = useState(b.departureCity);
  const [arrCity, setArrCity] = useState(b.arrivalCity);
  const [price, setPrice] = useState(String(b.price));
  const [currency, setCurrency] = useState(b.currency);
  const [phone, setPhone] = useState(b.phone);
  const [email, setEmail] = useState(b.email);
  const [depDate, setDepDate] = useState(b.departureDate.slice(0, 10));
  const [retDate, setRetDate] = useState(b.returnDate ? b.returnDate.slice(0, 10) : "");
  const [notes, setNotes] = useState(b.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Locuri (hartă): segmentele cu schema autocarului + ce e ocupat. Selecția pe
  // fiecare cursă (tripId → numere de loc) e editabilă din hartă.
  const [segments, setSegments] = useState<Segment[] | null>(null);
  const [seatSel, setSeatSel] = useState<Record<string, number[]>>({});
  const [seatsErr, setSeatsErr] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/operator/bookings/${b.id}/seats`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d?.success && Array.isArray(d.segments)) {
          setSegments(d.segments as Segment[]);
          const sel: Record<string, number[]> = {};
          for (const s of d.segments as Segment[]) sel[s.tripId] = [...s.mine].sort((a, b) => a - b);
          setSeatSel(sel);
        } else {
          setSeatsErr(true);
        }
      })
      .catch(() => alive && setSeatsErr(true));
    return () => {
      alive = false;
    };
  }, [b.id]);

  const isPassenger = b.type !== "parcel";
  const kept = passengers.filter((p) => !p.removed);
  const removedCount = passengers.length - kept.length;

  const outSeats = b.seatBookings.filter((s) => s.tripId === b.tripId);
  const retSeats = b.returnTripId ? b.seatBookings.filter((s) => s.tripId === b.returnTripId) : [];

  // Segmentele cu schema autocarului le edităm din hartă; restul rămân pe chip-uri.
  const mapSegs = useMemo(() => (segments ?? []).filter((s) => s.layout), [segments]);
  const mapTripIds = useMemo(() => new Set(mapSegs.map((s) => s.tripId)), [mapSegs]);
  // Câte locuri trebuie pe un segment: pasageri păstrați (colet = câte are acum).
  const requiredSeats = (seg: Segment) => (isPassenger ? kept.length : seg.mine.length);
  // Chip-uri de eliberat DOAR pentru cursele fără hartă (fallback).
  const chipOutSeats = outSeats.filter((s) => !mapTripIds.has(s.tripId));
  const chipRetSeats = retSeats.filter((s) => !mapTripIds.has(s.tripId));
  // Cât timp harta se încarcă și rezervarea are locuri, nu lăsăm salvarea (ai
  // putea scoate un pasager fără să poți încă potrivi locul rămas).
  const seatsLoading = segments === null && !seatsErr && (outSeats.length > 0 || retSeats.length > 0);

  const toggleSeat = (tripId: string, seatNumber: number) => {
    const key = `${tripId}|${seatNumber}`;
    setFreed((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Sugestie proporțională: prețul curent / pasageri × câți rămân. Calcul ieftin,
  // fără useMemo (kept e recreat la fiecare render — memoizarea nu s-ar păstra).
  const suggested =
    !isPassenger || passengers.length === 0
      ? null
      : Math.round((b.price / passengers.length) * kept.length);

  const save = async () => {
    setError(null);
    if (isPassenger && kept.length < 1) {
      setError("Trebuie să rămână cel puțin un pasager. Pentru anulare completă folosește „Anulează”.");
      return;
    }
    const priceNum = parseFloat(price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setError("Preț invalid.");
      return;
    }

    // Locuri din hartă. Trimitem `seats` doar pentru segmentele schimbate. Impunem
    // „câte un loc de fiecare pasager păstrat" DOAR când operatorul chiar atinge
    // locurile sau scoate un pasager — altfel o editare de preț n-ar trebui blocată
    // de o rezervare cu date vechi (locuri ≠ pasageri).
    const seats: { tripId: string; seatNumbers: number[] }[] = [];
    for (const seg of mapSegs) {
      const sel = (seatSel[seg.tripId] ?? []).slice().sort((a, c) => a - c);
      const mine = seg.mine.slice().sort((a, c) => a - c);
      const changed = sel.length !== mine.length || sel.some((n, i) => n !== mine[i]);
      const req = requiredSeats(seg);
      if ((changed || removedCount > 0) && sel.length !== req) {
        setError(`Selectează exact ${req} ${req === 1 ? "loc" : "locuri"} pe ${seg.segment === "out" ? "Dus" : "Retur"} (ai ales ${sel.length}).`);
        return;
      }
      if (changed) seats.push({ tripId: seg.tripId, seatNumbers: sel });
    }

    setSaving(true);
    const edit: Record<string, unknown> = {
      departureCity: depCity.trim(),
      arrivalCity: arrCity.trim(),
      price: priceNum,
      currency,
      phone: phone.trim(),
      email: email.trim(),
      notes: notes.trim(),
      departureDate: depDate,
      returnDate: retDate || null,
      // Eliberare doar pe cursele fără hartă (chip-uri); cele cu hartă merg prin `seats`.
      freeSeats: [...freed]
        .map((k) => {
          const i = k.lastIndexOf("|");
          return { tripId: k.slice(0, i), seatNumber: Number(k.slice(i + 1)) };
        })
        .filter((f) => !mapTripIds.has(f.tripId)),
      ...(seats.length ? { seats } : {}),
    };
    if (isPassenger) {
      edit.firstName = kept.map((p) => p.first).join(", ");
      edit.lastName = kept.map((p) => p.last).join(", ");
      edit.adults = kept.length;
    }
    const ok = await onSubmit({ edit });
    setSaving(false);
    if (ok) onClose();
    else setError("Nu s-a putut salva — verifică datele și încearcă din nou.");
  };

  const seatChip = (tripId: string, seatNumber: number) => {
    const key = `${tripId}|${seatNumber}`;
    const marked = freed.has(key);
    return (
      <button
        key={key}
        type="button"
        onClick={() => toggleSeat(tripId, seatNumber)}
        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
          marked
            ? "border-red-500 bg-red-500 text-white line-through"
            : "border-[color:var(--ink-200)] bg-white text-[color:var(--navy-900)] hover:border-red-400"
        }`}
        title={marked ? "Se eliberează la salvare" : "Apasă ca să eliberezi locul"}
      >
        {seatNumber}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-bold text-[color:var(--navy-900)]">
            Editează rezervarea <span className="font-mono text-sm text-[color:var(--ink-500)]">{b.bookingNumber}</span>
          </h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-[color:var(--ink-500)] hover:bg-[color:var(--ink-50)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        {isPassenger && (
          <div className="mt-4">
            <div className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--ink-500)]">
              Pasageri ({kept.length}/{passengers.length})
            </div>
            <div className="mt-2 space-y-1.5">
              {passengers.map((p, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${
                    p.removed ? "border-red-200 bg-red-50 opacity-70" : "border-[color:var(--ink-200)] bg-white"
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    <input
                      value={p.first}
                      disabled={p.removed}
                      placeholder="Prenume"
                      onChange={(e) => setPassengers((cur) => cur.map((x, j) => (j === i ? { ...x, first: e.target.value } : x)))}
                      className={`w-full min-w-0 rounded-lg border border-[color:var(--ink-200)] bg-white px-2.5 py-1.5 text-sm font-semibold text-[color:var(--navy-900)] focus:border-[color:var(--navy-500)] focus:outline-none disabled:bg-transparent ${p.removed ? "line-through opacity-60" : ""}`}
                    />
                    <input
                      value={p.last}
                      disabled={p.removed}
                      placeholder="Nume"
                      onChange={(e) => setPassengers((cur) => cur.map((x, j) => (j === i ? { ...x, last: e.target.value } : x)))}
                      className={`w-full min-w-0 rounded-lg border border-[color:var(--ink-200)] bg-white px-2.5 py-1.5 text-sm font-semibold text-[color:var(--navy-900)] focus:border-[color:var(--navy-500)] focus:outline-none disabled:bg-transparent ${p.removed ? "line-through opacity-60" : ""}`}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!p.removed && kept.length <= 1}
                    onClick={() =>
                      setPassengers((cur) => cur.map((x, j) => (j === i ? { ...x, removed: !x.removed } : x)))
                    }
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
                      p.removed ? "bg-[color:var(--ink-100)] text-[color:var(--navy-900)]" : "bg-red-50 text-red-600 hover:bg-red-100"
                    }`}
                  >
                    {p.removed ? (
                      <><Undo2 className="h-3.5 w-3.5" /> Păstrează</>
                    ) : (
                      <><Trash2 className="h-3.5 w-3.5" /> Anulează pasagerul</>
                    )}
                  </button>
                </div>
              ))}
            </div>
            {removedCount > 0 && (outSeats.length > 0 || retSeats.length > 0) && (
              <p className="mt-2 text-xs font-semibold text-amber-700">
                Ai scos {removedCount} pasager{removedCount > 1 ? "i" : ""} — potrivește locurile mai jos (câte un loc pentru fiecare pasager păstrat).
              </p>
            )}
          </div>
        )}

        {/* Se încarcă harta locurilor */}
        {seatsLoading && (
          <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-[color:var(--ink-500)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Se încarcă harta locurilor…
          </div>
        )}

        {/* Locuri — hartă: schimbi locul (vezi ce e liber) */}
        {mapSegs.map((seg) => {
          const sel = seatSel[seg.tripId] ?? [];
          const req = requiredSeats(seg);
          return (
            <div key={seg.tripId} className="mt-4">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[color:var(--ink-500)]">
                  <Armchair className="h-3.5 w-3.5" /> Locuri {seg.segment === "out" ? "dus" : "retur"}
                  {seg.busPlate ? ` · ${seg.busPlate}` : ""}
                </div>
                <div className={`text-xs font-bold ${sel.length === req ? "text-emerald-600" : "text-amber-600"}`}>
                  {sel.length}/{req} {req === 1 ? "loc" : "locuri"}
                </div>
              </div>
              <p className="mt-1 text-[11px] text-[color:var(--ink-500)]">
                Apasă un loc liber ca să-l alegi, pe cel roșu ca să-l eliberezi. Locurile ocupate de alți pasageri sunt blocate.
              </p>
              <div className="mt-2">
                <BusSeatMap
                  layout={seg.layout!}
                  occupiedSeats={seg.occupied}
                  selected={sel}
                  onSelect={(nums) => setSeatSel((cur) => ({ ...cur, [seg.tripId]: nums }))}
                  max={req}
                />
              </div>
            </div>
          );
        })}

        {/* Fallback: curse fără schemă → chip-uri de eliberare (ca înainte) */}
        {(seatsErr || segments !== null) && (chipOutSeats.length > 0 || chipRetSeats.length > 0) && (
          <div className="mt-4">
            <div className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--ink-500)]">
              Locuri (apasă ca să eliberezi)
            </div>
            {chipOutSeats.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-[color:var(--ink-500)]">Dus:</span>
                {chipOutSeats.map((s) => seatChip(s.tripId, s.seatNumber))}
              </div>
            )}
            {chipRetSeats.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-[color:var(--ink-500)]">Retur:</span>
                {chipRetSeats.map((s) => seatChip(s.tripId, s.seatNumber))}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 grid gap-2 md:grid-cols-2">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--ink-500)]">Plecare (text pe bilet)</span>
            <input
              value={depCity}
              onChange={(e) => setDepCity(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[color:var(--ink-300)] bg-white px-3 py-2 text-sm font-semibold text-[color:var(--navy-900)] focus:border-[color:var(--navy-500)] focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--ink-500)]">Destinație (text pe bilet)</span>
            <input
              value={arrCity}
              onChange={(e) => setArrCity(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[color:var(--ink-300)] bg-white px-3 py-2 text-sm font-semibold text-[color:var(--navy-900)] focus:border-[color:var(--navy-500)] focus:outline-none"
            />
          </label>
        </div>

        {/* Contact */}
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--ink-500)]">Telefon</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[color:var(--ink-300)] bg-white px-3 py-2 text-sm font-semibold text-[color:var(--navy-900)] focus:border-[color:var(--navy-500)] focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--ink-500)]">Email</span>
            <input
              value={email}
              type="email"
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[color:var(--ink-300)] bg-white px-3 py-2 text-sm font-semibold text-[color:var(--navy-900)] focus:border-[color:var(--navy-500)] focus:outline-none"
            />
          </label>
        </div>

        {/* Date — se schimbă doar ziua, ora cursei rămâne */}
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--ink-500)]">Data plecării</span>
            <input
              type="date"
              value={depDate}
              onChange={(e) => setDepDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[color:var(--ink-300)] bg-white px-3 py-2 text-sm font-semibold text-[color:var(--navy-900)] focus:border-[color:var(--navy-500)] focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--ink-500)]">Data retur (opțional)</span>
            <input
              type="date"
              value={retDate}
              onChange={(e) => setRetDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[color:var(--ink-300)] bg-white px-3 py-2 text-sm font-semibold text-[color:var(--navy-900)] focus:border-[color:var(--navy-500)] focus:outline-none"
            />
          </label>
        </div>

        <div className="mt-4">
          <span className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--ink-500)]">Preț & monedă</span>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-32 rounded-lg border border-[color:var(--ink-300)] bg-white px-3 py-2 text-base font-bold text-[color:var(--navy-900)] focus:border-[color:var(--navy-500)] focus:outline-none"
            />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="rounded-lg border border-[color:var(--ink-300)] bg-white px-2 py-2 text-sm font-bold text-[color:var(--navy-900)] focus:border-[color:var(--navy-500)] focus:outline-none"
            >
              <option value="EUR">€ EUR</option>
              <option value="GBP">£ GBP</option>
            </select>
            {suggested != null && suggested !== Math.round(parseFloat(price) || 0) && removedCount > 0 && (
              <button
                type="button"
                onClick={() => setPrice(String(suggested))}
                className="rounded-full bg-[color:var(--navy-50)] px-3 py-1.5 text-xs font-semibold text-[color:var(--navy-900)] hover:bg-[color:var(--navy-100,#dbe4f3)]"
              >
                Recalculează proporțional: {suggested}{currency === "GBP" ? "£" : "€"}
              </button>
            )}
          </div>
          <p className="mt-1 text-[11px] text-[color:var(--ink-500)]">
            Prețul nu se schimbă automat — ajustează-l cum te-ai înțeles cu clientul.
          </p>
        </div>

        <div className="mt-4">
          <span className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--ink-500)]">Notițe</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Observații interne (ex. loc la geam, sună înainte)…"
            className="mt-1 w-full resize-y rounded-lg border border-[color:var(--ink-300)] bg-white px-3 py-2 text-sm text-[color:var(--navy-900)] focus:border-[color:var(--navy-500)] focus:outline-none"
          />
        </div>

        {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</div>}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-semibold text-[color:var(--ink-500)] hover:bg-[color:var(--ink-50)]"
          >
            Renunță
          </button>
          <button
            onClick={save}
            disabled={saving || seatsLoading}
            className="inline-flex items-center gap-2 rounded-full bg-[color:var(--red-500)] px-5 py-2 text-sm font-semibold text-white hover:bg-[color:var(--red-600)] disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvează modificările
          </button>
        </div>
      </div>
    </div>
  );
}
