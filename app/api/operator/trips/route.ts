import { NextRequest, NextResponse } from "next/server";
import { verifyOperatorToken, OPERATOR_COOKIE } from "@/lib/operatorSession";
import { buildTripGroups } from "@/lib/tripGrouping";

export const dynamic = "force-dynamic";

// Vederea pe curse fizice — gruparea e în lib/tripGrouping (partajată cu exportul).
export async function GET(req: NextRequest) {
  const session = await verifyOperatorToken(req.cookies.get(OPERATOR_COOKIE)?.value);
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { groups, calendar, scheduledDays } = await buildTripGroups();
  return NextResponse.json({ success: true, groups, calendar, scheduledDays });
}
