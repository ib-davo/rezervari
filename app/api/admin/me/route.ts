import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, COOKIE_NAME } from "@/lib/session";
import { normalizeRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// Identitate curentă pentru UI-ul admin (sidebar / TopBar). Întotdeauna
// 401 când nu e logat (proxy-ul ar fi trebuit să oprească oricum, dar
// dublu-verificăm).
export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const user = await prisma.adminUser.findUnique({
    where: { email: session.email },
    select: { email: true, name: true, role: true },
  });
  if (!user) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  }
  return NextResponse.json({
    success: true,
    user: { email: user.email, name: user.name, role: normalizeRole(user.role) },
  });
}
