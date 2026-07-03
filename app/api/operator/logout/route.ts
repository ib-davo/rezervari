import { NextResponse } from "next/server";
import { OPERATOR_COOKIE } from "@/lib/operatorSession";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(OPERATOR_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
