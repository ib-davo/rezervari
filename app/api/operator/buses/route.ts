import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperatorToken, OPERATOR_COOKIE } from "@/lib/operatorSession";

export const dynamic = "force-dynamic";

// Lista autobuzelor active — pentru atribuirea manuală a unei rezervări la o
// cursă fizică (dropdown „Atribuie autocar" din panou).
export async function GET(req: NextRequest) {
  const session = await verifyOperatorToken(req.cookies.get(OPERATOR_COOKIE)?.value);
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const buses = await prisma.bus.findMany({
    where: { active: true },
    select: { id: true, label: true, plate: true, totalSeats: true, layoutJson: true },
    orderBy: { label: "asc" },
  });

  return NextResponse.json({ success: true, buses });
}
