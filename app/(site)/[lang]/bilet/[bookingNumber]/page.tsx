"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Printer,
  Download,
  MapPin,
  Calendar,
  User,
  Phone,
  Mail,
  Check,
  Clock,
  AlertCircle,
  ArrowLeft,
  Share2,
  CheckCircle2,
  XCircle,
  Bus as BusIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { contactInfo } from "@/lib/data";

interface Booking {
  id: string;
  bookingNumber: string;
  type: string;
  status: string;
  tripType: string;
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
  payMethod?: string | null;
  passengerResponse?: string | null;
  parcelDetails?: string | null;
  createdAt: string;
  outboundSeats?: number[];
  returnSeats?: number[];
  // Ora literală din programul țării (Anglia DUS 07:00 etc.). Când e setată,
  // o afișăm ca atare ca să nu depindem de fusul orar al browser-ului.
  departureTime?: string | null;
  returnTime?: string | null;
  // Autocarul atașat la cursa rezervată (label + nr. înmatriculare). Apare
  // pe bilet ca să poată să-l identifice la îmbarcare.
  trip?: { bus?: { label?: string | null; plate?: string | null } | null } | null;
}

function parseManualDetails(parcelDetails: string | null | undefined): {
  originAddress?: string;
  destinationAddress?: string;
  notes?: string;
} {
  if (!parcelDetails) return {};
  try {
    const d = JSON.parse(parcelDetails);
    if (d && d.manual) {
      return {
        originAddress: typeof d.originAddress === "string" ? d.originAddress : undefined,
        destinationAddress: typeof d.destinationAddress === "string" ? d.destinationAddress : undefined,
        notes: typeof d.notes === "string" ? d.notes : undefined,
      };
    }
  } catch {
    // not JSON — colete vechi cu detalii ca text liber; nu e cazul nostru
  }
  return {};
}

// Numele pasagerilor sunt salvate concatenat în firstName/lastName separate prin
// ", " (vezi rezervare/page.tsx → submit). Le re-spargem aici ca să le afișăm
// frumos. Dacă nu sunt virgule, e o singură persoană — comportament istoric.
function splitPassengers(firstName: string, lastName: string): { firstName: string; lastName: string }[] {
  const firsts = firstName.split(",").map((s) => s.trim()).filter(Boolean);
  const lasts = lastName.split(",").map((s) => s.trim()).filter(Boolean);
  const n = Math.max(firsts.length, lasts.length, 1);
  return Array.from({ length: n }, (_, i) => ({
    firstName: firsts[i] ?? firsts[0] ?? "",
    lastName: lasts[i] ?? lasts[0] ?? "",
  }));
}

const STATUS_LABELS: Record<string, { label: string; tone: "ok" | "warn" | "bad" }> = {
  confirmed: { label: "Confirmat", tone: "ok" },
  pending: { label: "În așteptare", tone: "warn" },
  cancelled: { label: "Anulat", tone: "bad" },
  in_transit: { label: "În tranzit", tone: "ok" },
  delivered: { label: "Livrat", tone: "ok" },
};

