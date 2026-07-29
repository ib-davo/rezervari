import { NextRequest, NextResponse } from "next/server";
import { verifyOperatorToken, loadOperatorAccess, OPERATOR_COOKIE } from "@/lib/operatorSession";
import { effectiveOperatorPermissions, normalizeOperatorRole } from "@/lib/operatorPermissions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await verifyOperatorToken(req.cookies.get(OPERATOR_COOKIE)?.value);
  if (!session) return NextResponse.json({ success: false }, { status: 401 });
  // Rolul și permisiunile se citesc din DB (tokenul are doar {id,slug,name}).
  const access = await loadOperatorAccess(session.id);
  const role = normalizeOperatorRole(access?.role);
  // Permisiunile întoarse sunt cele EFECTIVE: pentru conturile fără listă
  // proprie e presetul rolului, ca panoul să arate exact ca înainte.
  const permissions = effectiveOperatorPermissions(role, access?.permissions);
  return NextResponse.json({
    success: true,
    operator: { ...session, role, isSupervisor: role === "supervisor", permissions },
  });
}
