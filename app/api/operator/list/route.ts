import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Public: doar numele + slug pentru ecranul de login (fără PIN, fără date sensibile).
export async function GET() {
  const operators = await prisma.operator.findMany({
    where: { active: true },
    select: { slug: true, name: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ success: true, operators });
}
