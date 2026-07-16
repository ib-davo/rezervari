import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperatorToken, OPERATOR_COOKIE } from "@/lib/operatorSession";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await verifyOperatorToken(req.cookies.get(OPERATOR_COOKIE)?.value);
  if (!session) return NextResponse.json({ success: false }, { status: 401 });
  // Rolul se citește din DB (tokenul are doar {id,slug,name}). Supervizorul
  // (Adrian) vede meniul de gestiune a operatorilor.
  const op = await prisma.operator.findUnique({ where: { id: session.id }, select: { role: true } });
  const role = op?.role ?? "operator";
  return NextResponse.json({
    success: true,
    operator: { ...session, role, isSupervisor: role === "supervisor" },
  });
}