export default function TicketPage() {
  const params = useParams();
  const search = useSearchParams();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const printedRef = useRef(false);

  const bookingNumber = params.bookingNumber as string;
  const isPrintMode = search.get("print") === "1" || search.get("download") === "1";

  useEffect(() => {
    const ac = new AbortController();
    fetch(`/api/bookings/${bookingNumber}`, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Not found"))))
      .then((data) => setBooking(data.booking))
      .catch((e) => {
        if (e.name !== "AbortError") setError("Rezervarea nu a fost găsită");
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [bookingNumber]);

  // Auto-print când URL conține ?print=1 — dă utilizatorului dialogul "Save as PDF"
  useEffect(() => {
    if (!isPrintMode || !booking || printedRef.current) return;
    printedRef.current = true;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [isPrintMode, booking]);

  const handlePrint = () => window.print();

  const handleDownload = () => {
    // Deschide aceeași pagină în tab nou cu print=1 → user salvează ca PDF
    window.open(`/bilet/${bookingNumber}?print=1`, "_blank", "noopener");
  };

  const handleShare = async () => {
    const url = window.location.href.split("?")[0];
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Bilet DAVO — ${bookingNumber}`,
          text: `Biletul meu DAVO: ${booking?.departureCity} → ${booking?.arrivalCity}`,
          url,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        alert("Link copiat în clipboard!");
      } catch {
        alert(url);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-[color:var(--ink-50)]">
        <div className="text-center">
          <div className="w-14 h-14 border-4 border-[color:var(--red-500)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[color:var(--ink-700)]">Se încarcă biletul...</p>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-[color:var(--ink-50)] p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl p-8 text-center max-w-md border border-[color:var(--ink-200)] shadow-[0_30px_60px_-30px_rgba(11,38,83,0.25)]"
        >
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            <AlertCircle className="h-8 w-8 text-[color:var(--red-500)]" />
          </div>
          <h1 className="font-[family-name:var(--font-montserrat)] text-2xl font-extrabold text-[color:var(--navy-900)] mb-3">
            Bilet negăsit
          </h1>
          <p className="text-[color:var(--ink-700)] mb-6">
            Nu am găsit biletul cu numărul <span className="font-mono font-bold">{bookingNumber}</span>. Verifică numărul rezervării din emailul de confirmare.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/livrare">
              <Button variant="primary">Caută rezervare</Button>
            </Link>
            <Link href="/">
              <Button variant="outline">Acasă</Button>
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  const departureDate = new Date(booking.departureDate);
  const returnDate = booking.returnDate ? new Date(booking.returnDate) : null;
  const created = new Date(booking.createdAt);
  const isParcel = booking.type === "parcel" || booking.type === "colet_la_cheie";
  const status = STATUS_LABELS[booking.status] ?? { label: booking.status, tone: "warn" as const };
  const isCancelled = status.tone === "bad" || booking.passengerResponse === "cancelled";
  const manualDetails = parseManualDetails(booking.parcelDetails);
  // Datele sunt stocate UTC; clientul poate deschide biletul din UK/DE/etc —
  // forțăm ora Moldovei ca să corespundă cu ce a fost programat în admin.
  const dateFmt = new Intl.DateTimeFormat("ro-RO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Chisinau",
  });
  const timeFmt = new Intl.DateTimeFormat("ro-RO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Chisinau",
  });

  return (
    <div className="min-h-screen bg-[color:var(--ink-50)] py-8 px-4 print:bg-white print:py-0">
      <div className="max-w-2xl mx-auto">
        {/* Back */}
        <div className="no-print mb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-[color:var(--ink-700)] hover:text-[color:var(--navy-900)] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Înapoi
          </Link>
        </div>

        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="ticket-print bg-white rounded-3xl shadow-[0_40px_100px_-40px_rgba(11,38,83,0.35)] overflow-hidden print:shadow-none print:rounded-lg border border-[color:var(--ink-200)] print:border print:border-[color:var(--ink-200)]"
        >
          {/* Header navy + bg-noise */}
          <header className="relative overflow-hidden bg-[color:var(--navy-900)] bg-hero-navy text-white p-7 print:p-6 print:bg-[#0b2653]">
            <div className="bg-noise absolute inset-0 opacity-30 print:hidden" />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-[color:var(--red-400)]">
                  DAVO Group · {isParcel ? "Confirmare colet" : "Bilet electronic"}
                </div>
                <div className="mt-2 font-[family-name:var(--font-montserrat)] text-2xl font-extrabold leading-tight">
                  {booking.departureCity} <span className="text-[color:var(--red-400)]">→</span>{" "}
                  {booking.arrivalCity}
                </div>
              </div>
              <div className="shrink-0 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 px-3 py-2 text-center">
                <div className="text-[9px] uppercase tracking-widest font-bold text-white/55">DAVO</div>
                <div className="font-[family-name:var(--font-montserrat)] text-2xl font-extrabold leading-none">D</div>
              </div>
            </div>
          </header>

          {/* Status */}
          <div className="px-7 pt-6 pb-2 print:pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span
                className={
                  "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider " +
                  (status.tone === "ok"
                    ? "bg-[color:var(--success-soft)] text-[color:var(--success)]"
                    : status.tone === "bad"
                      ? "bg-red-50 text-[color:var(--red-600)]"
                      : "bg-amber-50 text-amber-700")
                }
              >
                {isCancelled ? <XCircle className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                {status.label}
              </span>

              {booking.passengerResponse === "confirmed" && !isCancelled && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--success)]">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Pasager confirmat că vine
                </span>
              )}
            </div>
          </div>

          {/* Booking number */}
          <div className="px-7 py-5 text-center border-b border-[color:var(--ink-100)]">
            <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-[color:var(--ink-500)]">
              Număr rezervare
            </div>
            <div className="mt-1 font-mono font-extrabold text-[color:var(--navy-900)] text-2xl tracking-widest">
              {booking.bookingNumber}
            </div>
            <div className="mt-1 text-[11px] text-[color:var(--ink-500)]">
              Emis {created.toLocaleDateString("ro-RO", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Chisinau" })}
            </div>
          </div>

          {/* Route visual */}
          <div className="px-7 py-6 print:py-4">
            <div className="grid grid-cols-[1fr,auto,1fr] items-start gap-4">
              <div className="text-center">
                <div className="text-[10px] uppercase tracking-widest font-bold text-[color:var(--ink-500)]">
                  Plecare
                </div>
                <div className="mt-1 font-[family-name:var(--font-montserrat)] text-xl font-extrabold text-[color:var(--navy-900)] break-words">
                  {booking.departureCity}
                </div>
                {manualDetails.originAddress && (
                  <div className="mt-1.5 text-xs font-medium text-[color:var(--ink-700)] break-words">
                    {manualDetails.originAddress}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-center text-[color:var(--red-500)] pt-3">
                <div className="h-px w-12 bg-[color:var(--red-200,rgba(225,30,43,0.25))]" />
                <div className="my-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--red-50)] text-[color:var(--red-500)]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="h-px w-12 bg-[color:var(--red-200,rgba(225,30,43,0.25))]" />
              </div>
              <div className="text-center">
                <div className="text-[10px] uppercase tracking-widest font-bold text-[color:var(--ink-500)]">
                  Sosire
                </div>
                <div className="mt-1 font-[family-name:var(--font-montserrat)] text-xl font-extrabold text-[color:var(--navy-900)] break-words">
                  {booking.arrivalCity}
                </div>
                {manualDetails.destinationAddress && (
                  <div className="mt-1.5 text-xs font-medium text-[color:var(--ink-700)] break-words">
                    {manualDetails.destinationAddress}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Details grid */}
          <div className="px-7 pb-6 grid grid-cols-2 gap-3 print:gap-2">
            <DetailCell icon={<Calendar className="h-3.5 w-3.5" />} label="Data plecării">
              {dateFmt.format(departureDate)}
              {/* Coletele NU au oră fixă (admin sună expeditorul pentru grafic).
                  Le păstrăm doar ca dată — altfel afișează "03:00" doar pentru
                  că `new Date("YYYY-MM-DD")` e UTC midnight = 03:00 Chișinău. */}
              {!isParcel && (
                <span className="ml-1 text-[color:var(--ink-700)] font-medium">· {booking.departureTime ?? timeFmt.format(departureDate)}</span>
              )}
            </DetailCell>
            {returnDate && (
              <DetailCell icon={<Calendar className="h-3.5 w-3.5" />} label="Data întoarcerii">
                {dateFmt.format(returnDate)}
                {!isParcel && (
                  <span className="ml-1 text-[color:var(--ink-700)] font-medium">· {booking.returnTime ?? timeFmt.format(returnDate)}</span>
                )}
              </DetailCell>
            )}
            <DetailCell icon={<User className="h-3.5 w-3.5" />} label={isParcel ? "Tip" : "Pasageri"}>
              {isParcel
                ? booking.type === "colet_la_cheie"
                  ? "Colet la cheie"
                  : "Colet"
                : `${booking.adults} ${booking.adults === 1 ? "adult" : "adulți"}${booking.children > 0 ? `, ${booking.children} ${booking.children === 1 ? "copil" : "copii"}` : ""}`}
            </DetailCell>
            <DetailCell icon={<Clock className="h-3.5 w-3.5" />} label="Direcție">
              {booking.tripType === "round-trip" ? "Tur-retur" : "O direcție"}
            </DetailCell>
            {booking.trip?.bus?.label && (
              <DetailCell icon={<BusIcon className="h-3.5 w-3.5" />} label="Autocar">
                {booking.trip.bus.label}
                {booking.trip.bus.plate && (
                  <span className="ml-1.5 font-mono text-xs text-[color:var(--ink-500)]">
                    · {booking.trip.bus.plate}
                  </span>
                )}
              </DetailCell>
            )}
            {!isParcel && booking.outboundSeats && booking.outboundSeats.length > 0 && (
              <DetailCell icon={<User className="h-3.5 w-3.5" />} label="Locuri dus">
                {booking.outboundSeats.join(", ")}
              </DetailCell>
            )}
            {!isParcel && booking.returnSeats && booking.returnSeats.length > 0 && (
              <DetailCell icon={<User className="h-3.5 w-3.5" />} label="Locuri retur">
                {booking.returnSeats.join(", ")}
              </DetailCell>
            )}
          </div>

          {/* Passenger info */}
          <div className="px-7 pb-6 border-t border-[color:var(--ink-100)] pt-5">
            <div className="text-[10px] uppercase tracking-widest font-bold text-[color:var(--ink-500)] mb-3">
              {isParcel ? "Date expeditor" : booking.adults > 1 ? "Pasageri" : "Date pasager"}
            </div>
            <div className="grid gap-2 text-sm">
              {!isParcel ? (
                splitPassengers(booking.firstName, booking.lastName).map((p, i, arr) => (
                  <div key={`${p.firstName}-${i}`} className="flex items-center gap-2 text-[color:var(--navy-900)]">
                    <User className="h-3.5 w-3.5 text-[color:var(--red-500)]" />
                    <span className="font-semibold">
                      {p.firstName} {p.lastName}
                    </span>
                    {arr.length > 1 && booking.outboundSeats && booking.outboundSeats[i] && (
                      <span className="text-[color:var(--ink-500)] text-xs font-mono">
                        · loc {booking.outboundSeats[i]}
                        {booking.returnSeats && booking.returnSeats[i] ? ` / retur ${booking.returnSeats[i]}` : ""}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-2 text-[color:var(--navy-900)]">
                  <User className="h-3.5 w-3.5 text-[color:var(--red-500)]" />
                  <span className="font-semibold">
                    {booking.firstName} {booking.lastName}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-[color:var(--ink-700)]">
                <Phone className="h-3.5 w-3.5 text-[color:var(--red-500)]" />
                {booking.phone}
              </div>
              <div className="flex items-center gap-2 text-[color:var(--ink-700)]">
                <Mail className="h-3.5 w-3.5 text-[color:var(--red-500)]" />
                {booking.email}
              </div>
            </div>
          </div>

          {manualDetails.notes && (
            <div className="px-7 pb-6 border-t border-[color:var(--ink-100)] pt-5">
              <div className="text-[10px] uppercase tracking-widest font-bold text-[color:var(--ink-500)] mb-2">
                Notițe
              </div>
              <div className="text-sm text-[color:var(--navy-900)] whitespace-pre-wrap break-words">
                {manualDetails.notes}
              </div>
            </div>
          )}

          {/* Price + QR — navy band */}
          <div className="bg-[color:var(--navy-900)] bg-hero-navy text-white p-7 relative overflow-hidden print:bg-[#0b2653]">
            <div className="bg-noise absolute inset-0 opacity-30 print:hidden" />
            <div className="relative flex items-center justify-between gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-[color:var(--red-400)]">
                  Preț total
                </div>
                <div className="mt-1 font-[family-name:var(--font-montserrat)] text-3xl font-extrabold">
                  {booking.price} {booking.currency}
                </div>
                {booking.payMethod && (
                  <div className="mt-2 text-xs text-white/70">
                    {booking.payMethod === "cash_on_pickup"
                      ? "Plată cash la îmbarcare/livrare"
                      : booking.payMethod === "card_on_pickup"
                        ? "Plată cu cardul la îmbarcare/livrare"
                        : booking.payMethod === "cash_on_delivery"
                          ? "Plată cash la livrare"
                          : booking.payMethod}
                  </div>
                )}
              </div>
              <div className="shrink-0 h-24 w-24 rounded-xl bg-white p-2 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/tickets/${booking.bookingNumber}/qr.png`}
                  alt="Cod QR pentru verificare"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer className="p-7 bg-[color:var(--ink-50)] text-sm text-[color:var(--ink-700)] print:bg-[#f5f7fb]">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-[color:var(--red-500)] mt-0.5 shrink-0" />
              <span>{contactInfo.address}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <Phone className="h-4 w-4 text-[color:var(--red-500)]" />
              <span>{contactInfo.phone}</span>
              <span className="text-[color:var(--ink-300,rgba(11,38,83,0.18))]">·</span>
              <Mail className="h-4 w-4 text-[color:var(--red-500)]" />
              <span>{contactInfo.email}</span>
            </div>
          </footer>
        </motion.article>

        {/* Actions */}
        <div className="no-print mt-6 flex flex-wrap gap-3 justify-center">
          <Button onClick={handlePrint} variant="primary">
            <Printer className="h-4 w-4" />
            Tipărește
          </Button>
          <Button onClick={handleDownload} variant="secondary">
            <Download className="h-4 w-4" />
            Descarcă PDF
          </Button>
          <Button onClick={handleShare} variant="outline">
            <Share2 className="h-4 w-4" />
            Distribuie
          </Button>
        </div>

        {/* Reminders — text diferit pentru pasager vs. colet. Coletele sunt
            ridicate/livrate de șofer, nu cer pașaport, n-au bagaj sau facilități. */}
        <div className="no-print mt-6 rounded-2xl border border-[color:var(--navy-200,rgba(20,58,122,0.18))] bg-[color:var(--navy-50)] p-5 text-sm text-[color:var(--navy-900)]">
          <div className="font-[family-name:var(--font-montserrat)] font-bold mb-2">
            Informații importante
          </div>
          <ul className="space-y-1 text-[color:var(--ink-700)]">
            {isParcel ? (
              <>
                <li>• Coletul pleacă cu cursa de pasageri — același autocar, aceeași dată.</li>
                <li>• Te sunăm cu o zi înainte pentru a confirma locul de predare.</li>
                <li>• Pentru modificări sau anulări: {contactInfo.phone}.</li>
              </>
            ) : (
              <>
                <li>• Ajunge la îmbarcare cu 30 de minute înainte.</li>
                <li>• Ai nevoie de act de identitate / pașaport valabil.</li>
                <li>• Pentru modificări sau anulări: {contactInfo.phone}.</li>
                <li>• Bagaj gratuit inclus: 35 kg.</li>
                <li>• La bord: Internet Starlink, prânz, ceai/cafea naturală, însoțitoare 24/24.</li>
              </>
            )}
          </ul>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          html,
          body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            size: A4 portrait;
            margin: 0.4cm;
          }

          /* HARD COMPRESSION — guarantees ticket fits one A4 page in Chrome/Safari */
          .ticket-print {
            zoom: 0.78;
            page-break-inside: avoid;
            break-inside: avoid;
            max-width: 18cm !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            overflow: hidden !important;
          }

          /* Compact every section */
          .ticket-print > header,
          .ticket-print > div,
          .ticket-print > footer {
            padding-top: 10px !important;
            padding-bottom: 10px !important;
            padding-left: 18px !important;
            padding-right: 18px !important;
          }
          .ticket-print > header {
            padding-top: 12px !important;
            padding-bottom: 12px !important;
          }

          /* Typography */
          .ticket-print {
            font-size: 12px !important;
            line-height: 1.4 !important;
          }
          .ticket-print header .text-2xl {
            font-size: 17px !important;
          }
          .ticket-print header .text-2xl.font-extrabold.leading-none {
            font-size: 18px !important;
          }
          .ticket-print .font-mono.text-2xl {
            font-size: 18px !important;
          }
          .ticket-print .text-xl {
            font-size: 15px !important;
          }
          .ticket-print .text-3xl {
            font-size: 22px !important;
          }
          .ticket-print .text-sm {
            font-size: 12px !important;
          }
          .ticket-print .text-xs,
          .ticket-print .text-\\[10px\\],
          .ticket-print .text-\\[11px\\],
          .ticket-print .text-\\[9px\\] {
            font-size: 9px !important;
          }

          /* QR slot */
          .ticket-print .h-24.w-24 {
            height: 76px !important;
            width: 76px !important;
            padding: 4px !important;
          }

          /* Tighten vertical rhythm */
          .ticket-print .py-5,
          .ticket-print .py-6,
          .ticket-print .pb-6,
          .ticket-print .pt-5,
          .ticket-print .pt-6,
          .ticket-print .pt-4 {
            padding-top: 8px !important;
            padding-bottom: 8px !important;
          }
          .ticket-print .mb-3,
          .ticket-print .mt-2,
          .ticket-print .mt-1 {
            margin-bottom: 4px !important;
            margin-top: 2px !important;
          }
          .ticket-print .gap-3 {
            gap: 8px !important;
          }
          .ticket-print .gap-4 {
            gap: 10px !important;
          }

          /* Firefox fallback — doesn't support zoom; use transform scale.
             Negative margins compensate for the scale to keep the ticket centered. */
          @supports (-moz-appearance: none) {
            .ticket-print {
              zoom: 1;
              transform: scale(0.78);
              transform-origin: top center;
              width: 128% !important;
              margin-left: -14% !important;
              margin-right: -14% !important;
            }
          }
        }
      `}</style>
    </div>
  );
}

function DetailCell({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-[color:var(--ink-50)] border border-[color:var(--ink-100)] p-3 print:bg-white print:border-[color:var(--ink-200)]">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-[color:var(--ink-500)]">
        <span className="text-[color:var(--red-500)]">{icon}</span>
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-[color:var(--navy-900)]">{children}</div>
    </div>
  );
}
