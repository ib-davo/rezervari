import { NextRequest, NextResponse } from "next/server";
import { generateTrips, type GenerateScope } from "@/lib/tripGenerator";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<{
      scope: "all" | "route";
      routeId: string;
      weeks: number;
    }>;
    const weeks = Number(body.weeks) || 8;
    const input: GenerateScope =
      body.scope === "route" && body.routeId
        ? { scope: "route", routeId: body.routeId, weeks }
        : { scope: "all", weeks };

    const result = await generateTrips(input);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("admin/trips/generate POST", error);
    const msg = error instanceof Error ? error.message : "Failed to generate trips";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
