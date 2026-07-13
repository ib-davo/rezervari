import type { Booking, EmailJob } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendBookingConfirmation, getResend } from "@/lib/email";
import {
  reminder24hHtml,
  cancellationHtml,
  reviewRequestHtml,
  subjectForType,
} from "@/lib/emailTemplates";
import { createBookingToken, bookingResponseUrl } from "@/lib/bookingToken";
import { appUrl as resolveAppUrl, publicAppUrl } from "@/lib/appUrl";
import { dayBeforeAtLocal } from "@/lib/schedule";

async function buildResponseUrls(bookingNumber: string) {
  const appUrl = resolveAppUrl();
  try {
    const [confirmToken, cancelToken] = await Promise.all([
      createBookingToken(bookingNumber, "confirm"),
      createBookingToken(bookingNumber, "cancel"),
    ]);
    return {
      confirmUrl: bookingResponseUrl(appUrl, bookingNumber, "confirm", confirmToken),
      cancelUrl: bookingResponseUrl(appUrl, bookingNumber, "cancel", cancelToken),
      trackUrl: `${appUrl.replace(/\/$/, "")}/livrare?nr=${bookingNumber}`,
    };
  } catch {
    // SESSION_SECRET lipsește — emailul merge oricum, doar fără butoane V/X
    return { confirmUrl: undefined, cancelUrl: undefined, trackUrl: undefined };
  }
}

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 15 * 60 * 1000;

/**
 * Când un booking este confirmat: enqueue confirmation + reminder_24h.
 * Skipează tipurile care există deja pentru booking-ul respectiv.
 * Reminderele din trecut nu se creează.
 */
export async function enqueueForBooking(bookingId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return { enqueued: 0 };
  // Rezervările de operator pot fi fără email — n-avem cui trimite.
  if (!booking.email) return { enqueued: 0 };

  const existing = await prisma.emailJob.findMany({
    where: { bookingId, status: { notIn: ["cancelled", "failed"] } },
    select: { type: true },
  });
  const have = new Set(existing.map((e) => e.type));

  const now = new Date();
  const dep = booking.departureDate;
  // Reminder = ziua dinainte de plecare la 08:00 ora locală Moldova. Constant
  // dimineața — vezi dayBeforeAtLocal pentru raționament.
  const dep24 = dayBeforeAtLocal(dep, 8, 0);

  const jobs: Array<{ type: string; sendAt: Date; status: string }> = [];
  if (!have.has("confirmation")) {
    jobs.push({ type: "confirmation", sendAt: now, status: "queued" });
  }
  if (!have.has("reminder_24h") && dep24 > now) {
    jobs.push({ type: "reminder_24h", sendAt: dep24, status: "scheduled" });
  }
  // Recenzie: la 2 zile după ultima etapă a călătoriei (retur dacă există).
  const lastLeg = booking.returnDate ?? booking.departureDate;
  const reviewAt = new Date(new Date(lastLeg).getTime() + 2 * 24 * 3600 * 1000);
  if (booking.type !== "parcel" && !have.has("review_request") && reviewAt > now) {
    jobs.push({ type: "review_request", sendAt: reviewAt, status: "scheduled" });
  }

  if (jobs.length === 0) return { enqueued: 0 };

  await prisma.emailJob.createMany({
    data: jobs.map((j) => ({ ...j, bookingId })),
  });

  return { enqueued: jobs.length };
}

/**
 * Variantă a enqueueForBooking care sare peste `confirmation` — folosită când
 * flow-ul public trimite confirmation-ul inline, deci vrem doar reminderele.
 */
export async function enqueueRemindersOnly(bookingId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return { enqueued: 0 };
  // Rezervările de operator pot fi fără email — n-avem cui trimite reminderul.
  if (!booking.email) return { enqueued: 0 };

  const existing = await prisma.emailJob.findMany({
    where: { bookingId, status: { notIn: ["cancelled", "failed"] } },
    select: { type: true },
  });
  const have = new Set(existing.map((e) => e.type));

  const now = new Date();
  const dep = booking.departureDate;
  const dep24 = dayBeforeAtLocal(dep, 8, 0);

  const jobs: Array<{ type: string; sendAt: Date; status: string; bookingId: string }> = [];
  if (!have.has("reminder_24h") && dep24 > now) {
    jobs.push({ type: "reminder_24h", sendAt: dep24, status: "scheduled", bookingId });
  }
  // Recenzie: la 2 zile după ultima etapă a călătoriei (retur dacă există).
  const lastLeg = booking.returnDate ?? booking.departureDate;
  const reviewAt = new Date(new Date(lastLeg).getTime() + 2 * 24 * 3600 * 1000);
  if (booking.type !== "parcel" && !have.has("review_request") && reviewAt > now) {
    jobs.push({ type: "review_request", sendAt: reviewAt, status: "scheduled", bookingId });
  }
  if (jobs.length > 0) {
    await prisma.emailJob.createMany({ data: jobs });
  }
  return { enqueued: jobs.length };
}

/**
 * Când un booking este anulat: marchează jobs-urile neexpediate ca 'cancelled'
 * și enqueue un email de cancellation dacă n-a fost deja trimis unul.
 */
