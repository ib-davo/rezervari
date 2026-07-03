import { prisma } from "@/lib/prisma";

/**
 * După ce un booking e creat sau confirmat, încercăm să-l legăm automat de:
 *  - Trip-ul corespunzător (aceeași rută origine→destinație, aceeași zi)
 *  - Client-ul existent sau nou-creat (cheie = email)
 *
 * Logica e tolerantă: dacă nu găsim Trip (sau orașele nu matchează în DB),
 * booking-ul rămâne valid cu tripId=null. Admin vede asta la /admin/bookings.
 */
export async function autoLinkTripAndClient(bookingId: string): Promise<{
  linkedTrip: boolean;
  linkedClient: boolean;
  createdClient: boolean;
}> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return { linkedTrip: false, linkedClient: false, createdClient: false };

  const updates: {
    tripId?: string;
    clientId?: string;
  } = {};
  let createdClient = false;

  // 1. Link Trip — sare peste matching dacă tripId e deja setat (ex: flow-ul
  // public cu selecție explicită de Trip). Altfel încearcă match pe nume oraș +
  // ziua plecării (flow legacy fără selecție de Trip).
  if (!booking.tripId) {
    const originCity = await prisma.city.findFirst({
      where: { name: booking.departureCity, isOrigin: true },
    });
    const destCity = await prisma.city.findFirst({
      where: { name: booking.arrivalCity, isOrigin: false },
    });

    if (originCity && destCity) {
      const route = await prisma.route.findUnique({
        where: {
          originCityId_destinationCityId: {
            originCityId: originCity.id,
            destinationCityId: destCity.id,
          },
        },
      });

      if (route) {
        const dayStart = new Date(booking.departureDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const trip = await prisma.trip.findFirst({
          where: {
            routeId: route.id,
            departureAt: { gte: dayStart, lt: dayEnd },
            status: { in: ["scheduled", "boarding"] },
          },
          orderBy: { departureAt: "asc" },
        });

        if (trip) updates.tripId = trip.id;
      }
    }
  }

  // 2. Link / creează Client pe baza email-ului
  if (!booking.clientId && booking.email) {
    const existing = await prisma.client.findUnique({ where: { email: booking.email } });
    if (existing) {
      updates.clientId = existing.id;
    } else {
      const created = await prisma.client.create({
        data: {
          email: booking.email,
          firstName: booking.firstName,
          lastName: booking.lastName,
          phone: booking.phone,
        },
      });
      updates.clientId = created.id;
      createdClient = true;
    }
  }

  if (Object.keys(updates).length > 0) {
    await prisma.booking.update({ where: { id: bookingId }, data: updates });
  }

  return {
    linkedTrip: !!updates.tripId,
    linkedClient: !!updates.clientId,
    createdClient,
  };
}
