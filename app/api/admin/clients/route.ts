import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const clients = await prisma.client.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        bookings: {
          select: {
            price: true,
            departureDate: true,
            status: true,
            departureCity: true,
            arrivalCity: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      clients: clients.map((c) => {
        const valid = c.bookings.filter((b) => b.status !== "cancelled");
        const lastTrip = valid
          .map((b) => b.departureDate.getTime())
          .sort((a, b) => b - a)[0];
        const routes = Array.from(
          new Set(valid.map((b) => `${b.departureCity} → ${b.arrivalCity}`)),
        ).sort();
        return {
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          phone: c.phone,
          vip: c.vip,
          notes: c.notes,
          bookings: valid.length,
          totalSpent: valid.reduce((s, b) => s + b.price, 0),
          lastTripAt: lastTrip ? new Date(lastTrip).toISOString() : null,
          routes,
        };
      }),
    });
  } catch (error) {
    console.error("admin/clients GET", error);
    return NextResponse.json({ success: false, error: "Failed to load clients" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, firstName, lastName, phone, vip, notes } = body;
    if (!email || !firstName || !lastName || !phone) {
      return NextResponse.json({ success: false, error: "Missing fields" }, { status: 400 });
    }
    const client = await prisma.client.create({
      data: { email, firstName, lastName, phone, vip: !!vip, notes: notes || null },
    });
    return NextResponse.json({ success: true, client });
  } catch (error: unknown) {
    console.error("admin/clients POST", error);
    const msg = error instanceof Error && error.message.includes("Unique") ? "Email deja înregistrat" : "Failed to create client";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
