import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendManifestForTrip, getTripManifestData } from "@/lib/adminTripManifest";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await getTripManifestData(id);
    if (!data) return NextResponse.json({ success: false, error: "Trip not found" }, { status: 404 });
    return NextResponse.json({ success: true, manifest: data });
  } catch (error) {
    console.error("admin/trips/[id] GET", error);
    return NextResponse.json({ success: false, error: "Failed to load trip" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    if (body.action === "send-manifest") {
      const res = await sendManifestForTrip(id, { force: !!body.force });
      if (!res.ok) {
        return NextResponse.json({ success: false, error: res.reason }, { status: 409 });
      }
      return NextResponse.json({ success: true, message: "Manifest trimis pe email admin." });
    }
    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("admin/trips/[id] POST", error);
    return NextResponse.json({ success: false, error: "Failed to process action" }, { status: 500 });
  }
}

const ALLOWED_STATUSES = new Set([
  "scheduled",
  "boarding",
  "en_route",
  "completed",
  "cancelled",
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const data: Record<string, unknown> = {};
    if (body.status !== undefined) {
      if (!ALLOWED_STATUSES.has(body.status)) {
        return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
      }
      data.status = body.status;
    }
    if (body.notes !== undefined) data.notes = body.notes || null;
    if (body.busId !== undefined) data.busId = body.busId;

    const trip = await prisma.trip.update({ where: { id }, data });
    return NextResponse.json({ success: true, trip });
  } catch (error) {
    console.error("admin/trips/[id] PATCH", error);
    return NextResponse.json({ success: false, error: "Failed to update trip" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const bookingCount = await prisma.booking.count({ where: { tripId: id } });
    if (bookingCount > 0) {
      return NextResponse.json(
        { success: false, error: `Cursa are ${bookingCount} rezervări. Anuleaz-o în loc să o ștergi.` },
        { status: 409 }
      );
    }
    await prisma.seatBooking.deleteMany({ where: { tripId: id } });
    await prisma.trip.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("admin/trips/[id] DELETE", error);
    return NextResponse.json({ success: false, error: "Failed to delete trip" }, { status: 500 });
  }
}
