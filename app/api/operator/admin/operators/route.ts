import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyOperatorSupervisor, OPERATOR_COOKIE } from "@/lib/operatorSession";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // scoate diacriticele
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// GET — lista operatorilor (pentru gestiune). Doar supervizor.
export async function GET(req: NextRequest) {
  const sup = await verifyOperatorSupervisor(req.cookies.get(OPERATOR_COOKIE)?.value);
  if (!sup) return NextResponse.json({ success: false, error: "Doar supervizorul" }, { status: 403 });

  const operators = await prisma.operator.findMany({
    select: {
      id: true, name: true, slug: true, role: true, active: true, lastLogin: true,
      _count: { select: { bookings: true } },
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return NextResponse.json({ success: true, operators, meId: sup.id });
}

// POST — adaugă operator. Doar supervizor.
export async function POST(req: NextRequest) {
  const sup = await verifyOperatorSupervisor(req.cookies.get(OPERATOR_COOKIE)?.value);
  if (!sup) return NextResponse.json({ success: false, error: "Doar supervizorul" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const pin = typeof body.pin === "string" ? body.pin.trim() : "";
  const role = body.role === "supervisor" ? "supervisor" : "operator";
  if (!name) return NextResponse.json({ success: false, error: "Nume lipsă" }, { status: 400 });
  if (!/^\d{4}$/.test(pin)) return NextResponse.json({ success: false, error: "PIN-ul trebuie să fie 4 cifre" }, { status: 400 });

  // slug unic din nume
  let slug = slugify(name) || "operator";
  const base = slug;
  for (let i = 2; await prisma.operator.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${base}-${i}`;

  const op = await prisma.operator.create({
    data: { name, slug, pinHash: await bcrypt.hash(pin, 10), role, active: true },
    select: { id: true, name: true, slug: true, role: true, active: true },
  });
  return NextResponse.json({ success: true, operator: op });
}
