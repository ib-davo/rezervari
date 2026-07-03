"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Power, Search, Route as RouteIcon, Trash2 } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Badge from "@/components/admin/Badge";
import EmptyState from "@/components/admin/EmptyState";
import type { MockRoute, CityOption } from "@/lib/adminMock";

type RouteForm = {
  id?: string;
  originCityId: string;
  destinationCityId: string;
  basePrice: number;
  currency: string;
  description: string;
  weeklyDepartures: number;
  active: boolean;
};

export default function RoutesPage() {
  const [routes, setRoutes] = useState<MockRoute[]>([]);
  const [origins, setOrigins] = useState<CityOption[]>([]);
  const [destinations, setDestinations] = useState<CityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<MockRoute | "new" | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [rRes, gRes] = await Promise.all([
        fetch("/api/admin/routes").then((r) => r.json()),
        fetch("/api/admin/geography").then((r) => r.json()),
      ]);
      if (rRes?.success) setRoutes(rRes.routes);
      if (gRes?.success) {
        setOrigins(gRes.origins);
        setDestinations(gRes.destinations);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = routes.filter((r) => {
    if (!q) return true;
    const k = q.toLowerCase();
    return (
      r.origin.toLowerCase().includes(k) ||
      r.destination.toLowerCase().includes(k) ||
      r.country.toLowerCase().includes(k)
    );
  });

  async function save(form: RouteForm) {
    const { id, ...body } = form;
    const url = id ? `/api/admin/routes/${id}` : `/api/admin/routes`;
    const method = id ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.error ?? "Eroare la salvare");
      return;
    }
    setEditing(null);
    await load();
    // Feedback explicit dacă ruta inversă a fost actualizată/creată cu același
    // preț — admin-ul vede negru pe alb că sync-ul s-a întâmplat (cazul cu
    // Birmingham unde nu era clar dacă cealaltă direcție s-a aliniat).
    if (data.inverseCreated) {
      alert("Rută inversă creată automat cu același preț și monedă.");
    } else if (data.inverseUpdated) {
      // Folosesc un mesaj scurt — nu vrem să sufoc admin-ul cu pop-up-uri
      // la fiecare editare. Show only when prețul/moneda s-au atins.
      if (body.basePrice !== undefined || body.currency !== undefined) {
        alert("Prețul a fost sincronizat și pe ruta inversă.");
      }
    }
  }

  async function toggleActive(route: MockRoute) {
    const res = await fetch(`/api/admin/routes/${route.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !route.active }),
    });
    if ((await res.json()).success) load();
  }

  async function remove(id: string) {
    if (!confirm("Ștergi această rută?")) return;
    const res = await fetch(`/api/admin/routes/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!data.success) {
      alert(data.error ?? "Nu s-a putut șterge");
      return;
    }
    load();
  }

  return (
    <div>
      <PageHeader
        title="Rute"
        subtitle={`${routes.length} rute în baza de date`}
        actions={
          <button
            onClick={() => setEditing("new")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-600"
          >
            <Plus className="h-3.5 w-3.5" /> Rută nouă
          </button>
        }
      />

      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Caută rută sau țară…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:border-orange-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
        </div>
        <span className="text-xs text-slate-500">{filtered.length} rezultate</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={RouteIcon}
          title="Nicio rută"
          description="Adaugă prima rută între Moldova și o destinație europeană."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => (
            <article key={r.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{r.country}</span>
                    <Badge variant={r.active ? "green" : "slate"}>{r.active ? "Activă" : "Inactivă"}</Badge>
                  </div>
                  <h3 className="mt-1 text-base font-bold text-slate-900 truncate">
                    {r.origin} <span className="text-slate-400">→</span> {r.destination}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">{r.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold text-slate-900">
                    {r.basePrice} <span className="text-sm font-semibold text-slate-500">{r.currency}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">preț de bază</div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <div className="text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{r.weeklyDepartures}</span> plecări / săptămână
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => toggleActive(r)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" title={r.active ? "Dezactivează" : "Activează"}>
                    <Power className="h-4 w-4" />
                  </button>
                  <button onClick={() => remove(r.id)} className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600" title="Șterge">
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => setEditing(r)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-orange-600" title="Editează">
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing !== null && (
        <RouteModal
          initial={editing === "new" ? null : editing}
          origins={origins}
          destinations={destinations}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

function RouteModal({
  initial,
  origins,
  destinations,
  onClose,
  onSave,
}: {
  initial: MockRoute | null;
  origins: CityOption[];
  destinations: CityOption[];
  onClose: () => void;
  onSave: (f: RouteForm) => void;
}) {
  const [form, setForm] = useState<RouteForm>({
    id: initial?.id,
    originCityId: initial?.originCityId ?? origins[0]?.id ?? "",
    destinationCityId: initial?.destinationCityId ?? destinations[0]?.id ?? "",
    basePrice: initial?.basePrice ?? 100,
    currency: initial?.currency ?? "EUR",
    description: initial?.description ?? "",
    weeklyDepartures: initial?.weeklyDepartures ?? 2,
    active: initial?.active ?? true,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">
            {initial ? "Editează rută" : "Rută nouă"}
          </h3>
        </div>
        <form className="grid gap-4 px-5 py-4" onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
          <Field label="Origine">
            <select value={form.originCityId} onChange={(e) => setForm({ ...form, originCityId: e.target.value })} className={inputCls} required>
              {origins.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.countryName})</option>
              ))}
            </select>
          </Field>
          <Field label="Destinație">
            <select value={form.destinationCityId} onChange={(e) => setForm({ ...form, destinationCityId: e.target.value })} className={inputCls} required>
              {destinations.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.countryName})</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Preț de bază">
              <input type="number" value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: Number(e.target.value) })} className={inputCls} />
            </Field>
            <Field label="Monedă">
              <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className={inputCls}>
                <option>EUR</option><option>GBP</option><option>MDL</option><option>USD</option>
              </select>
            </Field>
            <Field label="Plecări / săpt.">
              <input type="number" value={form.weeklyDepartures} onChange={(e) => setForm({ ...form, weeklyDepartures: Number(e.target.value) })} className={inputCls} />
            </Field>
          </div>
          <Field label="Descriere scurtă">
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className={inputCls} />
          </Field>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-300" />
            Rută activă
          </label>
          <div className="mt-2 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Anulează</button>
            <button type="submit" className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600">Salvează</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}

const inputCls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-200";
