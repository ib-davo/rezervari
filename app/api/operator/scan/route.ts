import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperatorToken, OPERATOR_COOKIE } from "@/lib/operatorSession";

export const dynamic = "force-dynamic";

// Scanner QR îmbarcare: caută rezervarea după numărul de bilet (din QR-ul de pe
// bilet, care encodează davo.md/bilet/DAVO-XXXX-XXXXXX, sau introdus manual).
export async function GET(req: NextRequest) {
  const session = await verifyOperatorToken(req.cookies.get(OPERATOR_COOKIE)?.value);
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const raw = (req.nextUrl.searchParams.get("nr") || "").trim().toUpperCase();
  // Acceptă și URL-ul întreg din QR — extragem numărul de bilet.
  const m = raw.match(/DAVO-\d{4}-[A-Z0-9]+/);
  const nr = m ? m[0] : raw;
  if (!nr) return NextResponse.json({ success: false, error: "Număr de bilet lipsă" }, { status: 400 });

  const b = await prisma.booking.findUnique({
    where: { bookingNumber: nr },
    select: {
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
      phone: true,
      adults: true,
      children: true,
      price: true,
      currency: true,
      paymentStatus: true,
      notes: true,
      boardedAt: true,
      boardedBy: true,
      baggageSurplus: true,
      tripId: true,
      returnTripId: true,
      seatBookings: { select: { seatNumber: true, tripId: true }, orderBy: { seatNumber: "asc" } },
      trip: { select: { departureAt: true, bus: { select: { label: true, plate: true } } } },
    },
  });
  if (!b) return NextResponse.json({ success: false, error: `Biletul ${nr} nu există` }, { status: 404 });

  return NextResponse.json({ success: true, booking: b });
}
