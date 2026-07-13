import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperatorToken, OPERATOR_COOKIE } from "@/lib/operatorSession";
import { sendRescheduleConfirmation } from "@/lib/email";
import { enqueueRemindersOnly } from "@/lib/emailQueue";
import { occupiedSeatsForRun } from "@/lib/runSeats";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function toInts(x: unknown): number[] {
  return Array.isArray(x) ? x.map((n) => Number(n)).filter((n) => !Number.isNaN(n)) : [];
}
function timeOf(d: Date): string {
  return new Intl.DateTimeFormat("ro-RO", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Chisinau" }).format(d);
}

// Reprogramare: operatorul alege pentru o rezervare o DATĂ nouă + LOC nou (pe
// aceeași rută). Eliberează locul vechi, atribuie noul loc, mută data și îi
// trimite clientului email de confirmare a modificării.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyOperatorToken(req.cookies.get(OPERATOR_COOKIE)?.value);
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const newTripId = String(body.tripId || "");
    const seatNumbers = toInts(body.seatNumbers);
    const newReturnTripId: string | null = body.returnTripId ? String(body.returnTripId) : null;
    const returnSeatNumbers = toInts(body.returnSeatNumbers);

    if (!newTripId) return NextResponse.json({ success: false, error: "Alege o cursă nouă" }, { status: 400 });

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: {
        id: true, status: true, type: true, tripType: true, adults: true, children: true,
        firstName: true, email: true, bookingNumber: true, departureCity: true, arrivalCity: true,
        departureDate: true, returnDate: true, tripId: true, returnTripId: true,
      },
    });
    if (!booking) return NextResponse.json({ success: false, error: "Rezervare inexistentă" }, { status: 404 });
    if (booking.status === "cancelled") return NextResponse.json({ success: false, error: "Rezervarea e anulată" }, { status: 400 });

    const newTrip = await prisma.trip.findUnique({
      where: { id: newTripId },
      select: { id: true, departureAt: true, status: true },
    });
    if (!newTrip) return NextResponse.json({ success: false, error: "Cursă nouă inexistentă" }, { status: 400 });
    if (new Date(newTrip.departureAt) < new Date()) {
      return NextResponse.json({ success: false, error: "Cursa aleasă a plecat deja" }, { status: 400 });
    }

    const pax = booking.type === "parcel" ? 1 : Math.max(1, (booking.adults ?? 0) + (booking.children ?? 0));
    if (booking.type !== "parcel" && seatNumbers.length !== pax) {
      return NextResponse.json({ success: false, error: `Alege exact ${pax} ${pax === 1 ? "loc" : "locuri"}` }, { status: 400 });
    }

    const newReturnTrip = newReturnTripId
      ? await prisma.trip.findUnique({ where: { id: newReturnTripId }, select: { id: true, departureAt: true } })
      : null;

    // Locurile cerute trebuie să fie libere pe noua cursă (ignorând locurile
    // actuale ale ACESTEI rezervări, care oricum se eliberează).
    const checkSeatsFree = async (tripId: string, seats: number[]) => {
      if (seats.length === 0) return true;
      // Pe întreaga rulare fizică (toate trip-urile autobuzului din ziua aia),
      // nu doar pe trip-ul rutei — vezi lib/runSeats. Propriile locuri nu blochează.
      const occ = new Set(await occupiedSeatsForRun(tripId, id));
      return seats.every((n) => !occ.has(n));
    };
    if (!(await checkSeatsFree(newTripId, seatNumbers))) {
      return NextResponse.json({ success: false, error: "Unul din locurile alese e deja ocupat" }, { status: 409 });
    }
    if (newReturnTrip && !(await checkSeatsFree(newReturnTrip.id, returnSeatNumbers))) {
      return NextResponse.json({ success: false, error: "Loc retur ocupat" }, { status: 409 });
    }

    const oldDate = booking.departureDate;

    await prisma.$transaction(async (tx) => {
      // Eliberează locurile vechi (dus + retur) și pune-le pe cele noi.
      await tx.seatBooking.deleteMany({ where: { bookingId: id } });
      if (seatNumbers.length) {
        await tx.seatBooking.createMany({ data: seatNumbers.map((n) => ({ tripId: newTripId, seatNumber: n, bookingId: id })) });
      }
      if (newReturnTrip && returnSeatNumbers.length) {
        await tx.seatBooking.createMany({ data: returnSeatNumbers.map((n) => ({ tripId: newReturnTrip.id, seatNumber: n, bookingId: id })) });
      }
      await tx.booking.update({
        where: { id },
        data: {
          tripId: newTripId,
          departureDate: newTrip.departureAt,
          ...(newReturnTrip ? { returnTripId: newReturnTrip.id, returnDate: newReturnTrip.departureAt } : {}),
        },
      });
    });

    // Reprogramează reminderele + cererea de recenzie (cele vechi erau calculate
    // pe data veche — altfel „Cum a fost călătoria?" pleca ÎNAINTE de călătorie).
    await prisma.emailJob
      .updateMany({ where: { bookingId: id, type: { in: ["reminder_24h", "reminder_2h", "review_request"] }, status: { in: ["scheduled", "queued"] } }, data: { status: "cancelled" } })
      .catch(() => {});
    await enqueueRemindersOnly(id).catch((e) => console.error("enqueueReminders after reschedule:", e));

    // Email de confirmare a modificării (inline).
    let emailSent = false;
    if (booking.email) {
      const r = await sendRescheduleConfirmation({
        firstName: booking.firstName,
        departureCity: booking.departureCity,
        arrivalCity: booking.arrivalCity,
        oldDate,
        newDate: newTrip.departureAt,
        newTime: timeOf(newTrip.departureAt),
        seats: seatNumbers.slice().sort((a, b) => a - b).join(", "),
        bookingNumber: booking.bookingNumber,
        returnNewDate: newReturnTrip?.departureAt ?? null,
        email: booking.email,
      });
      emailSent = r.success;
      await prisma.emailLog
        .create({ data: { to: booking.email, subject: `Rezervare modificată — ${booking.bookingNumber}`, template: "reschedule", status: r.success ? "sent" : "failed", relatedId: booking.id, error: r.success ? null : (r.error ?? "").slice(0, 400) } })
        .catch(() => {});
    }

    return NextResponse.json({ success: true, newDate: newTrip.departureAt, seats: seatNumbers, emailSent });
  } catch (error) {
    console.error("operator/bookings/[id]/reschedule", error);
    return NextResponse.json({ success: false, error: "Eroare la reprogramare" }, { status: 500 });
  }
}
