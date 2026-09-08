"use client";

// Deep-link „Bilet retur": /panou/retur/<numărul rezervării>.
//
// Butonul de pe cardul unui pasager din davo.md/admin trimite aici, fiindcă
// acolo panoul e doar-citire — rezervarea de retur se creează tot în panoul
// ăsta, cu aceeași logică de locuri și emailuri. Pagina caută rezervarea după
// număr (activă SAU arhivată) și deschide direct modalul de retur, cu datele
// clientului deja copiate: operatorul alege doar data și locul.
//
// Neautentificat, proxy.ts trimite la /panou/login?next=/panou/retur/NR, deci
// după PIN operatorul ajunge exact aici.

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import { ReturnBookingModal } from "@/components/operator/ReturnBookingModal";
import type { OperatorBooking } from "@/components/operator/BookingsView";

export default function ReturDeepLinkPage() {
  const params = useParams();
  const router = useRouter();
  const bookingNumber = decodeURIComponent(String(params.bookingNumber ?? ""));

  const [booking, setBooking] = useState<OperatorBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    fetch(`/api/operator/bookings?number=${encodeURIComponent(bookingNumber)}`, {
      cache: "no-store",
      signal: ac.signal,
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && d.booking) setBooking(d.booking as OperatorBooking);
        else setError(d?.error || "Rezervarea nu a fost găsită.");
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError("Nu am putut încărca rezervarea.");
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [bookingNumber]);

  // Aceeași condiție ca butonul din panou: pasager, pe un singur sens, neanulat.
  const canReturn =
    booking && booking.type !== "parcel" && booking.status !== "cancelled" && booking.tripType !== "round-trip";

  return (
    <div>
      <Link
        href="/panou"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--ink-500)] hover:text-[color:var(--navy-900)]"
      >
        <ArrowLeft className="h-4 w-4" /> Înapoi la panou
      </Link>

      <h1 className="mt-3 text-xl font-extrabold text-[color:var(--navy-900)]">Bilet retur</h1>
      <p className="mt-1 text-sm text-[color:var(--ink-500)]">
        Rezervarea <span className="font-mono font-bold text-[color:var(--navy-900)]">{bookingNumber}</span> — sensul se
        inversează automat, datele clientului se copiază.
      </p>

      {loading ? (
        <div className="mt-6 inline-flex items-center gap-2 text-sm text-[color:var(--ink-500)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Se caută rezervarea…
        </div>
      ) : error || !booking ? (
        <Problem text={error ?? "Rezervarea nu a fost găsită."} />
      ) : !canReturn ? (
        <Problem
          text={
            booking.type === "parcel"
              ? "Rezervarea e un colet — returul se face doar pentru pasageri."
              : booking.status === "cancelled"
                ? "Rezervarea e anulată — nu i se poate face retur."
                : "Rezervarea e deja tur-retur — clientul are biletul de întoarcere."
          }
        />
      ) : (
        <ReturnBookingModal b={booking} onClose={() => router.push("/panou")} onReload={() => {}} />
      )}
    </div>
  );
}

function Problem({ text }: { text: string }) {
  return (
    <div className="mt-6 max-w-md rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="text-sm font-semibold text-amber-800">{text}</div>
      </div>
      <Link
        href="/panou/rezervare"
        className="mt-3 inline-flex rounded-full bg-[color:var(--navy-900)] px-3 py-1.5 text-xs font-semibold text-white active:scale-95 transition-transform"
      >
        Fă o rezervare nouă
      </Link>
    </div>
  );
}
