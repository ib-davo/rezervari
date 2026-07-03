import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createToken, COOKIE_NAME, cookieOptions } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email și parolă sunt obligatorii" },
        { status: 400 }
      );
    }

    const user = await prisma.adminUser.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Email sau parolă incorecte" },
        { status: 401 }
      );
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return NextResponse.json(
        { success: false, error: "Email sau parolă incorecte" },
        { status: 401 }
      );
    }

    await prisma.adminUser.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const token = await createToken(user.email);
    const res = NextResponse.json({ success: true });
    res.cookies.set(COOKIE_NAME, token, cookieOptions());
    return res;
  } catch (error) {
    console.error("auth/login", error);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
