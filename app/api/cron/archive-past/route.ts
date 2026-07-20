import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Marchează ca arhivate rezervările a căror cursă a trecut (retur dacă există, altfel plecarea).
// Filtrarea în panou se face oricum pe ora reală de plecare (vezi /api/operator/bookings),
// dar setarea archivedAt face arhiva permanentă. Comparăm cu momentul curent, la fel ca acolo.
// Protejat cu CRON_SECRET (header `Authorization: Bearer <CRON_SECRET>` sau ?key=).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    const key = new URL(req.url).searchParams.get("key");
    if (auth !== `Bearer ${secret}` && key !== secret) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  // Arhivăm abia la 24h DUPĂ plecare (retur dacă există), aliniat cu vizibilitatea
  // din panou (loadBookings folosește același prag now−24h). Altfel cursele care
  // tocmai au plecat azi ar dispărea permanent din panou în aceeași zi.
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const res = await prisma.booking.updateMany({
    where: {
      archivedAt: null,
      OR: [
        { returnDate: null, departureDate: { lt: cutoff } },
        { returnDate: { not: null, lt: cutoff } },
      ],
    },
    data: { archivedAt: new Date() },
  });

  return NextResponse.json({ success: true, archived: res.count });
}
