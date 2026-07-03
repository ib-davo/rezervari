import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const jobs = await prisma.emailJob.findMany({
      orderBy: { sendAt: "desc" },
      include: { booking: { select: { bookingNumber: true, email: true } } },
      take: 200,
    });

    const stats = {
      sent: await prisma.emailJob.count({ where: { status: "sent" } }),
      failed: await prisma.emailJob.count({ where: { status: "failed" } }),
      queued: await prisma.emailJob.count({ where: { status: "queued" } }),
      scheduled: await prisma.emailJob.count({ where: { status: "scheduled" } }),
    };

    return NextResponse.json({
      success: true,
      stats,
      jobs: jobs.map((j) => ({
        id: j.id,
        type: j.type,
        to: j.booking?.email ?? "—",
        subject: subjectForType(j.type, j.booking?.bookingNumber ?? ""),
        status: j.status,
        sendAt: j.sendAt.toISOString(),
        sentAt: j.sentAt?.toISOString() ?? null,
        bookingNumber: j.booking?.bookingNumber ?? "—",
        error: j.lastError,
      })),
    });
  } catch (error) {
    console.error("admin/emails GET", error);
    return NextResponse.json({ success: false, error: "Failed to load emails" }, { status: 500 });
  }
}

function subjectForType(type: string, bookingNumber: string) {
  switch (type) {
    case "confirmation":
      return `Confirmare rezervare #${bookingNumber}`;
    case "reminder_24h":
      return "Mâine pleci în călătorie cu DAVO";
    case "cancellation":
      return `Rezervarea ta #${bookingNumber} a fost anulată`;
    default:
      return "DAVO Group";
  }
}
