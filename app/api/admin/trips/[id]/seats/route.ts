import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Detalii pe scaun pentru o cursă — folosit de modalul de rezervare manuală
 * ca să arate la click cine a rezervat un anumit loc. Strict admin (gardat
 * de proxy + lib/permissions: ambii admin1 și admin2 au acces).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [seatBookings, allBookings] = await Promise.all([
      prisma.seatBooking.findMany({
        where: { tripId: id },
        orderBy: { seatNumber: "asc" },
        include: {
          booking: {
            select: {
              id: true,
              bookingNumber: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
              status: true,
              adults: true,
              children: true,
              type: true,
            },
          },
        },
      }),
      // Pasageri/colete atașate la această cursă (tripId sau returnTripId).
      // Le folosim ca să detectăm rezervările "fără loc asociat" — admin a
      // legat booking-ul de o cursă dar n-a apucat să aleagă locul concret.
      prisma.booking.findMany({
        where: {
          OR: [{ tripId: id }, { returnTripId: id }],
          status: { in: ["confirmed", "pending"] },
        },
        select: {
          id: true,
          bookingNumber: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          status: true,
          adults: true,
          children: true,
          type: true,
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const bookingsWithSeats = new Set(
      seatBookings.map((s) => s.booking?.id).filter((x): x is string => Boolean(x)),
    );
    const unassigned = allBookings.filter((b) => !bookingsWithSeats.has(b.id));

    return NextResponse.json({
      success: true,
      seats: seatBookings.map((s) => ({
        seatNumber: s.seatNumber,
        booking: s.booking
          ? {
              id: s.booking.id,
              bookingNumber: s.booking.bookingNumber,
              passengerName: `${s.booking.firstName} ${s.booking.lastName}`.trim(),
              phone: s.booking.phone,
              email: s.booking.email,
              status: s.booking.status,
              type: s.booking.type,
            }
          : null,
      })),
      // Pasageri legați de cursă dar fără SeatBooking — pot fi rezervări
      // manuale create înainte ca admin să selecteze locurile, sau date
      // legacy. Le afișăm separat ca să nu fie invizibile pentru admin.
      unassigned: unassigned.map((b) => ({
        id: b.id,
        bookingNumber: b.bookingNumber,
        passengerName: `${b.firstName} ${b.lastName}`.trim(),
        phone: b.phone,
        email: b.email,
        status: b.status,
        type: b.type,
        paxCount: Math.max(1, b.adults + b.children),
      })),
    });
  } catch (error) {
    console.error("admin/trips/[id]/seats GET", error);
    return NextResponse.json(
      { success: false, error: "Failed to load seats" },
      { status: 500 }
    );
  }
}
