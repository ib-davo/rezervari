import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperatorToken, OPERATOR_COOKIE } from "@/lib/operatorSession";

export const dynamic = "force-dynamic";

const SELECT = {
  id: true,
  bookingNumber: true,
  type: true,
  status: true,
  tripType: true,
  departureCity: true,
  arrivalCity: true,
  departureDate: true,
  returnDate: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  adults: true,
  children: true,
  price: true,
  currency: true,
  paymentStatus: true,
  payMethod: true,
  passengerResponse: true,
  passengerResponseAt: true,
  source: true,
  createdByName: true,
  createdAt: true,
  archivedAt: true,
  // Locurile — operatorul trebuie să le poată spune clientului la telefon.
  tripId: true,
  returnTripId: true,
  seatBookings: { select: { seatNumber: true, tripId: true }, orderBy: { seatNumber: "asc" as const } },
} as const;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(req: NextRequest) {
  const session = await verifyOperatorToken(req.cookies.get(OPERATOR_COOKIE)?.value);
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const scope = new URL(req.url).searchParams.get("scope") === "archived" ? "archived" : "active";
  const start = startOfToday();

  // O cursă "a avut loc" când a trecut ultima dată relevantă (retur dacă există, altfel plecarea).
  const where =
    scope === "active"
      ? {
          archivedAt: null,
          OR: [
            { returnDate: { gte: start } },
            { returnDate: null, departureDate: { gte: start } },
          ],
        }
      : {
          OR: [
            { archivedAt: { not: null } },
            { returnDate: null, departureDate: { lt: start } },
            { returnDate: { not: null, lt: start } },
          ],
        };

  const bookings = await prisma.booking.findMany({
    where,
    select: SELECT,
    orderBy: scope === "active" ? { departureDate: "asc" } : { departureDate: "desc" },
    take: scope === "archived" ? 300 : 1000,
  });

  return NextResponse.json({ success: true, scope, bookings });
}
