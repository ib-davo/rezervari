"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, Phone, Mail, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { contactInfo } from "@/lib/data";
import { defaultFAQs } from "@/lib/faqs";
import { Reveal } from "@/components/ui/Reveal";
import { useLocale } from "@/lib/i18n/client";
import { dict } from "@/lib/i18n/dict";
import { localePath } from "@/lib/i18n/config";

export { defaultFAQs };

export default function FAQ({
  title,
  items,
}: {
  title?: string;
  items?: { q: string; a: string }[];
} = {}) {
  const locale = useLocale();
  const t = dict(locale);
  const resolvedItems = items ?? (t.faq.questions as { q: string; a: string }[]);
  const resolvedTitle = title ?? t.faq.title;
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="relative py-20 lg:py-28">
      <div className="container-page">
        <div className="grid gap-10 lg:grid-cols-[1fr,1fr] lg:gap-16">
          <Reveal>
            <span className="eyebrow">
              <span className="h-1.5 w-6 rounded-full bg-[color:var(--red-500)]" />
              {t.faq.eyebrow}
            </span>
            <h2 className="display-hero display-lg text-[color:var(--navy-900)] mt-4">{resolvedTitle}</h2>
            <p className="mt-4 text-[color:var(--ink-700)] max-w-md">
              {t.faq.sidebarText}
            </p>
          </Reveal>

          <Reveal delay={0.05}>
            <div className="space-y-3">
              {resolvedItems.map((item, i) => {
                const isOpen = open === i;
                return (
                  <div
                    key={item.q}
                    className={cn(
                      "rounded-2xl border bg-white transition-colors overflow-hidden",
                      isOpen
                        ? "border-[color:var(--navy-700)] shadow-[0_12px_30px_-18px_rgba(11,38,83,0.35)]"
                        : "border-[color:var(--ink-200)] hover:border-[color:var(--navy-500)]"
                    )}
                  >
                    <button
                      onClick={() => setOpen(isOpen ? null : i)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                    >
                      <span className="font-[family-name:var(--font-montserrat)] font-bold text-[color:var(--navy-900)]">
                        {item.q}
                      </span>
                      <span
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full transition-colors shrink-0",
                          isOpen
                            ? "bg-[color:var(--red-500)] text-white"
                            : "bg-[color:var(--navy-50)] text-[color:var(--navy-800)]"
                        )}
                      >
                        {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-5 text-sm text-[color:var(--ink-700)] leading-relaxed">
                            {item.a}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <div className="mt-10 lg:mt-14 rounded-2xl border border-[color:var(--ink-200)] bg-white p-5 md:p-6 flex flex-col md:flex-row md:items-center md:gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[color:var(--navy-800)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--red-500)]" />
                {t.faq.noAnswerTitle}
              </div>
              <div className="mt-2 text-sm text-[color:var(--ink-700)]">
                {t.faq.noAnswerText}
              </div>
            </div>
            <div className="mt-4 md:mt-0 flex flex-col sm:flex-row gap-2 md:gap-3">
              <a
                href={`tel:${contactInfo.phone.replace(/\s/g, "")}`}
                className="group inline-flex items-center gap-2 rounded-lg bg-[color:var(--navy-50)] px-4 py-2.5 hover:bg-[color:var(--navy-100)] transition-colors"
              >
                <Phone className="h-4 w-4 text-[color:var(--red-500)]" />
                <span className="text-sm font-semibold text-[color:var(--navy-900)]">
                  {contactInfo.phone}
                </span>
              </a>
              <a
                href={`mailto:${contactInfo.email}`}
                className="group inline-flex items-center gap-2 rounded-lg bg-[color:var(--navy-50)] px-4 py-2.5 hover:bg-[color:var(--navy-100)] transition-colors"
              >
                <Mail className="h-4 w-4 text-[color:var(--red-500)]" />
                <span className="text-sm font-semibold text-[color:var(--navy-900)]">
                  {contactInfo.email}
                </span>
              </a>
              <Link
                href={localePath(locale, "/contact")}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[color:var(--red-500)] px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-white hover:bg-[color:var(--red-600)] transition-colors"
              >
                {t.faq.writeUs}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
