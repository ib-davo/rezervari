import { prisma } from "@/lib/prisma";
import {
  arrivalFor,
  isOutboundActive,
  isReturnActive,
  nextDepartures,
} from "@/lib/schedule";

export type GenerateScope =
  | { scope: "all"; weeks: number }
  | { scope: "route"; routeId: string; weeks: number };

export type GenerateResult = {
  created: number;
  skipped: number;
  routes: number;
  reason?: string;
};

/**
 * Generează curse pentru `weeks` săptămâni înainte, pentru fiecare rută activă
 * a cărei țară-destinație are program setat.
 *
 * Comportament:
 * - "Dus" → folosește ruta `originCity → destinationCity` (cum e definită).
 *   Țara-destinație trebuie să aibă `outboundWeekday/Time/DurationHours`.
 * - "Retur" → folosește ruta inversă (dacă există ca Route activ).
 *   Țara de plecare a returului (= destinationCity din dus) trebuie să aibă
 *   `returnWeekday/Time/DurationHours`.
 * - Idempotent: nu duplică curse existente la același `(routeId, departureAt)`.
 * - Bus = primul `Bus.active` din DB (cel mai vechi). Capacity = bus.totalSeats.
 * - Status = "scheduled".
 */
export async function generateTrips(input: GenerateScope): Promise<GenerateResult> {
  const weeks = Math.max(1, Math.min(52, Number(input.weeks) || 8));

  const bus = await prisma.bus.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!bus) {
    return { created: 0, skipped: 0, routes: 0, reason: "Niciun autocar activ" };
  }

  // Strângem rutele țintă.
  const routes = await prisma.route.findMany({
    where: {
      active: true,
      ...(input.scope === "route" ? { id: input.routeId } : {}),
    },
    include: {
      originCity: { include: { country: true } },
      destinationCity: { include: { country: true } },
    },
  });

  let created = 0;
  let skipped = 0;
  const now = new Date();

  for (const r of routes) {
    const destCountry = r.destinationCity.country;
    const originCountry = r.originCity.country;

    // === DUS ===
    // Folosim programul "outbound" al țării-destinație (când pleacă spre acea țară).
    if (
      isOutboundActive(destCountry) &&
      destCountry.outboundWeekday !== null &&
      destCountry.outboundTime &&
      destCountry.outboundDurationHours
    ) {
      const deps = nextDepartures(
        destCountry.outboundWeekday,
        destCountry.outboundTime,
        weeks,
        now
      );
      for (const dep of deps) {
        const arr = arrivalFor(dep, destCountry.outboundDurationHours);
        const exists = await prisma.trip.findFirst({
          where: { routeId: r.id, departureAt: dep },
          select: { id: true },
        });
        if (exists) {
          skipped++;
          continue;
        }
        await prisma.trip.create({
          data: {
            routeId: r.id,
            busId: bus.id,
            departureAt: dep,
            arrivalAt: arr,
            capacity: bus.totalSeats,
            status: "scheduled",
          },
        });
        created++;
      }
    }

    // === RETUR ===
    // Folosim programul "return" al țării-destinație (când se întoarce ÎN Moldova
    // venind din acea țară). originCountry-ul rutei inverse = destCountry-ul rutei dus.
    // Dacă ruta inversă nu există, o creăm automat (preț + valută identice cu ruta dus).
    if (
      isReturnActive(destCountry) &&
      destCountry.returnWeekday !== null &&
      destCountry.returnTime &&
      destCountry.returnDurationHours
    ) {
      let inverse = await prisma.route.findUnique({
        where: {
          originCityId_destinationCityId: {
            originCityId: r.destinationCityId,
            destinationCityId: r.originCityId,
          },
        },
      });
      if (!inverse) {
        inverse = await prisma.route.create({
          data: {
            originCityId: r.destinationCityId,
            destinationCityId: r.originCityId,
            basePrice: r.basePrice,
            currency: r.currency,
            description: r.description,
            active: true,
            weeklyDepartures: r.weeklyDepartures,
          },
        });
      }
      if (inverse.active) {
        const deps = nextDepartures(
          destCountry.returnWeekday,
          destCountry.returnTime,
          weeks,
          now
        );
        for (const dep of deps) {
          const arr = arrivalFor(dep, destCountry.returnDurationHours);
          const exists = await prisma.trip.findFirst({
            where: { routeId: inverse.id, departureAt: dep },
            select: { id: true },
          });
          if (exists) {
            skipped++;
            continue;
          }
          await prisma.trip.create({
            data: {
              routeId: inverse.id,
              busId: bus.id,
              departureAt: dep,
              arrivalAt: arr,
              capacity: bus.totalSeats,
              status: "scheduled",
            },
          });
          created++;
        }
      }
    }

    // (originCountry e referențiat doar pentru viitoare extensii multidestinație.)
    void originCountry;
  }

  return { created, skipped, routes: routes.length };
}
