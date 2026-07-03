import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createOperatorToken, OPERATOR_COOKIE, operatorCookieOptions } from "@/lib/operatorSession";
import { loginBlockedSeconds, recordLoginFailure, recordLoginSuccess } from "@/lib/loginRateLimit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const slug = String(body?.slug ?? "").trim().toLowerCase();
    const pin = String(body?.pin ?? "").trim();

    if (!slug || !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ success: false, error: "Selectează operatorul și introdu PIN-ul (4 cifre)" }, { status: 400 });
    }

    // Anti brute-force: 5 PIN-uri greșite pe operator+IP → pauză 15 minute.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const rateKey = `${slug}|${ip}`;
    const blocked = loginBlockedSeconds(rateKey);
    if (blocked > 0) {
      return NextResponse.json(
        { success: false, error: `Prea multe încercări. Reîncearcă în ${Math.ceil(blocked / 60)} min.` },
        { status: 429 }
      );
    }

    const operator = await prisma.operator.findUnique({ where: { slug } });
    if (!operator || !operator.active) {
      recordLoginFailure(rateKey);
      return NextResponse.json({ success: false, error: "Operator inexistent sau inactiv" }, { status: 401 });
    }

    const ok = await bcrypt.compare(pin, operator.pinHash);
    if (!ok) {
      recordLoginFailure(rateKey);
      return NextResponse.json({ success: false, error: "PIN incorect" }, { status: 401 });
    }

    recordLoginSuccess(rateKey);
    await prisma.operator.update({ where: { id: operator.id }, data: { lastLogin: new Date() } });

    const token = await createOperatorToken({ id: operator.id, slug: operator.slug, name: operator.name });
    const res = NextResponse.json({ success: true, operator: { slug: operator.slug, name: operator.name } });
    res.cookies.set(OPERATOR_COOKIE, token, operatorCookieOptions());
    return res;
  } catch (e) {
    console.error("operator/login", e);
    return NextResponse.json({ success: false, error: "Eroare internă" }, { status: 500 });
  }
}
