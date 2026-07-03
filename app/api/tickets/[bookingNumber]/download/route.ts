import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Strategie: redirecționăm către /bilet/[bookingNumber]?print=1 care
// auto-deschide print dialog-ul browserului. Utilizatorul alege "Save as PDF"
// și obține un PDF real generat de browser, cu fonturile site-ului.
// Avantaj: fără chromium/puppeteer pe Vercel, layout identic cu site-ul.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookingNumber: string }> }
) {
  const { bookingNumber } = await params;

  const booking = await prisma.booking.findUnique({
    where: { bookingNumber },
    select: { id: true },
  });

  if (!booking) {
    return NextResponse.json(
      { success: false, error: "Booking not found" },
      { status: 404 }
    );
  }

  const url = new URL(`/bilet/${bookingNumber}`, request.url);
  url.searchParams.set("print", "1");
  return NextResponse.redirect(url, { status: 303 });
}
