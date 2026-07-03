"use client";

import { useState } from "react";
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Hash,
  Receipt,
  Landmark,
  Copy,
  Check,
  CreditCard,
} from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { useLocale } from "@/lib/i18n/client";
import { dict } from "@/lib/i18n/dict";

type Row = {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  copy?: boolean;
  mono?: boolean;
};

export default function RechiziteBancarePage() {
  const locale = useLocale();
  const t = dict(locale);
  const bp = t.bankDetailsPage;

  const companyRows: Row[] = [
    { label: bp.rows.name, value: "DAVO GROUP S.R.L.", icon: Building2 },
    { label: bp.rows.address, value: "Republica Moldova, r. Strășeni, s. Sireți, MD-3731", icon: MapPin },
    { label: bp.rows.phone, value: "+373 680 65 699", icon: Phone, href: "tel:+37368065699" },
    { label: bp.rows.email, value: "davogroup@yahoo.com", icon: Mail, href: "mailto:davogroup@yahoo.com" },
    { label: bp.rows.idno, value: "1013600041329", icon: Hash, copy: true, mono: true },
    { label: bp.rows.tva, value: "8601124", icon: Receipt, copy: true, mono: true },
  ];

  const bankRows: Row[] = [
    { label: bp.rows.bank, value: "B.C. „Moldova-Agroindbank” S.A.", icon: Landmark },
    { label: bp.rows.swift, value: "AGRNMD2X", icon: Hash, copy: true, mono: true },
    { label: bp.rows.iban, value: "MD29AG000000022512290650", icon: CreditCard, copy: true, mono: true },
  ];

  return (
    <>
      <section className="relative pt-12 lg:pt-16 pb-8 bg-[color:var(--ink-50)]">
        <div className="container-page">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--ink-200)] bg-white px-4 py-1.5 text-[11px] uppercase tracking-[0.22em] font-bold text-[color:var(--navy-800)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--red-500)]" />
              {bp.badge}
            </span>
            <h1 className="mt-4 display-hero text-[color:var(--navy-900)] text-[clamp(1.75rem,4vw,2.75rem)]">
              {bp.title}
            </h1>
            <p className="mt-4 max-w-2xl text-[color:var(--ink-700)]">{bp.intro}</p>
          </Reveal>
        </div>
      </section>

      <section className="pb-16 lg:pb-24 bg-[color:var(--ink-50)]">
        <div className="container-page">
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
            <Reveal>
              <InfoCard tag={bp.tagCompany} title={bp.companyCardTitle} rows={companyRows} />
            </Reveal>

            <Reveal delay={0.1}>
              <InfoCard tag={bp.tagBank} title={bp.bankCardTitle} rows={bankRows} accent />
            </Reveal>
          </div>

          <Reveal delay={0.15} className="mt-8">
            <div className="rounded-2xl border border-[color:var(--ink-200)] bg-white p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
              <div className="flex-1">
                <div className="font-[family-name:var(--font-montserrat)] font-bold text-[color:var(--navy-900)]">
                  {bp.needInvoiceTitle}
                </div>
                <p className="mt-1 text-sm text-[color:var(--ink-500)]">{bp.needInvoiceText}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
                <a
                  href="mailto:davogroup@yahoo.com"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[color:var(--navy-50)] px-4 py-2.5 hover:bg-[color:var(--navy-100)] transition-colors"
                >
                  <Mail className="h-4 w-4 text-[color:var(--red-500)]" />
                  <span className="text-sm font-semibold text-[color:var(--navy-900)]">
                    davogroup@yahoo.com
                  </span>
                </a>
                <a
                  href="tel:+37368065699"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[color:var(--red-500)] px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-white hover:bg-[color:var(--red-600)] transition-colors"
                >
                  <Phone className="h-4 w-4" />
                  {bp.callUs}
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}

function InfoCard({
  tag,
  title,
  rows,
  accent = false,
}: {
  tag: string;
  title: string;
  rows: Row[];
  accent?: boolean;
}) {
  return (
    <div className="h-full rounded-2xl bg-white border border-[color:var(--ink-200)] overflow-hidden">
      <div
        className={
          "flex items-center gap-3 px-6 py-4 border-b border-[color:var(--ink-100)] " +
          (accent ? "bg-[color:var(--navy-900)] text-white" : "bg-[color:var(--ink-50)]")
        }
      >
        <span
          className={
            "inline-flex items-center gap-2 rounded-full px-2.5 h-6 text-[10px] font-bold uppercase tracking-[0.22em] " +
            (accent
              ? "bg-white/10 text-white border border-white/15"
              : "bg-white text-[color:var(--navy-800)] border border-[color:var(--ink-200)]")
          }
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--red-500)]" />
          {tag}
        </span>
        <div
          className={
            "font-[family-name:var(--font-montserrat)] font-bold text-sm md:text-base " +
            (accent ? "text-white" : "text-[color:var(--navy-900)]")
          }
        >
          {title}
        </div>
      </div>
      <div className="divide-y divide-[color:var(--ink-100)]">
        {rows.map((r) => (
          <InfoRow key={r.label} row={r} />
        ))}
      </div>
    </div>
  );
}

function InfoRow({ row }: { row: Row }) {
  const locale = useLocale();
  const t = dict(locale);
  const bp = t.bankDetailsPage;
  const [copied, setCopied] = useState(false);
  const Icon = row.icon;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(row.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // no-op
    }
  };

  const ValueNode = (
    <span
      className={
        "font-semibold text-[color:var(--navy-900)] break-all " +
        (row.mono ? "font-[family-name:ui-monospace,SFMono-Regular,Menlo,monospace] text-[0.95rem] tracking-wide" : "")
      }
    >
      {row.value}
    </span>
  );

  return (
    <div className="flex items-start gap-4 px-6 py-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color:var(--navy-50)] text-[color:var(--navy-800)]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--ink-500)]">
          {row.label}
        </div>
        <div className="mt-1">
          {row.href ? (
            <a href={row.href} className="font-semibold text-[color:var(--navy-900)] hover:text-[color:var(--red-500)] transition-colors break-all">
              {row.value}
            </a>
          ) : (
            ValueNode
          )}
        </div>
      </div>
      {row.copy && (
        <button
          type="button"
          onClick={handleCopy}
          aria-label={bp.copyLabel(row.label)}
          className={
            "shrink-0 inline-flex items-center gap-1.5 rounded-lg border px-2.5 h-9 text-[11px] font-bold uppercase tracking-wider transition-colors " +
            (copied
              ? "border-[color:var(--success)] bg-[color:var(--success-soft)] text-[color:var(--success)]"
              : "border-[color:var(--ink-200)] text-[color:var(--navy-800)] hover:border-[color:var(--red-400)] hover:text-[color:var(--red-500)]")
          }
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" /> {bp.copied}
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" /> {bp.copy}
            </>
          )}
        </button>
      )}
    </div>
  );
}
