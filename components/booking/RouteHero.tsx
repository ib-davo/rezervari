"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Package, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/client";
import { dict } from "@/lib/i18n/dict";
import { localePath } from "@/lib/i18n/config";

export default function RouteHero({
  mode,
  from,
  to,
}: {
  mode: "bilet" | "colet";
  from: string;
  to: string;
}) {
  const locale = useLocale();
  const t = dict(locale);
  const bookTicket = t.common.bookTicket;
  const transportParcels = locale === "ru" ? "Перевозка посылок" : "Transport colete";
  const transport = locale === "ru" ? "Перевозка" : "Transport";

  return (
    <section className="relative overflow-hidden bg-hero-navy text-white">
      <div className="bg-noise absolute inset-0 opacity-30" />
      <div className="absolute -top-40 -right-20 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(225,30,43,0.2),transparent_60%)]" />

      <div className="container-page relative py-10 lg:py-14">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between"
        >
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-[color:var(--red-400)]">
              {mode === "bilet" ? bookTicket : transportParcels}
            </div>
            <h1 className="mt-3 display-hero text-3xl md:text-4xl lg:text-5xl text-white">
              {mode === "bilet" ? transport : transportParcels}{" "}
              <span className="text-white/90">{from.toUpperCase()}</span>
              <span className="text-[color:var(--red-400)] mx-3">—</span>
              <span className="text-white/90">{to.toUpperCase()}</span>
            </h1>
          </div>

          <div className="flex items-center gap-1 rounded-full bg-white/10 border border-white/15 backdrop-blur-sm p-1 self-start">
            <ModeTab active={mode === "bilet"} href={localePath(locale, "/rezervare")} icon={<Users className="h-4 w-4" />}>
              {t.bookingPage.routeTab.passengers}
            </ModeTab>
            <ModeTab
              active={mode === "colet"}
              href={localePath(locale, "/rezervare?mode=colet")}
              icon={<Package className="h-4 w-4" />}
            >
              {t.bookingPage.routeTab.parcels}
            </ModeTab>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function ModeTab({
  active,
  href,
  icon,
  children,
}: {
  active: boolean;
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
        active
          ? "bg-[color:var(--red-500)] text-white"
          : "text-white/75 hover:text-white"
      )}
    >
      {icon}
      {children}
    </Link>
  );
}
