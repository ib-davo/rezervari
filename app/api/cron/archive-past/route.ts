import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { activeCutoff, pastLegWhere } from "@/lib/activeWindow";

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

  // Arhivăm abia după fereastra din lib/activeWindow (aceeași folosită de panou
  // și de listele Active/Arhivă). Pragul vechi de 24h arhiva PERMANENT, la 02:00
  // noaptea, cursa care era încă pe drum spre Belgia/Anglia — pasagerii ei
  // dispăreau din panou fix în ziua în care autocarul îi transporta.
  const cutoff = activeCutoff();

  const res = await prisma.booking.updateMany({
    where: {
      archivedAt: null,
      OR: pastLegWhere(cutoff),
    },
    data: { archivedAt: new Date() },
  });

  return NextResponse.json({ success: true, archived: res.count });
}
