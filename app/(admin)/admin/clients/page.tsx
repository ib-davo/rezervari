"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Star, Mail, Phone, Plus, Download, Route as RouteIcon } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Badge from "@/components/admin/Badge";
import EmptyState from "@/components/admin/EmptyState";
import type { MockClient } from "@/lib/adminMock";

const dateFmt = new Intl.DateTimeFormat("ro-RO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default function ClientsPage() {
  const [clients, setClients] = useState<MockClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [onlyVip, setOnlyVip] = useState(false);
  const [routeFilter, setRouteFilter] = useState<string>("all");
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/clients");
      const data = await res.json();
      if (data?.success) setClients(data.clients);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const allRoutes = useMemo(() => {
    const s = new Set<string>();
    for (const c of clients) for (const r of c.routes ?? []) s.add(r);
    return Array.from(s).sort();
  }, [clients]);

  const filtered = clients.filter((c) => {
    if (onlyVip && !c.vip) return false;
    if (routeFilter !== "all" && !(c.routes ?? []).includes(routeFilter)) return false;
    if (!q) return true;
    const k = q.toLowerCase();
    return (
      c.firstName.toLowerCase().includes(k) ||
      c.lastName.toLowerCase().includes(k) ||
      c.email.toLowerCase().includes(k) ||
      c.phone.includes(q)
    );
  });

  function exportCsv() {
    const headers = [
      "Prenume",
      "Nume",
      "Email",
      "Telefon",
      "Rezervari",
      "Total cheltuit (EUR)",
      "Ultima cursa",
      "VIP",
      "Rute",
      "Notite",
    ];
    const rows = filtered.map((c) => [
      c.firstName,
      c.lastName,
      c.email,
      c.phone,
      String(c.bookings),
      String(c.totalSpent),
      c.lastTripAt ? new Date(c.lastTripAt).toISOString().slice(0, 10) : "",
      c.vip ? "DA" : "",
      (c.routes ?? []).join(" | "),
      c.notes ?? "",
    ]);
    // CSV cu BOM UTF-8 ca Excel să detecteze diacriticele
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv =
      "﻿" +
      [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `clienti-davo-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function create(form: { firstName: string; lastName: string; email: string; phone: string; vip: boolean; notes: string }) {
    const res = await fetch("/api/admin/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.error ?? "Eroare la creare");
      return;
    }
    setCreating(false);
    load();
  }

  return (
    <div>
      <PageHeader
        title="Clienți"
        subtitle={`${clients.length} persoane cu rezervări`}
        actions={
          <>
            <button
              onClick={exportCsv}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
              title={filtered.length === 0 ? "Niciun client de exportat" : `Exportă ${filtered.length} clienți (Excel/CSV)`}
            >
              <Download className="h-3.5 w-3.5" /> Export Excel
            </button>
            <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-600">
              <Plus className="h-3.5 w-3.5" /> Client nou
            </button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Caută nume, email sau telefon…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:border-orange-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
        </div>
        <select
          value={routeFilter}
          onChange={(e) => setRouteFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-200 max-w-[280px]"
          title="Filtrează clienții după ruta pe care au mers"
        >
          <option value="all">Toate rutele</option>
          {allRoutes.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={onlyVip} onChange={(e) => setOnlyVip(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-300" />
          Doar VIP
        </label>
        <span className="ml-auto text-xs text-slate-500">{filtered.length} rezultate</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="Niciun client"
          description="Clienții apar automat când fac prima rezervare. Îi poți adăuga și manual."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left">Client</th>
                <th className="px-5 py-3 text-left">Contact</th>
                <th className="px-5 py-3 text-left">Rezervări</th>
                <th className="px-5 py-3 text-left">Total cheltuit</th>
                <th className="px-5 py-3 text-left">Ultima cursă</th>
                <th className="px-5 py-3 text-left">Rute</th>
                <th className="px-5 py-3 text-left">Etichete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-xs font-bold text-slate-700">
                        {c.firstName.charAt(0)}{c.lastName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{c.firstName} {c.lastName}</div>
                        {c.notes && <div className="text-xs text-slate-500 truncate max-w-[280px]">{c.notes}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Mail className="h-3 w-3" /> {c.email}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                      <Phone className="h-3 w-3" /> {c.phone}
                    </div>
                  </td>
                  <td className="px-5 py-3 font-semibold text-slate-900">{c.bookings}</td>
                  <td className="px-5 py-3 font-semibold text-slate-900">{c.totalSpent} €</td>
                  <td className="px-5 py-3 text-slate-600">
                    {c.lastTripAt ? dateFmt.format(new Date(c.lastTripAt)) : "—"}
                  </td>
                  <td className="px-5 py-3">
                    {!c.routes || c.routes.length === 0 ? (
                      <span className="text-xs text-slate-400">—</span>
                    ) : (
                      <div
                        className="flex flex-wrap gap-1 max-w-[260px]"
                        title={c.routes.join("\n")}
                      >
                        {c.routes.slice(0, 2).map((r) => (
                          <span
                            key={r}
                            className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                          >
                            <RouteIcon className="h-2.5 w-2.5 text-orange-500" />
                            <span className="max-w-[180px] truncate">{r}</span>
                          </span>
                        ))}
                        {c.routes.length > 2 && (
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                            +{c.routes.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {c.vip && (
                      <Badge variant="orange"><Star className="h-3 w-3" /> VIP</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {creating && <ClientModal onClose={() => setCreating(false)} onSave={create} />}
    </div>
  );
}

function ClientModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (f: { firstName: string; lastName: string; email: string; phone: string; vip: boolean; notes: string }) => void;
}) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", vip: false, notes: "" });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">Client nou</h3>
        </div>
        <form className="grid gap-4 px-5 py-4" onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prenume">
              <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={inputCls} required />
            </Field>
            <Field label="Nume">
              <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={inputCls} required />
            </Field>
          </div>
          <Field label="Email">
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} required />
          </Field>
          <Field label="Telefon">
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} required />
          </Field>
          <Field label="Notițe interne">
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className={inputCls} />
          </Field>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.vip} onChange={(e) => setForm({ ...form, vip: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-300" />
            Marchează ca VIP
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
