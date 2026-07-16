"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X, Bus, User, Phone, Plus, Armchair } from "lucide-react";
import { BusSeatMap } from "@/components/booking/BusSeatMap";
import type { BusLayout } from "@/lib/adminMock";
import { expandPassengers, type ManifestBooking } from "@/lib/manifestRows";
import type { TripGroup } from "@/lib/tripManifest";

// Harta locurilor unei curse (operator): vezi ce/unde e ocupat pe autocar. Click
// pe un loc OCUPAT → cine l-a ocupat. Click pe locuri LIBERE → le selectezi și
// mergi la formular cu ele pre-alese.
export function SeatMapModal({ g, layout, onClose }: {
  g: TripGroup;
  layout: BusLayout | null;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [inspect, setInspect] = useState<{ seat: number; name: string; route: string; bookingNumber: string; phone: string } | null>(null);

  const active = useMemo(() => g.bookings.filter((b) => b.status !== "cancelled"), [g.bookings]);

  // locuri ocupate + cine le ocupă
  const { occupied, seatInfo } = useMemo(() => {
    const occ: number[] = [];
    const info = new Map<number, { name: string; route: string; bookingNumber: string; phone: string }>();
    for (const b of active) {
      const seats = (b.seatBookings || []).filter((s) => g.tripIds.includes(s.tripId)).map((s) => s.seatNumber);
      if (!seats.length) continue;
      occ.push(...seats);
      const pax = expandPassengers(b as unknown as ManifestBooking, seats);
      pax.forEach((px) => {
        const n = Number(px.seat);
        if (Number.isFinite(n)) info.set(n, { name: px.name, route: px.route, bookingNumber: b.bookingNumber, phone: b.phone });
      });
    }
    return { occupied: occ, seatInfo: info };
  }, [active, g.tripIds]);

  // link „rezervă pe locurile alese" — duce în formular cu cursa + locurile pre-selectate.
  const bookHref = useMemo(() => {
    const p = new URLSearchParams();
    if (g.add.tripId) p.set("tripId", g.add.tripId);
    if (g.add.from) p.set("from", g.add.from);
    if (g.add.to) p.set("to", g.add.to);
    if (g.add.date) p.set("date", g.add.date);
    if (g.add.countries?.length) p.set("countries", g.add.countries.join(","));
    if (selected.length) p.set("seats", selected.join(","));
    return `/panou/rezervare${p.toString() ? `?${p.toString()}` : ""}`;
  }, [g.add, selected]);

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60" onClick={onClose}>
      <div className="flex min-h-full items-start justify-center p-3 sm:p-4">
        <div className="w-full max-w-2xl rounded-2xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
          {/* Antet */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="inline-flex items-center gap-2 text-base font-extrabold text-[color:var(--navy-900)]">
                <Bus className="h-4 w-4 text-[color:var(--red-500)]" /> {g.busLabel || "Autocar"}{g.busPlate ? ` · ${g.busPlate}` : ""}
              </h3>
              <div className="mt-0.5 text-xs font-semibold text-[color:var(--ink-500)]">
                {g.from} → {g.to} · {occupied.length}/{g.capacity ?? "?"} ocupate
              </div>
            </div>
            <button onClick={onClose} className="rounded-full p-1.5 text-[color:var(--ink-500)] hover:bg-[color:var(--ink-50)]">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Cine ocupă locul inspectat */}
          {inspect && (
            <div className="mt-3 flex items-start justify-between gap-2 rounded-xl border border-orange-200 bg-orange-50 p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-bold text-[color:var(--navy-900)]">
                  <Armchair className="h-4 w-4 text-orange-500" /> Loc {inspect.seat} · <User className="h-3.5 w-3.5" /> {inspect.name}
                </div>
                <div className="mt-0.5 text-xs font-semibold text-[color:var(--navy-700)]">{inspect.route}</div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[color:var(--ink-500)]">
                  <span className="font-mono">{inspect.bookingNumber}</span>
                  {inspect.phone && <a href={`tel:${inspect.phone}`} className="inline-flex items-center gap-1 font-semibold text-[color:var(--navy-900)]"><Phone className="h-3 w-3" /> {inspect.phone}</a>}
                </div>
              </div>
              <button onClick={() => setInspect(null)} className="shrink-0 rounded-full p-1 text-[color:var(--ink-400)] hover:bg-white"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}

          {/* Harta */}
          <div className="mt-3">
            {layout ? (
              <BusSeatMap
                layout={layout}
                occupiedSeats={occupied}
                selected={selected}
                onSelect={setSelected}
                max={30}
                onSeatInspect={(n) => setInspect(seatInfo.get(n) ? { seat: n, ...seatInfo.get(n)! } : { seat: n, name: "necunoscut", route: "", bookingNumber: "", phone: "" })}
              />
            ) : (
              <div className="rounded-xl bg-[color:var(--ink-50)] px-3 py-8 text-center text-sm font-semibold text-[color:var(--ink-500)]">
                Autocarul nu are schemă de locuri.
              </div>
            )}
          </div>

          {/* Acțiune: rezervă pe locurile alese */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="text-xs font-semibold text-[color:var(--ink-500)]">
              {selected.length > 0 ? `Alese: ${selected.map((s) => `#${s}`).join(" ")}` : "Apasă pe locuri libere ca să le alegi · pe ocupate ca să vezi cine e"}
            </div>
            <Link
              href={bookHref}
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color:var(--red-500)] px-4 py-2 text-sm font-semibold text-white active:scale-95 transition-transform hover:bg-[color:var(--red-600)]"
            >
              <Plus className="h-4 w-4" /> {selected.length ? `Rezervă ${selected.length} ${selected.length === 1 ? "loc" : "locuri"}` : "Rezervare pe cursă"}
            </Link>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
