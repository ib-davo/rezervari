import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendBookingConfirmation, BookingConfirmationData } from "@/lib/email";
import { appUrl as resolveAppUrl } from "@/lib/appUrl";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) {
      return NextResponse.json(
        { success: false, error: "Booking not found" },
        { status: 404 }
      );
    }

    const appUrl = resolveAppUrl();
    const ticketUrl =
      booking.ticketUrl ||
      `${appUrl}/bilet/${booking.bookingNumber}`;

    const data: BookingConfirmationData = {
      bookingNumber: booking.bookingNumber,
      type: booking.type as "passenger" | "parcel",
      tripType: booking.tripType as "one-way" | "round-trip",
      firstName: booking.firstName,
      lastName: booking.lastName,
      email: booking.email,
      phone: booking.phone,
      departureCity: booking.departureCity,
      arrivalCity: booking.arrivalCity,
      departureDate: booking.departureDate,
      returnDate: booking.returnDate,
      adults: booking.adults,
      children: booking.children,
      parcelDetails: booking.parcelDetails,
      price: booking.price,
      currency: booking.currency,
      ticketUrl,
    };

    const result = await sendBookingConfirmation(data);

    await prisma.emailLog.create({
      data: {
        to: booking.email,
        subject: `Confirmare Rezervare DAVO - ${booking.bookingNumber} (retrimitere)`,
        template: "booking-confirmation-resend",
        status: result.success ? "sent" : "failed",
        relatedId: booking.id,
        error: result.error,
      },
    });

    if (result.success) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { emailSent: true, emailSentAt: new Date() },
      });
    }

    return NextResponse.json({ success: result.success, error: result.error });
  } catch (error) {
    console.error("Resend email error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to resend email" },
      { status: 500 }
    );
  }
}
