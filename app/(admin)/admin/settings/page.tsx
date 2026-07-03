"use client";

import { useState } from "react";
import { Building2, Mail, CreditCard, KeyRound, Save } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import { contactInfo, bankDetails } from "@/lib/data";

type Tab = "company" | "bank" | "email" | "cron";

const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "company", label: "Companie", icon: Building2 },
  { id: "bank", label: "Rechizite bancare", icon: CreditCard },
  { id: "email", label: "Email & Resend", icon: Mail },
  { id: "cron", label: "Cron & Reminders", icon: KeyRound },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("company");

  return (
    <div>
      <PageHeader
        title="Setări"
        subtitle="Configurare generală și integrări"
        actions={
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-600">
            <Save className="h-3.5 w-3.5" /> Salvează modificări
          </button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm h-fit">
          <nav className="space-y-0.5">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-orange-50 text-orange-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? "text-orange-500" : "text-slate-400"}`} />
                  {t.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {tab === "company" && <CompanyTab />}
          {tab === "bank" && <BankTab />}
          {tab === "email" && <EmailTab />}
          {tab === "cron" && <CronTab />}
        </section>
      </div>
    </div>
  );
}

function CompanyTab() {
  return (
    <div className="space-y-5">
      <Title label="Date companie" desc="Informațiile afișate pe site și pe bilete" />
      <Grid>
        <Field label="Nume legal">
          <input defaultValue="DAVO GRUP SRL" className={inputCls} />
        </Field>
        <Field label="Cod fiscal">
          <input defaultValue="1010600006849" className={inputCls} />
        </Field>
        <Field label="Telefon principal">
          <input defaultValue={contactInfo.phone} className={inputCls} />
        </Field>
        <Field label="Email contact">
          <input defaultValue={contactInfo.email} className={inputCls} />
        </Field>
      </Grid>
      <Field label="Adresă">
        <input defaultValue={contactInfo.address} className={inputCls} />
      </Field>
      <Grid>
        <Field label="WhatsApp">
          <input defaultValue={contactInfo.whatsapp} className={inputCls} />
        </Field>
        <Field label="Telegram">
          <input defaultValue={contactInfo.telegram} className={inputCls} />
        </Field>
      </Grid>
    </div>
  );
}

function BankTab() {
  return (
    <div className="space-y-5">
      <Title label="Rechizite bancare" desc="Afișate pe pagina publică /rechizitele-bancare și pe facturi" />
      <Grid>
        <Field label="Bancă">
          <input defaultValue={bankDetails.bank} className={inputCls} />
        </Field>
        <Field label="Cod bancă (SWIFT)">
          <input defaultValue={bankDetails.bankCode} className={inputCls} />
        </Field>
        <Field label="Cont MDL">
          <input defaultValue={bankDetails.accountMDL} className={inputCls} />
        </Field>
        <Field label="Cont EUR">
          <input defaultValue={bankDetails.accountEUR} className={inputCls} />
        </Field>
        <Field label="Cont USD">
          <input defaultValue={bankDetails.accountUSD} className={inputCls} />
        </Field>
        <Field label="Cod TVA">
          <input defaultValue={bankDetails.tvvaCode} className={inputCls} />
        </Field>
      </Grid>
    </div>
  );
}

function EmailTab() {
  return (
    <div className="space-y-5">
      <Title label="Configurare Resend" desc="Provider-ul folosit pentru trimiterea emailurilor automate" />
      <Grid>
        <Field label="RESEND_API_KEY">
          <input placeholder="re_********" className={inputCls} type="password" />
        </Field>
        <Field label="From (expeditor)">
          <input defaultValue="DAVO Group <noreply@davo.md>" className={inputCls} />
        </Field>
        <Field label="Reply-to">
          <input defaultValue={contactInfo.email} className={inputCls} />
        </Field>
        <Field label="Domeniu verificat">
          <input defaultValue="davo.md" className={inputCls} />
        </Field>
      </Grid>
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-semibold">Notă</p>
        <p className="mt-1 text-xs leading-relaxed text-blue-800">
          API key-ul se salvează în <code className="font-mono">process.env.RESEND_API_KEY</code>, nu în baza
          de date. Panoul doar afișează status-ul și permite testul de conexiune.
        </p>
      </div>
    </div>
  );
}

function CronTab() {
  return (
    <div className="space-y-5">
      <Title label="Reminders & Cron" desc="Reguli de trimitere automată + endpoint de cron" />
      <Grid>
        <Field label="Reminder înainte de plecare (h)">
          <input type="number" defaultValue={24} className={inputCls} />
        </Field>
        <Field label="Reminder 2 (h)">
          <input type="number" defaultValue={2} className={inputCls} />
        </Field>
        <Field label="Endpoint cron">
          <input defaultValue="/api/cron/send-reminders" className={inputCls} readOnly />
        </Field>
        <Field label="CRON_SECRET">
          <input placeholder="••••••••••••" className={inputCls} type="password" />
        </Field>
      </Grid>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-700">
        <p className="font-semibold text-slate-900">Exemplu configurare Vercel Cron</p>
        <pre className="mt-2 overflow-x-auto rounded bg-white p-3 font-mono">{`// vercel.json
{
  "crons": [
    { "path": "/api/cron/send-reminders", "schedule": "*/10 * * * *" }
  ]
}`}</pre>
      </div>
    </div>
  );
}

function Title({ label, desc }: { label: string; desc?: string }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-slate-900">{label}</h2>
      {desc && <p className="mt-0.5 text-xs text-slate-500">{desc}</p>}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-200";
