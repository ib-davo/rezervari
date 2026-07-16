import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyOperatorSupervisor, OPERATOR_COOKIE } from "@/lib/operatorSession";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// PATCH — modifică operator (nume, PIN, rol, activ). Doar supervizor.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sup = await verifyOperatorSupervisor(req.cookies.get(OPERATOR_COOKIE)?.value);
  if (!sup) return NextResponse.json({ success: false, error: "Doar supervizorul" }, { status: 403 });
  const { id } = await params;

  const target = await prisma.operator.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!target) return NextResponse.json({ success: false, error: "Operator inexistent" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: { name?: string; pinHash?: string; role?: string; active?: boolean } = {};

  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.pin === "string" && body.pin.trim() !== "") {
    if (!/^\d{4}$/.test(body.pin.trim())) return NextResponse.json({ success: false, error: "PIN-ul trebuie să fie 4 cifre" }, { status: 400 });
    data.pinHash = await bcrypt.hash(body.pin.trim(), 10);
  }
  if (body.role === "operator" || body.role === "supervisor") data.role = body.role;
  if (typeof body.active === "boolean") data.active = body.active;

  // Nu te bloca pe tine: supervizorul nu se poate demota / dezactiva singur.
  if (id === sup.id && (data.role === "operator" || data.active === false)) {
    return NextResponse.json({ success: false, error: "Nu te poți demota / dezactiva pe tine" }, { status: 400 });
  }
  // Nu lăsa sistemul fără niciun supervizor activ.
  if (target.role === "supervisor" && (data.role === "operator" || data.active === false)) {
    const others = await prisma.operator.count({ where: { role: "supervisor", active: true, id: { not: id } } });
    if (others === 0) return NextResponse.json({ success: false, error: "Trebuie să rămână cel puțin un supervizor activ" }, { status: 400 });
  }

  const op = await prisma.operator.update({
    where: { id }, data,
    select: { id: true, name: true, slug: true, role: true, active: true },
  });
  return NextResponse.json({ success: true, operator: op });
}

// DELETE — șterge operator. Doar supervizor. Refuză dacă are rezervări (atunci
// se dezactivează, ca să nu se piardă atribuirea) sau dacă ești tu.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sup = await verifyOperatorSupervisor(req.cookies.get(OPERATOR_COOKIE)?.value);
  if (!sup) return NextResponse.json({ success: false, error: "Doar supervizorul" }, { status: 403 });
  const { id } = await params;
  if (id === sup.id) return NextResponse.json({ success: false, error: "Nu te poți șterge pe tine" }, { status: 400 });

  const target = await prisma.operator.findUnique({ where: { id }, select: { _count: { select: { bookings: true } } } });
  if (!target) return NextResponse.json({ success: false, error: "Operator inexistent" }, { status: 404 });
  if (target._count.bookings > 0) {
    return NextResponse.json(
      { success: false, error: `Are ${target._count.bookings} rezervări atribuite — dezactivează-l în loc să-l ștergi (păstrează istoricul).` },
      { status: 409 }
    );
  }

  await prisma.operator.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
