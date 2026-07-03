import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  confirmationHtml,
  reminder24hHtml,
  cancellationHtml,
  type ConfirmationData,
} from "@/lib/emailTemplates";
import { createBookingToken, bookingResponseUrl } from "@/lib/bookingToken";
import { appUrl as resolveAppUrl } from "@/lib/appUrl";

export const dynamic = "force-dynamic";

// Preview email pentru o rezervare, fără a trimite. Randează HTML-ul exact
// cum ar arăta în inbox, cu butoanele V/X funcționale (token real).
//
// Usage:
//   /api/admin/bookings/DAVO-2026-XXX/preview-email
//   /api/admin/bookings/DAVO-2026-XXX/preview-email?type=reminder_24h
//   /api/admin/bookings/DAVO-2026-XXX/preview-email?type=cancellation
//
// Tipuri valide: confirmation (default) | reminder_24h | cancellation

const VALID_TYPES = ["confirmation", "reminder_24h", "cancellation"] as const;
type EmailType = (typeof VALID_TYPES)[number];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const typeParam = (searchParams.get("type") || "confirmation").toLowerCase();
  const type: EmailType = (VALID_TYPES as readonly string[]).includes(typeParam)
    ? (typeParam as EmailType)
    : "confirmation";

  const lookup = id.toUpperCase().startsWith("DAVO-") || id.toUpperCase().startsWith("CLC-")
    ? { bookingNumber: id.toUpperCase() }
    : { id };

  const booking = await prisma.booking.findUnique({ where: lookup });

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
  const confirmUrl = bookingResponseUrl(appUrl, booking.bookingNumber, "confirm", confirmToken);
  const cancelUrl = bookingResponseUrl(appUrl, booking.bookingNumber, "cancel", cancelToken);
  const trackUrl = `${appUrl}/livrare?nr=${booking.bookingNumber}`;

  let html: string;

  if (type === "confirmation") {
    const data: ConfirmationData = {
      bookingNumber: booking.bookingNumber,
      type: booking.type as "passenger" | "parcel",
      tripType: (booking.tripType as "one-way" | "round-trip" | undefined) ?? undefined,
      firstName: booking.firstName,
      departureCity: booking.departureCity,
      arrivalCity: booking.arrivalCity,
      departureDate: booking.departureDate,
      returnDate: booking.returnDate,
      adults: booking.adults,
      children: booking.children,
      parcelDetails: booking.parcelDetails,
      price: booking.price,
      currency: booking.currency,
      payMethod: booking.payMethod,
    };
    html = confirmationHtml(data, { confirmUrl, cancelUrl });
  } else if (type === "reminder_24h") {
    html = reminder24hHtml(booking, { confirmUrl, cancelUrl });
  } else {
    html = cancellationHtml(booking);
  }

  // Bandă de preview deasupra emailului — vizibilă doar în browser, nu în inbox.
  const banner = `
<div style="position:sticky;top:0;z-index:9999;background:#0b2653;color:white;padding:10px 16px;font-family:system-ui,sans-serif;font-size:13px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;border-bottom:2px solid #e11e2b;">
  <div>
    <strong style="color:#ff7a85;">PREVIEW EMAIL</strong>
    · tip: <code style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px;">${type}</code>
    · pentru: <code style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px;">${booking.bookingNumber}</code>
  </div>
  <div style="display:flex;gap:6px;">
    <a href="?type=confirmation" style="color:white;background:rgba(255,255,255,0.1);padding:4px 10px;border-radius:4px;text-decoration:none;font-weight:${type === "confirmation" ? "700" : "400"};">confirmation</a>
    <a href="?type=reminder_24h" style="color:white;background:rgba(255,255,255,0.1);padding:4px 10px;border-radius:4px;text-decoration:none;font-weight:${type === "reminder_24h" ? "700" : "400"};">24h</a>
    <a href="?type=cancellation" style="color:white;background:rgba(255,255,255,0.1);padding:4px 10px;border-radius:4px;text-decoration:none;font-weight:${type === "cancellation" ? "700" : "400"};">cancel</a>
  </div>
</div>
`;

  // Inserăm banner-ul după <body>
  const withBanner = html.replace(/<body([^>]*)>/i, `<body$1>${banner}`);

  return new NextResponse(withBanner, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
