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

  const existing = await prisma.booking.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!existing) return NextResponse.json({ success: false, error: "Rezervare inexistentă" }, { status: 404 });

  const booking = await prisma.booking.update({ where: { id }, data, select: { id: true, status: true, paymentStatus: true, archivedAt: true } });

  // Aceleași efecte secundare ca anularea din email (vezi /api/bookings/respond):
  // altfel locurile rămân ocupate pe cursă și reminder-ele pleacă degeaba.
  if (data.status === "cancelled" && existing.status !== "cancelled") {
    await prisma.seatBooking.deleteMany({ where: { bookingId: booking.id } });
    // Oprește job-urile programate + pune în coadă emailul de anulare către client.
    await cancelForBooking(booking.id, true).catch((e) => console.error("cancelForBooking:", e));
  }
  // Re-confirmare după o anulare: re-programează reminder-ul 24h (cel vechi a
  // fost marcat cancelled). Locurile NU se realocă automat — se aleg din davo.
  if (data.status === "confirmed" && existing.status === "cancelled") {
    await enqueueRemindersOnly(booking.id).catch((e) => console.error("enqueueReminders:", e));
  }

  return NextResponse.json({ success: true, booking });
}
