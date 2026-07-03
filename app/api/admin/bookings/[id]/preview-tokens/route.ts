import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createBookingToken, bookingResponseUrl } from "@/lib/bookingToken";
import { appUrl as resolveAppUrl } from "@/lib/appUrl";

export const dynamic = "force-dynamic";

// Endpoint admin pentru testare: returnează URL-urile V/X (Confirm/Anulez)
// pentru o rezervare, fără să trimită email. Util la dev pentru test rapid.
// Protejat de middleware (matcher /api/admin/*).
//
// Path param `id` poate fi:
//  - bookingNumber (DAVO-2026-XXX) — uzual, paste din admin/bookings UI
//  - booking.id (UUID) — rar, dacă cineva are doar UUID-ul
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lookup = id.toUpperCase().startsWith("DAVO-") || id.toUpperCase().startsWith("CLC-")
    ? { bookingNumber: id.toUpperCase() }
    : { id };

  const booking = await prisma.booking.findUnique({
    where: lookup,
    select: {
      bookingNumber: true,
      firstName: true,
      lastName: true,
      email: true,
      status: true,
      passengerResponse: true,
      passengerResponseAt: true,
    },
  });

  if (!booking) {
    return NextResponse.json(
      { success: false, error: "Booking not found" },
      { status: 404 }
    );
  }

  const appUrl = resolveAppUrl();

  const [confirmToken, cancelToken] = await Promise.all([
    createBookingToken(booking.bookingNumber, "confirm"),
    createBookingToken(booking.bookingNumber, "cancel"),
  ]);

  return NextResponse.json({
    success: true,
    booking,
    confirmUrl: bookingResponseUrl(appUrl, booking.bookingNumber, "confirm", confirmToken),
    cancelUrl: bookingResponseUrl(appUrl, booking.bookingNumber, "cancel", cancelToken),
    trackUrl: `${appUrl.replace(/\/$/, "")}/livrare?nr=${booking.bookingNumber}`,
    note: "Linkurile sunt valabile 60 de zile. Click-ul pe ele va actualiza booking.passengerResponse + status (la cancel).",
  });
}
