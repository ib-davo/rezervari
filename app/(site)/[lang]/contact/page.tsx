"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  Send,
  CheckCircle2,
} from "lucide-react";
import { motion } from "framer-motion";
import { contactInfo, pickupSchedule } from "@/lib/data";
import { Reveal } from "@/components/ui/Reveal";
import { useLocale } from "@/lib/i18n/client";
import { dict } from "@/lib/i18n/dict";
import { localizeDay } from "@/lib/i18n";

export default function ContactPage() {
  const locale = useLocale();
  const t = dict(locale);
  const cp = t.contactPage;
  const [sent, setSent] = useState(false);

  const phones = [
    { label: cp.phones.moldova1, value: contactInfo.phone },
    { label: cp.phones.moldova2, value: contactInfo.phoneSecondary },
    { label: cp.phones.belgium, value: contactInfo.phoneBelgium },
    { label: cp.phones.uk, value: contactInfo.phoneUK },
  ];

  return (
    <>
      <section className="relative pt-12 lg:pt-16 pb-8">
        <div className="container-page">
          <Reveal>
            <span className="eyebrow">
              <span className="h-1.5 w-6 rounded-full bg-[color:var(--red-500)]" />
              {cp.eyebrow}
            </span>
            <h1 className="display-hero display-xl text-[color:var(--navy-900)] mt-5">{cp.title}</h1>
            <h2 className="mt-6 display-hero text-2xl md:text-3xl text-[color:var(--red-500)]">
              {cp.subTitle}
            </h2>
          </Reveal>
        </div>
      </section>

      <section className="pb-16 lg:pb-24">
        <div className="container-page">
          <div className="grid gap-8 lg:grid-cols-[1.2fr,1fr]">
            <Reveal>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setSent(true);
                  setTimeout(() => setSent(false), 5000);
                }}
                className="rounded-3xl bg-white p-6 md:p-8 border border-[color:var(--ink-200)]"
              >
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField label={cp.nameLabel}>
                    <input type="text" required placeholder={cp.namePlaceholder} className="field-input" />
                  </FormField>
                  <FormField label={cp.firstNameLabel}>
                    <input type="text" required placeholder={cp.firstNamePlaceholder} className="field-input" />
                  </FormField>
                  <FormField label={cp.phoneLabel}>
                    <input type="tel" required placeholder={cp.phonePlaceholder} className="field-input" />
                  </FormField>
                  <FormField label={cp.emailLabel}>
                    <input type="email" required placeholder={cp.emailPlaceholder} className="field-input" />
                  </FormField>
                </div>

                <FormField label={cp.messageLabel} className="mt-4">
                  <textarea rows={5} placeholder={cp.messagePlaceholder} className="field-input resize-y min-h-[130px]" />
                </FormField>

                <label className="mt-5 flex items-start gap-2.5 text-xs text-[color:var(--ink-500)]">
                  <input type="checkbox" className="mt-0.5 accent-[color:var(--red-500)]" required />
                  <span>{cp.gdpr}</span>
                </label>

                <div className="mt-6 flex items-center gap-4">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-full bg-[color:var(--navy-900)] px-7 py-3.5 font-semibold text-white hover:bg-[color:var(--navy-800)] transition-colors"
                  >
                    <Send className="h-4 w-4" />
                    {cp.sendButton}
                  </button>
                  {sent && (
                    <motion.span
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-2 text-sm font-semibold text-[color:var(--success)]"
                    >
                      <CheckCircle2 className="h-4 w-4" /> {cp.sentSuccess}
                    </motion.span>
                  )}
                </div>
              </form>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="rounded-3xl bg-[color:var(--navy-900)] bg-hero-navy p-8 text-white h-full flex flex-col gap-7">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-[color:var(--red-400)]">
                    {cp.teamEyebrow}
                  </div>
                  <h3 className="mt-2 display-hero text-2xl md:text-3xl">{cp.teamTitle}</h3>
                  <p className="mt-2 text-white/65 text-sm">{cp.teamSubtitle}</p>
                </div>

                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/70 mb-3">
                    {cp.socialTitle}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-white/85">
                    <a href={contactInfo.social.facebook} target="_blank" rel="noreferrer" className="hover:text-[color:var(--red-400)] transition-colors">Facebook</a>
                    <span className="text-white/30">·</span>
                    <a href={contactInfo.social.instagram} target="_blank" rel="noreferrer" className="hover:text-[color:var(--red-400)] transition-colors">Instagram</a>
                    <span className="text-white/30">·</span>
                    <a href={contactInfo.social.tiktok} target="_blank" rel="noreferrer" className="hover:text-[color:var(--red-400)] transition-colors">TikTok</a>
                    <span className="text-white/50 ml-1">{contactInfo.social.handle}</span>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/70 mb-3 flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5" /> {cp.emailLabelBlock}
                  </div>
                  <a href={`mailto:${contactInfo.email}`} className="font-semibold text-white hover:text-[color:var(--red-400)]">
                    {contactInfo.email}
                  </a>
                </div>

                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/70 mb-3 flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" /> {cp.workingHours}
                  </div>
                  <div className="text-sm text-white/80">
                    <div>{cp.workingHoursValue}</div>
                    <div className="text-white/50 mt-0.5">{cp.workingHoursDispatch}</div>
                  </div>
                </div>

                <div className="mt-auto">
                  <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/70 mb-3 flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5" /> {cp.contactUs}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {phones.map((p) => p.value && (
                      <a
                        key={p.label}
                        href={`tel:${p.value.replace(/\s/g, "")}`}
                        className="rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm hover:bg-white/10 transition-colors"
                      >
                        <div className="text-[10px] font-bold uppercase tracking-wider text-white/55">
                          {p.label}
                        </div>
                        <div className="font-semibold text-white mt-0.5">{p.value}</div>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>

          <Reveal className="mt-8">
            <div className="rounded-3xl overflow-hidden border border-[color:var(--ink-200)]">
              <div className="grid md:grid-cols-[380px,1fr]">
                <div className="p-6 bg-white flex flex-col gap-5">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-[color:var(--red-500)] mb-2">
                      {cp.officeEyebrow}
                    </div>
                    <div className="mt-2">
                      <div className="font-[family-name:var(--font-montserrat)] font-bold text-[color:var(--navy-900)]">
                        {cp.hqLabel}
                      </div>
                      <div className="mt-1 text-sm text-[color:var(--ink-500)] flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-[color:var(--red-500)] shrink-0 mt-0.5" />
                        <span>{contactInfo.address}</span>
                      </div>
                      <div className="mt-2 text-xs text-[color:var(--ink-500)] flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5" /> {cp.hqHours}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-[color:var(--navy-50)] border border-[color:var(--navy-200,rgba(20,58,122,0.18))] p-4">
                    <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-[color:var(--red-500)] mb-2">
                      {cp.parcelPointEyebrow}
                    </div>
                    <div className="text-sm font-semibold text-[color:var(--navy-900)]">
                      {cp.parcelPointAddress}
                    </div>
                    <ul className="mt-3 space-y-1.5 text-sm text-[color:var(--ink-700)]">
                      {pickupSchedule.map((s) => (
                        <li key={s.day} className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-[color:var(--navy-900)]">{localizeDay(s.day, locale)}</span>
                          <span className="font-mono text-[13px]">{s.hours}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Link
                    href={contactInfo.mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-[color:var(--ink-200)] px-4 py-2.5 text-sm font-semibold text-[color:var(--navy-900)] hover:border-[color:var(--red-400)] transition-colors self-start"
                  >
                    <MapPin className="h-4 w-4 text-[color:var(--red-500)]" />
                    {cp.openInMaps}
                  </Link>
                </div>
                <div className="relative min-h-[420px] bg-[color:var(--navy-50)]">
                  <iframe
                    src={contactInfo.mapsEmbedSrc}
                    className="absolute inset-0 h-full w-full"
                    loading="lazy"
                    title="DAVO Group — Calea Ieșilor 11/3"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}

function FormField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink-500)] mb-1.5">
        {label}
      </span>
      {children}
      <style jsx>{`
        :global(.field-input) {
          width: 100%;
          border-radius: 12px;
          border: 1px solid var(--ink-200);
          background: #fff;
          padding: 0.85rem 1rem;
          font-size: 0.95rem;
          color: var(--navy-900);
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
          outline: none;
        }
        :global(.field-input::placeholder) {
          color: var(--ink-400);
        }
        :global(.field-input:focus) {
          border-color: var(--navy-700);
          box-shadow: 0 0 0 3px rgb(20 58 122 / 0.12);
        }
      `}</style>
    </label>
  );
}
