"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Loader2, Mail, Phone, Ticket, User, X } from "lucide-react";
import { TripPicker, type PublicTrip } from "@/components/booking/TripPicker";
import { displayPassengerNames } from "@/lib/passengerNames";
import type { OperatorBooking } from "@/components/operator/BookingsView";

// „Bilet retur": pentru un pasager deja înregistrat pe o direcție, operatorul îi
// face rezervarea ÎNAPOI fără să re-tasteze nimic — numele, telefonul, emailul
// și numărul de pasageri se copiază din rezervarea existentă, ruta se
// inversează automat, el alege doar data + locul. Se creează o rezervare NOUĂ
// (prin același POST /api/bookings ca formularul din panou → clientul primește
// email + bilet), legată de cea inițială printr-o notă.

type Done = { bookingNumber: string; ticketUrl: string | null };

function curr(c: string) {
  return c === "GBP" ? "£" : c === "EUR" ? "€" : c;
}

export function ReturnBookingModal({
  b,
  onClose,
  onReload,
}: {
  b: OperatorBooking;
  onClose: () => void;
  onReload: () => void;
}) {
  const [cities, setCities] = useState<Record<string, string> | null>(null);
  const [tripId, setTripId] = useState<string | null>(null);
  const [seats, setSeats] = useState<number[]>([]);
  const [trip, setTrip] = useState<PublicTrip | null>(null);
  const [payMethod, setPayMethod] = useState<"cash" | "card">("cash");
  const [customPrice, setCustomPrice] = useState("");
  const [note, setNote] = useState(`Retur al rezervării ${b.bookingNumber}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Același telefon are deja o rezervare în ziua aleasă (ex. clientul și-a
  // făcut singur returul pe site) — API-ul cere confirmare explicită.
  const [dup, setDup] = useState<{ bookingNumber: string | null; message: string } | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  const pax = Math.max(1, (b.adults || 0) + (b.children || 0));
  // Returul = ruta inversată.
  const fromCity = b.arrivalCity;
  const toCity = b.departureCity;

  useEffect(() => {
    fetch("/api/public/cities")
      .then((r) => r.json())
      .then((d) => {
        const idx: Record<string, string> = {};
        for (const c of [...(d?.origins ?? []), ...(d?.destinations ?? [])]) {
          idx[String(c.name).trim().toLowerCase()] = String(c.id);
        }
        setCities(idx);
      })
      .catch(() => setCities({}));
  }, []);

  const key = (v: string) => (v || "").split(",")[0].trim().toLowerCase();
  const originId = cities ? cities[key(fromCity)] ?? null : null;
  const destId = cities ? cities[key(toCity)] ?? null : null;

  const estimate = trip ? trip.pricePerSeat * pax : null;
  const canSubmit = !!tripId && seats.length === pax && !busy && !done;

  const submit = async (allowSamePhone = false) => {
    if (!tripId || !trip) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "passenger",
          tripType: "one-way",
          departureCity: fromCity,
          arrivalCity: toCity,
          departureDate: trip.departureAt,
          firstName: b.firstName,
          lastName: b.lastName,
          email: b.email || "",
          phone: b.phone,
          adults: b.adults || 1,
          children: b.children || 0,
          tripId,
          seatNumbers: seats,
          payMethod,
          customPrice: customPrice.trim() !== "" ? Number(customPrice) : undefined,
          note: note.trim() || undefined,
          allowSamePhone: allowSamePhone || undefined,
        }),
      });
      const d = await res.json();
      if (d?.success) {
        setDup(null);
        setDone({
          bookingNumber: String(d.booking?.bookingNumber ?? ""),
          ticketUrl: d.booking?.ticketUrl ?? null,
        });
        onReload();
      } else if (d?.duplicate?.canOverride) {
        setDup({ bookingNumber: d.duplicate?.bookingNumber ?? null, message: d.error || "Telefonul are deja o rezervare în ziua aleasă." });
      } else {
        setDup(null);
        setError(d?.error || "Eroare la crearea rezervării");
      }
    } catch {
      setError("Eroare de rețea. Încearcă din nou.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="text-base font-bold text-[color:var(--navy-900)]">Bilet retur</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-[color:var(--ink-500)] hover:bg-[color:var(--ink-50)]"
            aria-label="Închide"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Datele clientului — copiate, nu se re-tastează */}
        <div className="mb-3 rounded-xl bg-[color:var(--navy-50)] px-3 py-2.5 text-sm">
          <div className="flex min-w-0 items-center gap-1.5 font-bold text-[color:var(--navy-900)]">
            <span className="min-w-0 truncate">{fromCity}</span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[color:var(--red-500)]" />
            <span className="min-w-0 truncate">{toCity}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[color:var(--ink-700)]">
            <span className="inline-flex items-center gap-1">
              <User className="h-3.5 w-3.5 text-[color:var(--ink-400)]" />
              {displayPassengerNames(b.firstName, b.lastName)} · {pax} {pax === 1 ? "loc" : "locuri"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3.5 w-3.5 text-[color:var(--ink-400)]" /> {b.phone}
            </span>
            {b.email && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <Mail className="h-3.5 w-3.5 shrink-0 text-[color:var(--ink-400)]" />
                <span className="min-w-0 truncate">{b.email}</span>
              </span>
            )}
          </div>
          <div className="mt-1 text-[11px] text-[color:var(--ink-500)]">
            Datele sunt copiate din rezervarea {b.bookingNumber} — alegi doar data și locul.
          </div>
        </div>

        {done ? (
          <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <div className="font-bold">✓ Retur rezervat: {done.bookingNumber}</div>
            <div className="mt-0.5 text-xs">
              {b.email ? "Clientul primește emailul cu biletul." : "Clientul n-are email — dă-i biletul de mai jos."}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {done.ticketUrl && (
                <a
                  href={done.ticketUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 active:scale-95 transition-transform"
                >
                  <Ticket className="h-3.5 w-3.5" /> Bilet retur
                </a>
              )}
              <button
                onClick={onClose}
                className="rounded-full bg-[color:var(--navy-900)] px-3 py-1.5 text-xs font-semibold text-white active:scale-95 transition-transform"
              >
                Închide
              </button>
            </div>
          </div>
        ) : cities === null ? (
          <div className="flex items-center gap-2 py-6 text-sm text-[color:var(--ink-500)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Se încarcă…
          </div>
        ) : originId && destId ? (
          <>
            <TripPicker
              title="Alege data + locul returului"
              originCityId={originId}
              destCityId={destId}
              fromDate={b.departureDate}
              maxSeats={pax}
              selectedTripId={tripId}
              selectedSeats={seats}
              onSelect={(t, s, tr) => {
                setTripId(t);
                setSeats(s);
                // La schimbarea locului picker-ul nu retrimite cursa (tr = undefined)
                // — o păstrăm pe cea aleasă; o golim doar când se renunță la cursă.
                if (tr !== undefined) setTrip(tr);
                else if (!t) setTrip(null);
                setDup(null);
              }}
            />

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[color:var(--ink-400)]">Plata</div>
                <div className="flex gap-1.5">
                  {(["cash", "card"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPayMethod(m)}
                      className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                        payMethod === m
                          ? "bg-[color:var(--navy-900)] text-white"
                          : "border border-[color:var(--ink-200)] text-[color:var(--navy-900)]"
                      }`}
                    >
                      {m === "cash" ? "Cash la îmbarcare" : "Card la îmbarcare"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[color:var(--ink-400)]">
                  Preț personalizat (opțional)
                </div>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  placeholder={estimate != null ? `implicit ${Math.round(estimate)}${curr(trip?.currency ?? b.currency)}` : "suma de pe bilet"}
                  className="w-full rounded-lg border border-[color:var(--ink-200)] px-3 py-1.5 text-sm text-[color:var(--navy-900)] focus:border-[color:var(--navy-900)] focus:outline-none"
                />
              </div>
            </div>
            {estimate != null && trip && (
              <div className="mt-2 text-xs text-[color:var(--ink-500)]">
                Preț calculat: {pax} × {trip.pricePerSeat}{curr(trip.currency)} ={" "}
                <strong className="text-[color:var(--navy-900)]">
                  {customPrice.trim() !== "" ? Math.round(Number(customPrice)) : Math.round(estimate)}
                  {curr(trip.currency)}
                </strong>
                {customPrice.trim() !== "" && " (personalizat)"}
              </div>
            )}

            <div className="mt-3">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[color:var(--ink-400)]">Notă pe rezervare</div>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-lg border border-[color:var(--ink-200)] px-3 py-1.5 text-sm text-[color:var(--navy-900)] focus:border-[color:var(--navy-900)] focus:outline-none"
              />
            </div>

            {dup && (
              <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <div className="font-semibold">{dup.message}</div>
                {dup.bookingNumber && <div className="mt-0.5">Rezervarea existentă: {dup.bookingNumber}</div>}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => submit(true)}
                  className="mt-2 rounded-full bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white active:scale-95 transition-transform disabled:opacity-60"
                >
                  Creează oricum returul
                </button>
              </div>
            )}
            {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <button
              onClick={() => submit(false)}
              disabled={!canSubmit}
              className="mt-4 w-full rounded-full bg-[color:var(--red-500)] px-4 py-2.5 text-sm font-bold text-white active:scale-95 transition-transform disabled:opacity-50"
            >
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Se salvează…
                </span>
              ) : !tripId ? (
                "Alege data returului"
              ) : seats.length !== pax ? (
                `Alege ${pax} ${pax === 1 ? "loc" : "locuri"} (${seats.length}/${pax})`
              ) : (
                `Rezervă returul${b.email ? " (trimite email clientului)" : ""}`
              )}
            </button>
          </>
        ) : (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            Nu pot identifica automat orașele acestei rezervări („{fromCity}” → „{toCity}”). Fă returul din „Rezervare nouă”.
          </div>
        )}
      </div>
    </div>
  );
}
