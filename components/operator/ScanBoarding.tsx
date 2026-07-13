"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Armchair, Check, Loader2, QrCode, RotateCcw, X } from "lucide-react";
import jsQR from "jsqr";
import { displayPassengerNames } from "@/lib/passengerNames";

// Scanner QR de îmbarcare: operatorul scanează QR-ul de pe bilet (encodează
// davo.md/bilet/DAVO-XXXX-XXXXXX), vede rezervarea + locurile, notează surplusul
// de bagaj (peste 35kg cală / 5kg mână), marchează plata și confirmă îmbarcarea.
// După confirmare, rezervarea apare „ÎMBARCAT" în panou pentru toți operatorii.

type ScanBooking = {
  id: string;
  bookingNumber: string;
  type: string;
  status: string;
  departureCity: string;
  arrivalCity: string;
  departureDate: string;
  firstName: string;
  lastName: string;
  phone: string;
  price: number;
  currency: string;
  paymentStatus: string;
  notes: string | null;
  boardedAt: string | null;
  boardedBy: string | null;
  baggageSurplus: string | null;
  tripId: string | null;
  returnTripId: string | null;
  seatBookings: { seatNumber: number; tripId: string }[];
  trip: { departureAt: string; bus: { label: string; plate: string | null } } | null;
};

