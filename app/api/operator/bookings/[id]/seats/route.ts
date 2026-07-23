import { NextRequest, NextResponse } from "next/server";
import { verifyOperatorToken, OPERATOR_COOKIE } from "@/lib/operatorSession";
import { seatDataForBooking } from "@/lib/operatorSeats";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Locurile pe segmentele unei rezervări (dus / retur): schema autocarului,
// locurile ocupate de ALȚII (circuit-aware) și locurile proprii. Folosit de
// modalul de editare ca operatorul să vadă ce e liber și să schimbe locul.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyOperatorToken(req.cookies.get(OPERATOR_COOKIE)?.value);
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const segments = await seatDataForBooking(id);
  return NextResponse.json({ success: true, segments });
}