export async function cancelForBooking(bookingId: string, sendCancellationEmail = true) {
  await prisma.emailJob.updateMany({
    where: { bookingId, status: { in: ["scheduled", "queued"] } },
    data: { status: "cancelled" },
  });

  if (sendCancellationEmail) {
    // Fără email (rezervare de operator) nu avem cui trimite anularea.
    const bk = await prisma.booking.findUnique({ where: { id: bookingId }, select: { email: true } });
    if (!bk?.email) return;
    // Deduplicăm doar pe job-urile ÎN AȘTEPTARE. Un job "sent" istoric nu
    // trebuie să suprime emailul unei a doua anulări (cancel → re-confirm →
    // cancel din nou); dublurile în cadrul aceleiași anulări sunt oprite de
    // guard-urile de tranziție ale apelanților (status != cancelled).
    const alreadyPending = await prisma.emailJob.findFirst({
      where: { bookingId, type: "cancellation", status: "queued" },
    });
    if (!alreadyPending) {
      await prisma.emailJob.create({
        data: {
          bookingId,
          type: "cancellation",
          sendAt: new Date(),
          status: "queued",
        },
      });
    }
  }
}

/**
 * Procesează coada — ia toate job-urile due (scheduled cu sendAt<=now sau queued),
 * le trimite via Resend, actualizează statusul și creează EmailLog.
 * Folosită de /api/cron/send-reminders și /api/admin/emails/run.
 */
export async function processEmailQueue(limit = 50): Promise<{
  processed: number;
  sent: number;
  failed: number;
  retried: number;
}> {
  // Legacy: remove any pending 2h reminders left over from the previous
  // schedule. Idempotent — after the first run it's a no-op.
  await prisma.emailJob.updateMany({
    where: { type: "reminder_2h", status: { in: ["scheduled", "queued"] } },
    data: { status: "cancelled" },
  });

  const now = new Date();
  const jobs = await prisma.emailJob.findMany({
    where: {
      type: { not: "reminder_2h" },
      OR: [
        { status: "scheduled", sendAt: { lte: now } },
        { status: "queued" },
      ],
    },
    include: { booking: true },
    orderBy: { sendAt: "asc" },
    take: limit,
  });

  const results = { processed: 0, sent: 0, failed: 0, retried: 0 };

  for (const job of jobs) {
    results.processed++;
    try {
      await sendJob(job);
      await prisma.emailJob.update({
        where: { id: job.id },
        data: {
          status: "sent",
          sentAt: new Date(),
          attempts: job.attempts + 1,
          lastError: null,
        },
      });
      await prisma.emailLog.create({
        data: {
          to: job.booking.email,
          subject: subjectForType(job.type, job.booking.bookingNumber),
          template: job.type,
          status: "sent",
          relatedId: job.bookingId,
        },
      });
      results.sent++;
    } catch (error) {
      const attempts = job.attempts + 1;
      const maxed = attempts >= MAX_ATTEMPTS;
      const msg = (error instanceof Error ? error.message : String(error)).slice(0, 500);

      await prisma.emailJob.update({
        where: { id: job.id },
        data: {
          attempts,
          status: maxed ? "failed" : "queued",
          lastError: msg,
          sendAt: maxed ? job.sendAt : new Date(Date.now() + RETRY_DELAY_MS),
        },
      });
      await prisma.emailLog.create({
        data: {
          to: job.booking.email,
          subject: subjectForType(job.type, job.booking.bookingNumber),
          template: job.type,
          status: "failed",
          relatedId: job.bookingId,
          error: msg,
        },
      });
      if (maxed) results.failed++;
      else results.retried++;
    }
  }

  return results;
}

async function sendJob(job: EmailJob & { booking: Booking }) {
  const { type, booking } = job;
  const urls = await buildResponseUrls(booking.bookingNumber);

  if (type === "confirmation") {
    // Bus + plate de pe cursa dus, ca să apară în email (rândul "Autocar").
    const bus = booking.tripId
      ? await prisma.trip.findUnique({
          where: { id: booking.tripId },
          select: { bus: { select: { label: true, plate: true } } },
        })
      : null;
    const result = await sendBookingConfirmation({
      bookingNumber: booking.bookingNumber,
      type: booking.type as "passenger" | "parcel",
      tripType: (booking.tripType as "one-way" | "round-trip" | undefined) ?? undefined,
      firstName: booking.firstName,
      lastName: booking.lastName,
      email: booking.email,
      phone: booking.phone,
      departureCity: booking.departureCity,
      arrivalCity: booking.arrivalCity,
      departureDate: booking.departureDate,
      returnDate: booking.returnDate,
      adults: booking.adults,
      children: booking.children,
      parcelDetails: booking.parcelDetails,
      price: booking.price,
      currency: booking.currency,
      ticketUrl: booking.ticketUrl || "",
      payMethod: booking.payMethod,
      busLabel: bus?.bus.label ?? null,
      busPlate: bus?.bus.plate ?? null,
      confirmUrl: urls.confirmUrl,
      cancelUrl: urls.cancelUrl,
      trackUrl: urls.trackUrl,
    });
    if (!result.success) throw new Error(result.error || "Resend failed");
    return;
  }

  let html: string;
  if (type === "reminder_24h") {
    const { resolveScheduledTimes } = await import("@/lib/scheduledTime");
    const scheduled = await resolveScheduledTimes(booking);
    html = reminder24hHtml(booking, urls, scheduled.departureTime ?? null);
  } else if (type === "review_request") {
    // Link cu token → /recenzie cu numele + cursa precompletate.
    const token = await createBookingToken(booking.bookingNumber, "review", 120 * 24 * 3600 * 1000);
    const reviewUrl = `${publicAppUrl()}/recenzie?nr=${encodeURIComponent(booking.bookingNumber)}&t=${encodeURIComponent(token)}`;
    html = reviewRequestHtml(booking, reviewUrl);
  } else {
    html = cancellationHtml(booking);
  }

  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const { error } = await getResend().emails.send({
    from: process.env.EMAIL_FROM || "DAVO Group <info@davo.md>",
    to: booking.email,
    subject: subjectForType(type, booking.bookingNumber),
    html,
  });
  if (error) throw new Error(error.message || "Resend returned error");
}
