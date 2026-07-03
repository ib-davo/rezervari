import { NextResponse } from "next/server";
import { processEmailQueue } from "@/lib/emailQueue";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const results = await processEmailQueue();
    return NextResponse.json({ success: true, ...results, at: new Date().toISOString() });
  } catch (error) {
    console.error("admin/emails/run", error);
    const msg = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
