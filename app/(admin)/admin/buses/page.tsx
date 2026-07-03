"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Armchair, Pencil, Bus as BusIcon, Power } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Badge from "@/components/admin/Badge";
import type { MockBus, SeatLayout } from "@/lib/adminMock";

function defaultLayout(rows = 12, cols = 5): SeatLayout {
  const cells: SeatLayout["cells"] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === 0 && c === 0) cells.push("driver");
      else if (c === 2) cells.push("aisle");
      else if (r === rows - 1 && c === cols - 1) cells.push("wc");
      else cells.push("seat");
    }
  }
  return { rows, cols, cells };
}

export default function BusesPage() {
  const [buses, setBuses] = useState<MockBus[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/buses");
      const data = await res.json();
      if (data?.success) setBuses(data.buses);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggle(b: MockBus) {
    const res = await fetch(`/api/admin/buses/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !b.active }),
    });
    if ((await res.json()).success) load();
  }

  async function create(form: { plate: string; label: string; model: string; year: number }) {
    const res = await fetch("/api/admin/buses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, layout: defaultLayout() }),
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.error ?? "Eroare la creare autocar");
      return;
    }
    setCreating(false);
    load();
  }

  return (
    <div>
      <PageHeader
        title="Autocare"
        subtitle={`${buses.length} autocare în flotă`}
        actions={
          <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-600">
            <Plus className="h-3.5 w-3.5" /> Autocar nou
          </button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {buses.map((bus) => (
            <article key={bus.id} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                      <BusIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-slate-900 truncate">{bus.label}</h3>
                      <p className="text-xs text-slate-500 truncate">{bus.model}</p>
                    </div>
                  </div>
                </div>
                <Badge variant={bus.active ? "green" : "slate"}>{bus.active ? "Activ" : "Inactiv"}</Badge>
              </div>

              <dl className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Nr.</dt>
                  <dd className="mt-0.5 font-mono text-sm font-bold text-slate-900">{bus.plate}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">An</dt>
                  <dd className="mt-0.5 text-sm font-bold text-slate-900">{bus.year}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Scaune</dt>
                  <dd className="mt-0.5 flex items-center justify-center gap-1 text-sm font-bold text-slate-900">
                    <Armchair className="h-3 w-3 text-orange-500" /> {bus.totalSeats}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <button onClick={() => toggle(bus)} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100">
                  <Power className="h-3.5 w-3.5" />
                  {bus.active ? "Dezactivează" : "Activează"}
                </button>
                <Link href={`/admin/buses/${bus.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">
                  <Pencil className="h-3.5 w-3.5" /> Editează layout
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      {creating && <BusCreateModal onClose={() => setCreating(false)} onSave={create} />}
    </div>
  );
}

function BusCreateModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (f: { plate: string; label: string; model: string; year: number }) => void;
}) {
  const [form, setForm] = useState({ plate: "", label: "", model: "", year: new Date().getFullYear() });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">Autocar nou</h3>
          <p className="mt-0.5 text-xs text-slate-500">Layout-ul de scaune îl editezi după creare (12×5 default).</p>
        </div>
        <form className="grid gap-4 px-5 py-4" onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
          <Field label="Număr înmatriculare">
            <input value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} className={inputCls} required placeholder="ex. CJ 12 DAV" />
          </Field>
          <Field label="Etichetă (afișată)">
            <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className={inputCls} required placeholder="ex. Setra S 516 HD" />
          </Field>
          <Field label="Model complet">
            <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className={inputCls} placeholder="ex. Setra ComfortClass" />
          </Field>
          <Field label="An fabricație">
            <input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} className={inputCls} />
          </Field>
          <div className="mt-2 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Anulează</button>
            <button type="submit" className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600">Creează</button>
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
