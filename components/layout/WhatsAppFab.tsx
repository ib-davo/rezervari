"use client";

import { contactInfo } from "@/lib/data";
import { WhatsAppIcon } from "@/components/ui/SocialIcons";

/**
 * Buton WhatsApp floating, fixat în colțul de jos dreapta, vizibil pe toate
 * paginile site-ului public. Ascuns la print și în /admin/* (montat doar în
 * site-layout, deci automat exclus din admin).
 */
export default function WhatsAppFab() {
  const phoneDigits = contactInfo.whatsapp.replace(/[^0-9]/g, "");
  return (
    <a
      href={`https://wa.me/${phoneDigits}`}
      target="_blank"
      rel="noreferrer"
      aria-label="Contactează-ne pe WhatsApp"
      title="WhatsApp"
      className="group print:hidden fixed bottom-5 right-5 md:bottom-7 md:right-7 z-[60] flex h-14 w-14 md:h-[60px] md:w-[60px] items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_18px_40px_-12px_rgba(37,211,102,0.6)] ring-4 ring-white/40 transition-transform hover:scale-105 active:scale-95"
    >
      {/* Pulse ring în spate */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-full bg-[#25D366] opacity-60 animate-ping pointer-events-none"
        style={{ animationDuration: "2.4s" }}
      />
      <WhatsAppIcon className="relative h-7 w-7 md:h-8 md:w-8 drop-shadow-sm" />
    </a>
  );
}
