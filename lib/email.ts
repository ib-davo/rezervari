import { Resend } from "resend";
import {
  confirmationHtml,
  adminNotificationHtml,
  rescheduleHtml,
  subjectForType,
  type ConfirmationData,
  type ResponseUrls,
  type RescheduleData,
} from "./emailTemplates";
import { resolveScheduledTimes } from "./scheduledTime";

let _resend: Resend | null = null;
export function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

export interface BookingConfirmationData extends ConfirmationData {
  lastName: string;
  email: string;
  phone: string;
  ticketUrl: string;
  confirmUrl?: string;
  cancelUrl?: string;
  trackUrl?: string;
}

function urlsFrom(data: BookingConfirmationData): ResponseUrls | undefined {
  if (!data.confirmUrl || !data.cancelUrl) return undefined;
  return { confirmUrl: data.confirmUrl, cancelUrl: data.cancelUrl };
}

export async function sendBookingConfirmation(
  booking: BookingConfirmationData
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const scheduled = await resolveScheduledTimes(booking);
    const enriched: BookingConfirmationData = {
      ...booking,
      departureTime: booking.departureTime ?? scheduled.departureTime ?? null,
      returnTime: booking.returnTime ?? scheduled.returnTime ?? null,
    };

    const html = confirmationHtml(enriched, urlsFrom(enriched));

    const { error } = await getResend().emails.send({
      from: process.env.EMAIL_FROM || "DAVO Group <info@davo.md>",
      to: enriched.email,
      subject: subjectForType("confirmation", enriched.bookingNumber),
      html,
    });

    if (error) {
      console.error("Email send error:", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (error) {
    console.error("Email error:", error);
    return { success: false, error: "Failed to send email" };
  }
}

// Confirmare de MODIFICARE (dată + loc) — trimisă inline când operatorul
// reprogramează o rezervare din panou.
export async function sendRescheduleConfirmation(
  data: RescheduleData & { email: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
    const html = rescheduleHtml(data);
    const { error } = await getResend().emails.send({
      from: process.env.EMAIL_FROM || "DAVO Group <info@davo.md>",
      to: data.email,
      subject: `Rezervare modificată — ${data.bookingNumber}`,
      html,
    });
    if (error) {
      console.error("Reschedule email error:", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (error) {
    console.error("Reschedule email error:", error);
    return { success: false, error: "Failed to send email" };
  }
}

export async function sendAdminNotification(
  booking: BookingConfirmationData
): Promise<{ success: boolean; error?: string }> {
  try {
    const scheduled = await resolveScheduledTimes(booking);
    const enriched: BookingConfirmationData = {
      ...booking,
      departureTime: booking.departureTime ?? scheduled.departureTime ?? null,
      returnTime: booking.returnTime ?? scheduled.returnTime ?? null,
    };
    const html = adminNotificationHtml(enriched);
    await getResend().emails.send({
      from: process.env.EMAIL_FROM || "DAVO Group <info@davo.md>",
      to: "adrian@radx.solutions",
      subject: `Rezervare nouă — ${booking.bookingNumber}`,
      html,
    });
    return { success: true };
  } catch (error) {
    console.error("Admin notification error:", error);
    return { success: false, error: "Failed to send admin notification" };
  }
}
