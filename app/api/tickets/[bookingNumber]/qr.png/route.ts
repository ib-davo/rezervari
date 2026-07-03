import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateQrPng } from "@/lib/qr";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ bookingNumber: string }> }
) {
  const { bookingNumber } = await params;

  const booking = await prisma.booking.findUnique({
    where: { bookingNumber },
    select: { bookingNumber: true },
  });

  if (!booking) {
    return NextResponse.json(
      { success: false, error: "Booking not found" },
      { status: 404 }
    );
  }

  const png = await generateQrPng(booking.bookingNumber);

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
