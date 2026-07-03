import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  pending: "În procesare",
  confirmed: "Confirmat — preluăm la grafic",
  in_transit: "În tranzit spre Europa",
  out_for_delivery: "În livrare la destinatar",
  delivered: "Livrat",
  cancelled: "Anulat",
};

const PASSENGER_RESPONSE_LABELS: Record<string, string> = {
  confirmed: "Pasager confirmat",
  cancelled: "Anulat de pasager",
};

function maskName(name: string) {
  if (!name) return "";
  const parts = name.split(" ").filter(Boolean);
  return parts
    .map((p) => (p.length <= 2 ? p[0] + "." : p[0] + "***"))
    .join(" ");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const bookingNumber = (searchParams.get("bookingNumber") || "").trim();
  const phone = (searchParams.get("phone") || "").replace(/\D/g, "");

  if (!bookingNumber) {
    return NextResponse.json(
      { success: false, error: "Introdu numărul rezervării" },
      { status: 400 }
    );
  }

  const booking = await prisma.booking.findUnique({
    where: { bookingNumber: bookingNumber.toUpperCase() },
  });

  if (!booking) {
    return NextResponse.json(
      { success: false, error: "Rezervare negăsită. Verifică numărul." },
      { status: 404 }
    );
  }

  // Verificare suplimentară: dacă utilizatorul a introdus telefon, ultimele 4 cifre
  // trebuie să coincidă cu cele înregistrate. Fără telefon, returnăm doar info publică.
  let phoneOk = true;
  if (phone) {
    const stored = booking.phone.replace(/\D/g, "");
    phoneOk = stored.endsWith(phone.slice(-4));
  }

  if (!phoneOk) {
    return NextResponse.json(
      { success: false, error: "Telefonul nu corespunde cu rezervarea." },
      { status: 403 }
    );
  }

  return NextResponse.json({
    success: true,
    booking: {
      bookingNumber: booking.bookingNumber,
      type: booking.type,
      status: booking.status,
      statusLabel: STATUS_LABELS[booking.status] || booking.status,
      passengerResponse: booking.passengerResponse,
      passengerResponseLabel: booking.passengerResponse
        ? PASSENGER_RESPONSE_LABELS[booking.passengerResponse]
        : null,
      departureCity: booking.departureCity,
      arrivalCity: booking.arrivalCity,
      departureDate: booking.departureDate,
      returnDate: booking.returnDate,
      parcelDetails: booking.type === "parcel" ? booking.parcelDetails : null,
      payMethod: booking.payMethod,
      paymentStatus: booking.paymentStatus,
      // Date personale: doar masked
      recipient: maskName(`${booking.firstName} ${booking.lastName}`),
      createdAt: booking.createdAt,
      confirmedAt: booking.confirmedAt,
    },
  });
}
