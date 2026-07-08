import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperatorToken, OPERATOR_COOKIE } from "@/lib/operatorSession";

export const dynamic = "force-dynamic";

// Căutare clienți pentru autocomplete la rezervarea manuală: operatorul scrie
// 2-3 litere din nume / telefon / email și îi apar clienții existenți (din
// evidența Client, populată automat la fiecare rezervare).
export async function GET(req: NextRequest) {
  const session = await verifyOperatorToken(req.cookies.get(OPERATOR_COOKIE)?.value);
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ success: true, clients: [] });

  const clients = await prisma.client.findMany({
    where: {
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, vip: true },
    orderBy: { updatedAt: "desc" },
    take: 8,
  });

  return NextResponse.json({ success: true, clients });
}
