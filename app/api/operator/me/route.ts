import { NextRequest, NextResponse } from "next/server";
import { verifyOperatorToken, OPERATOR_COOKIE } from "@/lib/operatorSession";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await verifyOperatorToken(req.cookies.get(OPERATOR_COOKIE)?.value);
  if (!session) return NextResponse.json({ success: false }, { status: 401 });
  return NextResponse.json({ success: true, operator: session });
}
