"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Badge from "@/components/admin/Badge";
import SeatMapEditor from "@/components/admin/SeatMapEditor";
import { BusSeatMap } from "@/components/booking/BusSeatMap";
import { isMultiDeck, type BusLayout, type MockBus, type SeatLayout } from "@/lib/adminMock";

export default function BusDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [bus, setBus] = useState<MockBus | null>(null);
  const [layout, setLayout] = useState<BusLayout | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function fetchBus() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/buses/${id}`);
        const data = await res.json();
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (data?.success) {
          setBus(data.bus);
          setLayout(data.bus.layout);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchBus();
  }, [id]);

  async function save() {
    if (!layout) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/buses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout }),
      });
      const data = await res.json();
      if (data.success) {
        setBus((b) => (b ? { ...b, totalSeats: data.bus.totalSeats } : b));
        alert("Layout salvat.");
      } else {
        alert(data.error ?? "Eroare la salvare");
      }
    } finally {
      setSaving(false);
    }
  }

  if (notFound) {
    return (
      <div>
        <PageHeader title="Autocar inexistent" subtitle={`ID: ${id}`} />
        <Link href="/admin/buses" className="text-sm font-semibold text-orange-600">← Înapoi la listă</Link>
      </div>
    );
  }

  if (loading || !bus || !layout) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <Link href="/admin/buses" className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-3 w-3" /> Înapoi la autocare
      </Link>

      <PageHeader
        title={bus.label}
        subtitle={`${bus.model} · ${bus.plate} · ${bus.year}`}
        actions={
          <>
            <Badge variant={bus.active ? "green" : "slate"}>{bus.active ? "Activ" : "Inactiv"}</Badge>
            {!isMultiDeck(layout) && (
              <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 disabled:opacity-60">
                <Save className="h-3.5 w-3.5" /> {saving ? "Salvez…" : "Salvează layout"}
              </button>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900">
              {isMultiDeck(layout) ? "Schema autocar (multi-etaj)" : "Editor layout scaune"}
            </h2>
            <p className="text-xs text-slate-500">
              {isMultiDeck(layout)
                ? "Autocarul are mai multe etaje. Layout-ul se editează doar prin script (vezi scripts/migrate-astromega-multideck.ts); aici e doar preview."
                : "Click pe celulă pentru a cicla tipurile, sau alege o unealtă pentru a picta mai rapid."}
            </p>
          </div>
          {isMultiDeck(layout) ? (
            <BusSeatMap
              layout={layout}
              occupiedSeats={[]}
              selected={[]}
              onSelect={() => {}}
              max={0}
            />
          ) : (
            <SeatMapEditor initial={layout as SeatLayout} onChange={setLayout} />
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Detalii autocar</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <Row k="Plăcuță" v={bus.plate} />
              <Row k="Model" v={bus.model} />
              <Row k="An fabricație" v={String(bus.year)} />
              <Row k="Capacitate" v={`${bus.totalSeats} scaune`} />
              <Row k="Status" v={bus.active ? "Activ" : "Inactiv"} />
            </dl>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Legendă</h3>
            <ul className="mt-3 space-y-2 text-xs text-slate-600">
              <li className="flex items-center gap-2"><span className="inline-block h-4 w-4 rounded border border-orange-300 bg-orange-100" /> Scaun (numerotat automat)</li>
              <li className="flex items-center gap-2"><span className="inline-block h-4 w-4 rounded border border-dashed border-slate-300 bg-slate-100" /> Culoar</li>
              <li className="flex items-center gap-2"><span className="inline-block h-4 w-4 rounded border border-blue-300 bg-blue-100" /> Toaletă (WC)</li>
              <li className="flex items-center gap-2"><span className="inline-block h-4 w-4 rounded bg-slate-900" /> Poziție șofer</li>
              <li className="flex items-center gap-2"><span className="inline-block h-4 w-4 rounded border border-emerald-300 bg-emerald-50" /> Ieșire / ușă</li>
              <li className="flex items-center gap-2"><span className="inline-block h-4 w-4 rounded border border-amber-300 bg-amber-50" /> Scări</li>
              <li className="flex items-center gap-2"><span className="inline-block h-4 w-4 rounded border border-orange-300 bg-orange-50" /> Cafea / bar</li>
              <li className="flex items-center gap-2"><span className="inline-block h-4 w-4 rounded border border-dashed border-slate-200" /> Spațiu gol</li>
              <li className="flex items-center gap-2"><span className="inline-flex h-4 w-4 items-center justify-center rounded border border-rose-300 bg-rose-50 text-[9px] font-bold text-rose-600">47</span> Număr setat manual</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-slate-500">{k}</dt>
      <dd className="text-sm font-semibold text-slate-900">{v}</dd>
    </div>
  );
}
