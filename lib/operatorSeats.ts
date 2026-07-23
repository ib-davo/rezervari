import { prisma } from "@/lib/prisma";
import { buildTripGroups } from "@/lib/tripGrouping";
import { computeSeatNumbers, isMultiDeck, type BusLayout } from "@/lib/adminMock";
import { occupiedSeatsForRun } from "@/lib/runSeats";

// Datele de locuri pentru editarea unei rezervări: pentru fiecare segment (dus /
// retur) — schema autocarului, locurile ocupate de ALȚII și locurile proprii.
// Ocuparea e calculată IDENTIC cu harta din panou (SeatMapModal): peste toate
// cursele-surori ale rulării + circuitul fizic DAW 077 (duminică↔luni împart
// aceleași locuri). Așa ce vede operatorul pe hartă == ce validăm la salvare ==
// nu se dublează niciun loc. Sursa unică de adevăr pentru GET și pentru PATCH.
export type SegmentSeats = {
  segment: "out" | "ret";
  tripId: string;
  busLabel: string | null;
  busPlate: string | null;
  layout: BusLayout | null;
  layoutSeats: number[]; // toate numerele valide din schemă
  occupied: number[]; // ocupate de ALȚII (circuit-aware) — neselectabile
  mine: number[]; // locurile acestei rezervări pe segment
  capacity: number | null;
};

// Toate numerele de scaun valide din schemă (peste toate etajele).
function layoutSeatNumbers(layout: BusLayout): number[] {
  const decks = isMultiDeck(layout) ? layout.decks.map((d) => d.layout) : [layout];
  const out: number[] = [];
  for (const d of decks) for (const n of computeSeatNumbers(d)) if (n != null) out.push(n);
  return out;
}

async function layoutForBus(busId: string | null): Promise<{ layout: BusLayout | null; label: string | null; plate: string | null }> {
  if (!busId) return { layout: null, label: null, plate: null };
  const bus = await prisma.bus.findUnique({ where: { id: busId }, select: { layoutJson: true, label: true, plate: true } });
  let layout: BusLayout | null = null;
  if (bus?.layoutJson) {
    try {
      layout = JSON.parse(bus.layoutJson) as BusLayout;
    } catch {
      layout = null;
    }
  }
  return { layout, label: bus?.label ?? null, plate: bus?.plate ?? null };
}

export async function seatDataForBooking(bookingId: string): Promise<SegmentSeats[]> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      tripId: true,
      returnTripId: true,
      seatBookings: { select: { tripId: true, seatNumber: true } },
    },
  });
  if (!booking) return [];

  const segs: { segment: "out" | "ret"; tripId: string }[] = [];
  if (booking.tripId) segs.push({ segment: "out", tripId: booking.tripId });
  if (booking.returnTripId && booking.returnTripId !== booking.tripId) {
    segs.push({ segment: "ret", tripId: booking.returnTripId });
  }
  if (segs.length === 0) return [];

  const { groups } = await buildTripGroups();
  const result: SegmentSeats[] = [];

  for (const s of segs) {
    const g = groups.find((x) => x.tripIds.includes(s.tripId));
    const mine = booking.seatBookings
      .filter((sb) => sb.tripId === s.tripId)
      .map((sb) => sb.seatNumber)
      .sort((a, b) => a - b);

    if (g) {
      // Ocupare peste rularea fizică + circuit, exact ca harta. Exclude propriile locuri.
      const tripUniverse = new Set([...g.tripIds, ...(g.circuitTripIds ?? [])]);
      const groupBookings = [...g.bookings, ...(g.circuitBookings ?? [])];
      const occ = new Set<number>();
      for (const b of groupBookings) {
        if (b.id === bookingId) continue;
        if (b.status === "cancelled") continue;
        for (const sb of b.seatBookings || []) {
          if (tripUniverse.has(sb.tripId)) occ.add(sb.seatNumber);
        }
      }
      const { layout, label, plate } = await layoutForBus(g.busId);
      result.push({
        segment: s.segment,
        tripId: s.tripId,
        busLabel: g.busLabel ?? label,
        busPlate: g.busPlate ?? plate,
        layout,
        layoutSeats: layout ? layoutSeatNumbers(layout) : [],
        occupied: [...occ].sort((a, b) => a - b),
        mine,
        capacity: g.capacity ?? null,
      });
    } else {
      // Fallback: cursa nu e într-un card (arhivată/în afara ferestrei) — folosim
      // ocuparea pe rulare (surori aceeași zi UTC), fără circuit. Ca la reschedule.
      const trip = await prisma.trip.findUnique({ where: { id: s.tripId }, select: { busId: true, capacity: true } });
      const { layout, label, plate } = await layoutForBus(trip?.busId ?? null);
      const occ = await occupiedSeatsForRun(s.tripId, bookingId);
      result.push({
        segment: s.segment,
        tripId: s.tripId,
        busLabel: label,
        busPlate: plate,
        layout,
        layoutSeats: layout ? layoutSeatNumbers(layout) : [],
        occupied: occ,
        mine,
        capacity: trip?.capacity ?? null,
      });
    }
  }

  return result;
}
