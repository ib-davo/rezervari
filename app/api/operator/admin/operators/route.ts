import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  isMissingPermissionsColumn,
  verifyOperatorSection,
  OPERATOR_COOKIE,
  PERMISSIONS_UNAVAILABLE,
} from "@/lib/operatorSession";
import { parseOperatorPermissions } from "@/lib/operatorPermissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LIST_SELECT = {
  id: true,
  name: true,
  slug: true,
  role: true,
  active: true,
  lastLogin: true,
  _count: { select: { bookings: true } },
} as const;

const LIST_ORDER = [{ active: "desc" as const }, { name: "asc" as const }];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // scoate diacriticele
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Lista cu permisiuni cu tot; fără coloană (migrare neaplicată) toți ies cu
// lista goală, adică pe presetul rolului — exact ce se vedea înainte.
async function listOperators() {
  try {
    return await prisma.operator.findMany({
      select: { ...LIST_SELECT, permissions: true },
      orderBy: LIST_ORDER,
    });
  } catch (error) {
    if (!isMissingPermissionsColumn(error)) throw error;
    const rows = await prisma.operator.findMany({ select: LIST_SELECT, orderBy: LIST_ORDER });
    return rows.map((row) => ({ ...row, permissions: [] as string[] }));
  }
}

// Prisma pune `permissions` în ORICE insert (câmpul are `@default([])` în
// schemă), deci cât timp coloana lipsește n-ar mai merge nici simpla adăugare
// de operator. Atunci scriem rândul cu SQL brut, fără coloana nouă. Ramura
// dispare odată cu aplicarea migrării.
async function createOperator(data: {
  name: string;
  slug: string;
  pinHash: string;
  role: string;
  permissions: string[];
}) {
  try {
    return await prisma.operator.create({
      data: { ...data, active: true },
      select: { id: true, name: true, slug: true, role: true, active: true, permissions: true },
    });
  } catch (error) {
    if (!isMissingPermissionsColumn(error) || data.permissions.length > 0) throw error;
    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "Operator" ("id", "name", "slug", "pinHash", "role", "active", "createdAt", "updatedAt")
      VALUES (${id}, ${data.name}, ${data.slug}, ${data.pinHash}, ${data.role}, true, NOW(), NOW())
    `;
    return { id, name: data.name, slug: data.slug, role: data.role, active: true, permissions: [] };
  }
}

// GET — lista operatorilor (pentru gestiune). Cere permisiunea „operatori":
// pentru conturile fără listă proprie asta înseamnă tot supervizor, ca până acum.
export async function GET(req: NextRequest) {
  const me = await verifyOperatorSection(req.cookies.get(OPERATOR_COOKIE)?.value, "operatori");
  if (!me) {
    return NextResponse.json({ success: false, error: "Nu ai acces la gestiunea operatorilor" }, { status: 403 });
  }

  const operators = await listOperators();
  // Scrierea rămâne strict a supervizorului; permisiunea dă doar vizibilitate.
  return NextResponse.json({
    success: true,
    operators,
    meId: me.id,
    canWrite: me.role === "supervisor",
  });
}

// POST — adaugă operator. Doar supervizor (permisiunea „operatori" se adaugă
// peste verificarea de rol, nu o înlocuiește).
export async function POST(req: NextRequest) {
  const me = await verifyOperatorSection(req.cookies.get(OPERATOR_COOKIE)?.value, "operatori");
  if (!me || me.role !== "supervisor") {
    return NextResponse.json({ success: false, error: "Doar supervizorul" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const pin = typeof body.pin === "string" ? body.pin.trim() : "";
  const role = body.role === "supervisor" ? "supervisor" : "operator";
  if (!name) return NextResponse.json({ success: false, error: "Nume lipsă" }, { status: 400 });
  if (!/^\d{4}$/.test(pin)) return NextResponse.json({ success: false, error: "PIN-ul trebuie să fie 4 cifre" }, { status: 400 });

  // Lipsa câmpului sau lista goală = „folosește presetul rolului".
  const perms = parseOperatorPermissions(body.permissions);
  if (!perms.ok) return NextResponse.json({ success: false, error: perms.error }, { status: 400 });

  // slug unic din nume
  let slug = slugify(name) || "operator";
  const base = slug;
  for (let i = 2; await prisma.operator.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${base}-${i}`;

  try {
    const op = await createOperator({
      name,
      slug,
      pinHash: await bcrypt.hash(pin, 10),
      role,
      permissions: perms.permissions ?? [],
    });
    return NextResponse.json({ success: true, operator: op });
  } catch (error) {
    if (isMissingPermissionsColumn(error)) {
      return NextResponse.json({ success: false, error: PERMISSIONS_UNAVAILABLE }, { status: 503 });
    }
    throw error;
  }
}
