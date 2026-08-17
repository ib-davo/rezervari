"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Plus, Search } from "lucide-react";
import { TicketShareActions } from "@/components/ui/TicketShareActions";

export default function SuccessCard({
  bookingNumber,
  ticketUrl,
  mode = "bilet",
  shareText,
  onNewBooking,
}: {
  bookingNumber?: string;
  ticketUrl?: string;
  mode?: "bilet" | "colet";
  /** Textul partajat pe socials împreună cu linkul biletului. */
  shareText?: string;
  /** Resetează formularul pentru încă o rezervare (fără să piardă ruta aleasă). */
  onNewBooking?: () => void;
}) {
  const title =
    mode === "colet"
      ? "Felicitări! Ai rezervat cu succes serviciul de DAVO Transport pasageri și colete"
      : "Felicitări! Rezervarea ta a fost confirmată cu succes";

  return (
    <section className="relative py-16 lg:py-24 bg-[color:var(--ink-50)] min-h-[70vh] flex items-center">
      <div className="container-page">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-2xl rounded-3xl bg-white p-8 md:p-14 text-center shadow-[0_40px_100px_-40px_rgba(16,196,155,0.45)] border border-[color:var(--ink-200)]"
        >
          <motion.div
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5, type: "spring", stiffness: 200 }}
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--success)] text-white shadow-[0_20px_40px_-15px_rgba(16,196,155,0.6)]"
          >
            <Check className="h-10 w-10" strokeWidth={3} />
          </motion.div>

          <h1 className="mt-7 font-[family-name:var(--font-montserrat)] font-extrabold uppercase tracking-wide text-[color:var(--success)] text-xl md:text-2xl leading-tight">
            {title}
          </h1>

          <p className="mt-4 text-[color:var(--ink-500)] max-w-md mx-auto">
            Un e-mail cu biletul a fost trimis către detaliile tale de contact, împreună cu un act de identitate necesar pentru călătorie.
          </p>

          {bookingNumber && (
            <div className="mt-7 inline-flex items-center gap-3 rounded-full bg-[color:var(--navy-50)] px-5 py-3 border border-[color:var(--navy-100)]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink-500)]">
                Nr. rezervare
              </span>
              <span className="font-mono font-bold text-[color:var(--navy-900)] tracking-widest">
                {bookingNumber}
              </span>
            </div>
          )}

          {ticketUrl && (
            <div className="mt-8">
              <TicketShareActions
                ticketUrl={ticketUrl}
                shareText={shareText ?? `Biletul tău DAVO — ${bookingNumber ?? ""}`.trim()}
                bookingNumber={bookingNumber}
              />
            </div>
          )}

          <div className="mt-8 flex flex-wrap justify-center gap-3 border-t border-[color:var(--ink-100)] pt-6">
            {onNewBooking && (
              <button
                onClick={onNewBooking}
                className="inline-flex items-center gap-2 rounded-full bg-[color:var(--navy-900)] px-6 py-3 text-sm font-semibold text-white hover:brightness-110 transition-all"
              >
                <Plus className="h-4 w-4" />
                Rezervare nouă
              </button>
            )}
            {mode === "colet" && bookingNumber && (
              <Link
                href={`/livrare?nr=${bookingNumber}`}
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--ink-200)] bg-white px-6 py-3 text-sm font-semibold text-[color:var(--navy-900)] hover:border-[color:var(--navy-700)] transition-colors"
              >
                <Search className="h-4 w-4" />
                Vezi rezervarea
              </Link>
            )}
            <Link
              href="/panou"
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--ink-200)] bg-white px-6 py-3 text-sm font-semibold text-[color:var(--navy-900)] hover:border-[color:var(--navy-700)] transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Înapoi la panou
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