const fmtDay = new Intl.DateTimeFormat("ro-RO", { weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export function ScanBoarding() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Scanează biletul (îmbarcare)"
        className="inline-flex items-center gap-2 rounded-full border border-[color:var(--ink-200)] px-3 py-2 text-sm font-semibold text-[color:var(--navy-900)] active:scale-95 transition-transform hover:border-[color:var(--red-500)]"
      >
        <QrCode className="h-4 w-4 text-[color:var(--red-500)]" />
        <span className="hidden sm:inline">Scan</span>
      </button>
      {/* Portal în <body>: butonul stă în header (sticky, z-30) — randat acolo,
          modalul ar fi prizonier în contextul de stacking al header-ului și
          pagina s-ar desena PESTE el. */}
      {open && typeof document !== "undefined" && createPortal(<ScanModal onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function ScanModal({ onClose }: { onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<ScanBooking | null>(null);
  const [surplus, setSurplus] = useState(false);
  const [surplusKg, setSurplusKg] = useState("");
  const [surplusNote, setSurplusNote] = useState("");
  const [markPaid, setMarkPaid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const lookup = useCallback(async (text: string) => {
    const m = text.toUpperCase().match(/DAVO-\d{4}-[A-Z0-9]+/);
    if (!m) return false;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/operator/scan?nr=${encodeURIComponent(m[0])}`, { cache: "no-store" });
      const d = await res.json();
      if (!d?.success) {
        setError(d?.error || "Bilet negăsit");
        return false;
      }
      const b: ScanBooking = d.booking;
      setBooking(b);
      setSurplus(!!b.baggageSurplus);
      setSurplusKg("");
      setSurplusNote(b.baggageSurplus ?? "");
      setMarkPaid(false);
      setDone(false);
      return true;
    } catch {
      setError("Eroare de rețea");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Camera + buclă de decodare QR (jsQR pe canvas — merge pe orice telefon).
  useEffect(() => {
    if (booking) return; // în ecranul de detalii camera e oprită
    let cancelled = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        // QR care a eșuat deja (bilet inexistent) — nu-l re-căutăm în buclă.
        let lastFailedCode = "";
        let busy = false;
        const tick = async () => {
          if (cancelled || !videoRef.current || !ctx) return;
          const v = videoRef.current;
          if (!busy && v.readyState === v.HAVE_ENOUGH_DATA) {
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
            ctx.drawImage(v, 0, 0);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
            if (code?.data && code.data !== lastFailedCode && /DAVO-\d{4}-[A-Z0-9]+/i.test(code.data)) {
              // Oprim camera DOAR după un lookup reușit — altfel continuăm scanarea
              // live (biletul poate fi greșit/inexistent, se arată eroarea o dată).
              busy = true;
              const ok = await lookup(code.data);
              busy = false;
              if (ok) { stopCamera(); return; }
              lastFailedCode = code.data;
            }
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        if (!cancelled) setCameraError("Camera nu e disponibilă — introdu numărul biletului mai jos.");
      }
    })();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [booking, lookup, stopCamera]);

  // Surplus: kg în plus × 1.5 în valuta cursei (GBP pe rutele Anglia, EUR altfel).
  const sym = booking?.currency === "GBP" ? "£" : "€";
  const surplusPrice = (() => {
    const kg = parseFloat(surplusKg);
    if (!Number.isFinite(kg) || kg <= 0) return null;
    return Math.round(kg * 1.5 * 100) / 100;
  })();

  const confirmBoarding = async () => {
    if (!booking) return;
    setSaving(true);
    setError(null);
    const kg = parseFloat(surplusKg);
    const surplusText = surplus
      ? [
          Number.isFinite(kg) && kg > 0 ? `+${kg} kg · ${surplusPrice}${sym}` : "peste limită",
          surplusNote.trim() || null,
        ].filter(Boolean).join(" · ")
      : null;
    try {
      const res = await fetch(`/api/operator/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          board: {
            boarded: true,
            baggageSurplus: surplusText,
            markPaid,
          },
        }),
      });
      const d = await res.json();
      if (!d?.success) { setError(d?.error || "Nu s-a putut confirma"); return; }
      setDone(true);
    } catch {
      setError("Eroare de rețea");
    } finally {
      setSaving(false);
    }
  };

  const unboard = async () => {
    if (!booking) return;
    setSaving(true);
    try {
      await fetch(`/api/operator/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board: { boarded: false } }),
      });
      setBooking({ ...booking, boardedAt: null, boardedBy: null });
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setBooking(null);
    setDone(false);
    setError(null);
    setManual("");
    setSurplus(false);
    setSurplusKg("");
    setSurplusNote("");
    setMarkPaid(false);
  };

  const outSeats = booking ? booking.seatBookings.filter((s) => s.tripId === booking.tripId).map((s) => s.seatNumber) : [];
  const retSeats = booking?.returnTripId
    ? booking.seatBookings.filter((s) => s.tripId === booking.returnTripId).map((s) => s.seatNumber)
    : [];

  return (
    // overflow pe overlay + min-h-full pe wrapper: modalul stă centrat când e
    // scurt și derulează FĂRĂ să-i taie partea de sus când e mai înalt ca ecranul.
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60" onClick={() => { stopCamera(); onClose(); }}>
      <div className="flex min-h-full items-center justify-center p-4">
      <div
        className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="inline-flex items-center gap-2 text-base font-bold text-[color:var(--navy-900)]">
            <QrCode className="h-4 w-4 text-[color:var(--red-500)]" /> Îmbarcare
          </h3>
          <button onClick={() => { stopCamera(); onClose(); }} className="rounded-full p-1.5 text-[color:var(--ink-500)] hover:bg-[color:var(--ink-50)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!booking && (
          <div className="mt-3">
            {!cameraError ? (
              <div className="overflow-hidden rounded-xl bg-black">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video ref={videoRef} playsInline muted className="h-64 w-full object-cover" />
              </div>
            ) : (
              <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{cameraError}</div>
            )}
            <p className="mt-2 text-center text-xs text-[color:var(--ink-500)]">
              Îndreaptă camera spre QR-ul de pe bilet
            </p>
            <form
              className="mt-3 flex items-center gap-2"
              onSubmit={(e) => { e.preventDefault(); void lookup(manual); }}
            >
              <input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="sau scrie: DAVO-2026-XXXXXX"
                className="min-w-0 flex-1 rounded-lg border border-[color:var(--ink-300)] px-3 py-2 text-sm font-semibold uppercase text-[color:var(--navy-900)] focus:border-[color:var(--navy-500)] focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color:var(--navy-900)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Caută"}
              </button>
            </form>
            {error && <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</div>}
          </div>
        )}

        {booking && !done && (
          <div className="mt-3">
            <div className={`rounded-xl border p-3 ${booking.status === "cancelled" ? "border-red-300 bg-red-50" : "border-[color:var(--ink-200)] bg-[color:var(--ink-50)]"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-[color:var(--navy-900)]">
                    {displayPassengerNames(booking.firstName, booking.lastName)}
                  </div>
                  <div className="mt-0.5 text-xs font-semibold text-[color:var(--navy-700)]">
                    {booking.departureCity} → {booking.arrivalCity}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[color:var(--ink-500)]">
                    {fmtDay.format(new Date(booking.trip?.departureAt ?? booking.departureDate))}
                    {booking.trip?.bus ? ` · ${booking.trip.bus.label}${booking.trip.bus.plate ? ` · ${booking.trip.bus.plate}` : ""}` : ""}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-semibold text-[color:var(--navy-900)]">
                    {outSeats.length > 0 && (
                      <span className="inline-flex items-center gap-1"><Armchair className="h-3.5 w-3.5 text-[color:var(--ink-400)]" /> Dus: {outSeats.join(", ")}</span>
                    )}
                    {retSeats.length > 0 && <span>Retur: {retSeats.join(", ")}</span>}
                  </div>
                  {booking.notes && <div className="mt-1 text-[11px] italic text-[color:var(--ink-700)]">📝 {booking.notes}</div>}
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-[11px] text-[color:var(--ink-500)]">{booking.bookingNumber}</div>
                  <div className="text-lg font-extrabold text-[color:var(--navy-900)]">{booking.price}{booking.currency === "GBP" ? "£" : "€"}</div>
                  <div className={`text-[11px] font-bold ${booking.paymentStatus === "paid" ? "text-emerald-600" : "text-red-600"}`}>
                    {booking.paymentStatus === "paid" ? "achitat" : "NEACHITAT"}
                  </div>
                </div>
              </div>
              {booking.status === "cancelled" && (
                <div className="mt-2 rounded-lg bg-red-600 px-3 py-1.5 text-center text-sm font-extrabold uppercase text-white">Rezervare anulată — NU se îmbarcă</div>
              )}
              {booking.boardedAt && (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-extrabold uppercase text-white">
                  <span>✓ Deja îmbarcat{booking.boardedBy ? ` · ${booking.boardedBy}` : ""}</span>
                  <button onClick={unboard} disabled={saving} className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold normal-case hover:bg-white/30">
                    anulează
                  </button>
                </div>
              )}
            </div>

            {booking.status !== "cancelled" && !booking.boardedAt && (
              <div className="mt-3 space-y-2">
                <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-[color:var(--ink-200)] p-3">
                  <input type="checkbox" checked={surplus} onChange={(e) => setSurplus(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[color:var(--red-500)]" />
                  <span className="text-sm font-semibold text-[color:var(--navy-900)]">
                    Surplus bagaj
                    <span className="block text-[11px] font-normal text-[color:var(--ink-500)]">peste 35kg cală / 5kg bagaj de mână</span>
                  </span>
                </label>
                {surplus && (
                  <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.5"
                        value={surplusKg}
                        onChange={(e) => setSurplusKg(e.target.value)}
                        placeholder="kg în plus"
                        className="w-28 rounded-lg border border-[color:var(--ink-300)] bg-white px-3 py-2 text-base font-bold text-[color:var(--navy-900)] focus:border-[color:var(--navy-500)] focus:outline-none"
                      />
                      <span className="text-sm font-semibold text-[color:var(--ink-700)]">kg</span>
                      {surplusPrice != null && (
                        <span className="ml-auto rounded-full bg-white px-3 py-1 text-sm font-extrabold text-[color:var(--navy-900)]">
                          = {surplusPrice}{sym}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-semibold text-amber-700">1.5{sym}/kg peste limită</div>
                    <input
                      value={surplusNote}
                      onChange={(e) => setSurplusNote(e.target.value)}
                      placeholder="notă (opțional): achitat cash / de achitat la destinație"
                      className="w-full rounded-lg border border-[color:var(--ink-300)] bg-white px-3 py-2 text-sm font-semibold text-[color:var(--navy-900)] focus:border-[color:var(--navy-500)] focus:outline-none"
                    />
                  </div>
                )}
                {booking.paymentStatus !== "paid" && (
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[color:var(--ink-200)] p-3">
                    <input type="checkbox" checked={markPaid} onChange={(e) => setMarkPaid(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
                    <span className="text-sm font-semibold text-[color:var(--navy-900)]">S-a făcut achitarea acum</span>
                  </label>
                )}
                {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</div>}
                <button
                  onClick={confirmBoarding}
                  disabled={saving}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-base font-extrabold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                  Confirmă îmbarcarea
                </button>
              </div>
            )}

            <button onClick={reset} className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-full px-3 py-2 text-sm font-semibold text-[color:var(--ink-500)] hover:bg-[color:var(--ink-50)]">
              <RotateCcw className="h-4 w-4" /> Scanează alt bilet
            </button>
          </div>
        )}

        {booking && done && (
          <div className="mt-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600">✓</div>
            <div className="mt-2 text-lg font-extrabold uppercase tracking-wide text-emerald-600">Îmbarcat</div>
            <div className="mt-1 text-sm font-semibold text-[color:var(--navy-900)]">
              {displayPassengerNames(booking.firstName, booking.lastName)}
              {outSeats.length > 0 ? ` · loc ${outSeats.join(", ")}` : ""}
            </div>
            <button
              onClick={reset}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-[color:var(--navy-900)] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"
            >
              <QrCode className="h-4 w-4" /> Scanează următorul
            </button>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
