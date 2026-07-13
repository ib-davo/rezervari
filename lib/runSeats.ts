import { prisma } from "@/lib/prisma";

// O RULARE fizică = toate Trip-urile aceluiași autobuz din aceeași ZI (UTC).
// Fiecare rută (oraș de origine/destinație) are propriul rând Trip, dar
// autobuzul e UNUL: locul 1 vândut pe Bruxelles→Chișinău e ocupat și pentru
// Gent→Chișinău în aceeași zi. Ocuparea trebuie deci unită peste toate
// trip-urile-surori — altfel harta arată locul liber și se poate vinde de 2 ori.
//
// Gruparea pe ZI UTC (identică cu runKey, folosită și de lista de curse):
// plecările reale sunt 04:00–17:00 UTC, deci bucketul e stabil și separă corect
// returul de duminică 16:00 UTC de plecarea de luni 04:00 UTC — o fereastră
// ±12h le-ar uni greșit (sunt rulări diferite, la exact 12h distanță).

export async function siblingTripIds(tripId: string): Promise<string[]> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { busId: true, departureAt: true },
  });
  if (!trip) return [tripId];
  const dayStart = new Date(trip.departureAt);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
  const sibs = await prisma.trip.findMany({
    where: {
      busId: trip.busId,
      departureAt: { gte: dayStart, lt: dayEnd },
    },
    select: { id: true },
  });
  return sibs.length > 0 ? sibs.map((s) => s.id) : [tripId];
}

// Locurile ocupate pe întreaga rulare (toate trip-urile-surori). excludeBookingId
// e pentru reprogramare: locurile propriei rezervări nu trebuie să blocheze.
export async function occupiedSeatsForRun(tripId: string, excludeBookingId?: string): Promise<number[]> {
  const ids = await siblingTripIds(tripId);
  const rows = await prisma.seatBooking.findMany({
    where: {
      tripId: { in: ids },
      ...(excludeBookingId ? { bookingId: { not: excludeBookingId } } : {}),
    },
    select: { seatNumber: true },
  });
  return [...new Set(rows.map((r) => r.seatNumber))].sort((a, b) => a - b);
}

// Cheia rulării pentru grupări în listă (bus + ziua UTC a plecării — orele reale
// 07:00–19:00 MD cad mereu în aceeași zi UTC, deci bucketul e stabil).
export function runKey(busId: string, departureAt: Date): string {
  return `${busId}|${departureAt.toISOString().slice(0, 10)}`;
}
