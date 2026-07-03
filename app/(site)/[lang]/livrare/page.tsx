"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  Package,
  CheckCircle2,
  XCircle,
  CalendarClock,
  MapPin,
  CreditCard,
  Phone,
  ArrowRight,
  Info,
} from "lucide-react";
import { contactInfo } from "@/lib/data";
import PageHero from "@/components/sections/PageHero";
import { Reveal } from "@/components/ui/Reveal";
import { useLocale } from "@/lib/i18n/client";
import { dict } from "@/lib/i18n/dict";
import { localePath } from "@/lib/i18n/config";

type TrackResult = {
  bookingNumber: string;
  type: "passenger" | "parcel";
  status: string;
  statusLabel: string;
  passengerResponse: string | null;
  passengerResponseLabel: string | null;
  departureCity: string;
  arrivalCity: string;
  departureDate: string;
  returnDate: string | null;
  parcelDetails: string | null;
  payMethod: string | null;
  paymentStatus: string;
  recipient: string;
  createdAt: string;
  confirmedAt: string | null;
};

export default function LivrarePage() {
  return (
    <Suspense fallback={null}>
      <LivrareContent />
    </Suspense>
  );
}

function LivrareContent() {
  const locale = useLocale();
  const t = dict(locale);
  const td = t.deliveryPage;
  const params = useSearchParams();
  const initialNumber = (params.get("nr") || params.get("bookingNumber") || "").trim();
  const [bookingNumber, setBookingNumber] = useState(initialNumber);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrackResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoLookedUp = useRef(false);

  const lookup = async (nr: string, ph: string) => {
    if (!nr.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const qs = new URLSearchParams({ bookingNumber: nr.trim().toUpperCase() });
      if (ph.trim()) qs.set("phone", ph.trim());
      const res = await fetch(`/api/public/track?${qs.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!data.success) setError(data.error || td.errorGeneric);
      else setResult(data.booking);
    } catch {
      setError(td.errorNetwork);
    } finally {
      setLoading(false);
    }
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    void lookup(bookingNumber, phone);
  };

  useEffect(() => {
    if (!initialNumber || autoLookedUp.current) return;
    autoLookedUp.current = true;
    void lookup(initialNumber, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNumber]);

  return (
    <>
      <PageHero
        eyebrow={td.eyebrow}
        title={td.title}
        description={td.description}
        tone="dark"
      />

      <section className="relative pt-10 pb-20 bg-[color:var(--ink-50)]">
        <div className="container-page max-w-3xl">
          <Reveal>
            <form
              onSubmit={submit}
              className="rounded-3xl border border-[color:var(--ink-200)] bg-white p-6 md:p-8 shadow-[0_30px_80px_-40px_rgba(11,38,83,0.25)]"
            >
              <div className="grid md:grid-cols-[1.4fr,1fr] gap-4">
                <label className="block">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink-500)] mb-1.5">
                    {td.bookingNumberLabel}
                  </span>
                  <div className="flex items-center gap-2 rounded-xl border border-[color:var(--ink-200)] bg-white px-4 py-3 focus-within:border-[color:var(--navy-700)] focus-within:ring-2 focus-within:ring-[color:var(--navy-200,rgba(20,58,122,0.18))]">
                    <Package className="h-4 w-4 text-[color:var(--red-500)]" />
                    <input
                      required
                      value={bookingNumber}
                      onChange={(e) => setBookingNumber(e.target.value.toUpperCase())}
                      placeholder={td.bookingNumberPlaceholder}
                      className="w-full bg-transparent font-mono text-[15px] font-semibold text-[color:var(--navy-900)] outline-none uppercase"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink-500)] mb-1.5">
                    {td.phoneTail}
                  </span>
                  <div className="flex items-center gap-2 rounded-xl border border-[color:var(--ink-200)] bg-white px-4 py-3 focus-within:border-[color:var(--navy-700)] focus-within:ring-2 focus-within:ring-[color:var(--navy-200,rgba(20,58,122,0.18))]">
                    <Phone className="h-4 w-4 text-[color:var(--red-500)]" />
                    <input
                      inputMode="numeric"
                      maxLength={4}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder={td.phoneTailPlaceholder}
                      className="w-full bg-transparent font-mono text-[15px] font-semibold text-[color:var(--navy-900)] outline-none"
                    />
                  </div>
                </label>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={loading || !bookingNumber.trim()}
                  className="inline-flex items-center gap-2 rounded-full bg-[color:var(--red-500)] px-6 py-3 text-sm font-semibold text-white hover:bg-[color:var(--red-600)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_12px_30px_-10px_rgba(225,30,43,0.5)]"
                >
                  {loading ? td.searching : (
                    <>
                      <Search className="h-4 w-4" />
                      {td.searchButton}
                    </>
                  )}
                </button>
                <span className="text-xs text-[color:var(--ink-500)]">
                  {td.helpHint("").replace(contactInfo.phone, "")}{" "}
                  <a
                    href={`tel:${contactInfo.phone.replace(/\s/g, "")}`}
                    className="font-semibold text-[color:var(--navy-900)] hover:text-[color:var(--red-500)]"
                  >
                    {contactInfo.phone}
                  </a>
                </span>
              </div>
            </form>
          </Reveal>

          {error && (
            <Reveal>
              <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <Info className="h-5 w-5 shrink-0 mt-0.5" />
                <div>{error}</div>
              </div>
            </Reveal>
          )}

          {result && <ResultCard r={result} />}

          <Reveal delay={0.1}>
            <div className="mt-12 grid gap-3 sm:grid-cols-3">
              {td.helpCards.map((b, i) => {
                const Icon = [Package, CheckCircle2, Phone][i] ?? Phone;
                return (
                  <div key={b.title} className="rounded-2xl border border-[color:var(--ink-200)] bg-white p-5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--navy-50)] text-[color:var(--navy-800)]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="mt-3 font-[family-name:var(--font-montserrat)] font-bold text-[color:var(--navy-900)]">
                      {b.title}
                    </div>
                    <div className="mt-1 text-sm text-[color:var(--ink-500)] leading-relaxed">
                      {b.body}{i === 2 ? ` ${contactInfo.phone}` : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}

function ResultCard({ r }: { r: TrackResult }) {
  const locale = useLocale();
  const t = dict(locale);
  const td = t.deliveryPage;

  const fmtDate = (s: string | null) =>
    s
      ? new Intl.DateTimeFormat(td.dateLocale, {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }).format(new Date(s))
      : "—";

  const isParcel = r.type === "parcel";
  const isCancelled = r.status === "cancelled" || r.passengerResponse === "cancelled";
  const tone = isCancelled
    ? "bg-red-50 border-red-200 text-red-900"
    : "bg-[color:var(--success-soft)] border-[color:var(--success)] text-[color:var(--success)]";

  return (
    <Reveal>
      <article className="mt-8 rounded-3xl border border-[color:var(--ink-200)] bg-white overflow-hidden shadow-[0_30px_80px_-40px_rgba(11,38,83,0.25)]">
        <header className="bg-[color:var(--navy-900)] bg-hero-navy text-white p-6 md:p-7 relative">
          <div className="bg-noise absolute inset-0 opacity-30" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-[color:var(--red-400)]">
                {isParcel ? td.parcel : td.ticket} · {td.bookingNumberLabel2}
              </div>
              <div className="font-mono text-2xl md:text-3xl font-extrabold mt-1.5">
                {r.bookingNumber}
              </div>
              <div className="mt-1 text-sm text-white/65">{r.recipient}</div>
            </div>
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-wider ${tone}`}
            >
              {isCancelled ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {r.statusLabel}
            </span>
          </div>
        </header>

        <div className="p-6 md:p-7 grid gap-4 md:grid-cols-2">
          <Field icon={<MapPin className="h-3.5 w-3.5" />} label={td.departure}>{r.departureCity}</Field>
          <Field icon={<MapPin className="h-3.5 w-3.5" />} label={td.destination}>{r.arrivalCity}</Field>
          <Field icon={<CalendarClock className="h-3.5 w-3.5" />} label={td.departureDate}>
            {fmtDate(r.departureDate)}
          </Field>
          {r.returnDate && (
            <Field icon={<CalendarClock className="h-3.5 w-3.5" />} label={td.returnDate}>
              {fmtDate(r.returnDate)}
            </Field>
          )}
          {isParcel && r.parcelDetails && (
            <Field icon={<Package className="h-3.5 w-3.5" />} label={td.parcelDetails} full>
              {r.parcelDetails}
            </Field>
          )}
          <Field icon={<CreditCard className="h-3.5 w-3.5" />} label={td.payment}>
            {r.payMethod === "cash_on_pickup"
              ? td.cashOnPickup
              : r.payMethod === "card_on_pickup"
                ? td.cardOnPickup
                : "—"}
            {r.paymentStatus === "paid" && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--success)]">
                <CheckCircle2 className="h-3 w-3" /> {td.paid}
              </span>
            )}
          </Field>
          {r.passengerResponseLabel && (
            <Field icon={<Info className="h-3.5 w-3.5" />} label={td.passengerResponse} full>
              {r.passengerResponseLabel}
            </Field>
          )}
        </div>

        <footer className="border-t border-[color:var(--ink-200)] bg-[color:var(--ink-50)] p-5 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-[color:var(--ink-700)]">
            {td.questionsCall("")} {" "}
            <a
              href={`tel:${contactInfo.phone.replace(/\s/g, "")}`}
              className="font-semibold text-[color:var(--navy-900)] hover:text-[color:var(--red-500)]"
            >
              {contactInfo.phone}
            </a>
          </div>
          <a
            href={localePath(locale, `/bilet/${r.bookingNumber}`)}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--ink-200)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--navy-900)] hover:border-[color:var(--red-400)] transition-colors"
          >
            {td.seeDocument}
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </footer>
      </article>
    </Reveal>
  );
}

function Field({
  icon,
  label,
  children,
  full,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={`rounded-xl border border-[color:var(--ink-200)] bg-white p-4 ${full ? "md:col-span-2" : ""}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-[color:var(--ink-500)]">
        <span className="text-[color:var(--red-500)]">{icon}</span>
        {label}
      </div>
      <div className="mt-1.5 text-sm font-semibold text-[color:var(--navy-900)]">
        {children}
      </div>
    </div>
  );
}
