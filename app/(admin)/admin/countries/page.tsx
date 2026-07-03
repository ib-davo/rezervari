"use client";

import { useEffect, useState } from "react";
import { Globe, Save, AlertCircle, Sparkles } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Badge from "@/components/admin/Badge";

type Country = {
  id: string;
  name: string;
  slug: string;
  flag: string | null;
  cityCount: number;
  outboundWeekday: number | null;
  outboundTime: string | null;
  outboundDurationHours: number | null;
  returnWeekday: number | null;
  returnTime: string | null;
  returnDurationHours: number | null;
};

const WEEKDAYS = ["Duminică", "Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă"];

export default function CountriesPage() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, Country>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/countries").then((r) => r.json());
      if (res?.success) {
        setCountries(res.countries);
        const d: Record<string, Country> = {};
        for (const c of res.countries as Country[]) d[c.id] = { ...c };
        setDrafts(d);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function update(id: string, patch: Partial<Country>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function isDirty(c: Country): boolean {
    const d = drafts[c.id];
    if (!d) return false;
    return (
      d.outboundWeekday !== c.outboundWeekday ||
      d.outboundTime !== c.outboundTime ||
      d.outboundDurationHours !== c.outboundDurationHours ||
      d.returnWeekday !== c.returnWeekday ||
      d.returnTime !== c.returnTime ||
      d.returnDurationHours !== c.returnDurationHours
    );
  }

  async function save(id: string) {
    setSaving(id);
    try {
      const d = drafts[id];
      const res = await fetch("/api/admin/countries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          outboundWeekday: d.outboundWeekday,
          outboundTime: d.outboundTime,
          outboundDurationHours: d.outboundDurationHours,
          returnWeekday: d.returnWeekday,
          returnTime: d.returnTime,
          returnDurationHours: d.returnDurationHours,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error ?? "Eroare la salvare");
        return;
      }
      await load();
    } finally {
      setSaving(null);
    }
  }

  async function generateAll() {
    if (!confirm("Generez curse pentru următoarele 8 săptămâni pe toate rutele cu program activ?")) return;
    setGenerating(true);
    setGenerateMsg(null);
    try {
      const res = await fetch("/api/admin/trips/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "all", weeks: 8 }),
      });
      const data = await res.json();
      if (!data.success) {
        setGenerateMsg(`Eroare: ${data.error ?? "necunoscută"}`);
        return;
      }
      setGenerateMsg(
        `✓ ${data.created} curse create, ${data.skipped} existente sărite (${data.routes} rute analizate).`
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Țări & program săptămânal"
        subtitle="Setează plecarea și returul fix pentru fiecare țară. Cursele se generează automat."
        actions={
          <button
            onClick={generateAll}
            disabled={generating}
            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 disabled:opacity-60"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {generating ? "Generez…" : "Generează curse 8 săptămâni"}
          </button>
        }
      />

      {generateMsg && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>{generateMsg}</div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-3">
          {countries.map((c) => {
            const d = drafts[c.id] ?? c;
            const dirty = isDirty(c);
            const active =
              d.outboundWeekday !== null &&
              d.outboundTime &&
              d.outboundDurationHours &&
              d.returnWeekday !== null &&
              d.returnTime &&
              d.returnDurationHours;

            return (
              <div
                key={c.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 text-2xl">
                      {c.flag ?? <Globe className="h-5 w-5 text-slate-400" />}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">{c.name}</div>
                      <div className="text-xs text-slate-500">
                        {c.cityCount} {c.cityCount === 1 ? "oraș" : "orașe"} · /{c.slug}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {active ? (
                      <Badge variant="green">Program activ</Badge>
                    ) : (
                      <Badge variant="slate">Fără program</Badge>
                    )}
                    {dirty && (
                      <button
                        onClick={() => save(c.id)}
                        disabled={saving === c.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                      >
                        <Save className="h-3 w-3" />
                        {saving === c.id ? "Salvez…" : "Salvează"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <ScheduleBlock
                    title="Cursa DUS (Moldova → țară)"
                    weekday={d.outboundWeekday}
                    time={d.outboundTime}
                    duration={d.outboundDurationHours}
                    onWeekday={(v) => update(c.id, { outboundWeekday: v })}
                    onTime={(v) => update(c.id, { outboundTime: v })}
                    onDuration={(v) => update(c.id, { outboundDurationHours: v })}
                  />
                  <ScheduleBlock
                    title="Cursa RETUR (țară → Moldova)"
                    weekday={d.returnWeekday}
                    time={d.returnTime}
                    duration={d.returnDurationHours}
                    onWeekday={(v) => update(c.id, { returnWeekday: v })}
                    onTime={(v) => update(c.id, { returnTime: v })}
                    onDuration={(v) => update(c.id, { returnDurationHours: v })}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ScheduleBlock({
  title,
  weekday,
  time,
  duration,
  onWeekday,
  onTime,
  onDuration,
}: {
  title: string;
  weekday: number | null;
  time: string | null;
  duration: number | null;
  onWeekday: (v: number | null) => void;
  onTime: (v: string | null) => void;
  onDuration: (v: number | null) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
        {title}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-slate-500">Ziua</span>
          <select
            value={weekday ?? ""}
            onChange={(e) =>
              onWeekday(e.target.value === "" ? null : Number(e.target.value))
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-200"
          >
            <option value="">—</option>
            {WEEKDAYS.map((w, i) => (
              <option key={i} value={i}>
                {w}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-slate-500">Ora plecării</span>
          <input
            type="time"
            value={time ?? ""}
            onChange={(e) => onTime(e.target.value || null)}
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-slate-500">Durată (ore)</span>
          <input
            type="number"
            value={duration ?? ""}
            onChange={(e) =>
              onDuration(e.target.value === "" ? null : Number(e.target.value))
            }
            min={1}
            max={72}
            step={0.5}
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
        </label>
      </div>
    </div>
  );
}
