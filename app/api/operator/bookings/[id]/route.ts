import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperatorToken, OPERATOR_COOKIE } from "@/lib/operatorSession";
import { cancelForBooking, enqueueRemindersOnly } from "@/lib/emailQueue";

export const dynamic = "force-dynamic";

// Operatorul poate confirma / anula manual + marca plata. Statutul se vede instant
// și pe davo (aceeași tabelă Booking). passengerResponse rămâne sursa din email.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyOperatorToken(req.cookies.get(OPERATOR_COOKIE)?.value);
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = { updatedAt: new Date() };

  if (typeof body.status === "string" && ["pending", "confirmed", "cancelled"].includes(body.status)) {
    data.status = body.status;
    if (body.status === "confirmed") data.confirmedAt = new Date();
  }
  if (typeof body.paymentStatus === "string" && ["pending", "paid"].includes(body.paymentStatus)) {
    data.paymentStatus = body.paymentStatus;
    if (body.paymentStatus === "paid") data.paidAt = new Date();
  }
  if (body.archive === true) data.archivedAt = new Date();
  if (body.archive === false) data.archivedAt = null;

  // Atribuire autobuz manual (alătură rezervarea foii fizice a autobuzului).
  // string = Bus.id, null = scoate atribuirea. Validăm că autobuzul există.
  if (body.manualBusId === null) {
    data.manualBusId = null;
  } else if (typeof body.manualBusId === "string" && body.manualBusId.length > 0) {
    const bus = await prisma.bus.findFirst({ where: { id: body.manualBusId, active: true }, select: { id: true } });
    if (!bus) return NextResponse.json({ success: false, error: "Autocar inexistent sau inactiv" }, { status: 400 });
    data.manualBusId = bus.id;
  }

  const existing = await prisma.booking.findUnique({
    where: { id },
    select: { id: true, status: true, departureDate: true, returnDate: true, archivedAt: true },
  });
  if (!existing) return NextResponse.json({ success: false, error: "Rezervare inexistentă" }, { status: 404 });

  // O cursă care a plecat deja nu se mai anulează — ar elibera locuri degeaba
  // și ar trimite clientului email de anulare pentru o călătorie trecută (ex.
  // un tab vechi rămas deschis pe Active). Aceeași convenție de „trecut" ca în
  // GET: comparăm cu ORA reală de plecare (retur dacă există), nu cu ziua.
  if (data.status === "cancelled") {
    const last = existing.returnDate ?? existing.departureDate;
    if (existing.archivedAt || new Date(last) < new Date()) {
      return NextResponse.json(
        { success: false, error: "Cursa a plecat deja — rezervarea nu mai poate fi anulată." },
        { status: 400 }
      );
    }
  }

  // Anulare: tranziție atomică (doar UN request câștigă trecerea în cancelled),
  // ca două tab-uri/operatori concurenți să nu ruleze efectele secundare de 2 ori.
  let cancelledNow = false;
  if (data.status === "cancelled") {
    const r = await prisma.booking.updateMany({
      where: { id, status: { not: "cancelled" } },
      data,
    });
    cancelledNow = r.count > 0;
  } else {
    await prisma.booking.update({ where: { id }, data });
  }

  // Aceleași efecte secundare ca anularea din email (vezi /api/bookings/respond):
  // altfel locurile rămân ocupate pe cursă și reminder-ele pleacă degeaba.
  if (cancelledNow) {
    await prisma.seatBooking.deleteMany({ where: { bookingId: id } });
    // Oprește job-urile programate + pune în coadă emailul de anulare către client.
    await cancelForBooking(id, true).catch((e) => console.error("cancelForBooking:", e));
  }

  // Anulare din greșeală + re-confirmare imediată: retrage emailul de anulare
  // încă netrimis (altfel cron-ul davo îl livrează deși booking-ul e confirmat)
  // și repune reminder-ul 24h. Locurile NU se realocă automat — se aleg din davo.
  if (data.status === "confirmed" && existing.status === "cancelled") {
    await prisma.emailJob.updateMany({
      where: { bookingId: id, type: "cancellation", status: "queued", sentAt: null },
      data: { status: "cancelled" },
    });
    await enqueueRemindersOnly(id).catch((e) => console.error("enqueueReminders:", e));
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: { id: true, status: true, paymentStatus: true, archivedAt: true },
  });
  return NextResponse.json({ success: true, booking });
}
