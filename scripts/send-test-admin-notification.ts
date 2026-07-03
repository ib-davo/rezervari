/**
 * Trimite UN email de notificare admin către adrian@radx.solutions, simulând o
 * rezervare nouă făcută de pe site (passes through sendAdminNotification →
 * adminNotificationHtml → resolveScheduledTimes). Booking-ul e fictiv.
 *
 * Usage:
 *   npx tsx scripts/send-test-admin-notification.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { sendAdminNotification, type BookingConfirmationData } from "../lib/email";

function fakeBookingNumber(): string {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TEST-${random}`;
}

function nextWeekday(weekday: number, hour: number, minute: number): Date {
  const d = new Date();
  const diff = (weekday - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function main() {
  if (!process.env.RESEND_API_KEY) {
    console.error("✗ RESEND_API_KEY nu e setat. Verifică .env.local");
    process.exit(1);
  }

  const bookingNumber = fakeBookingNumber();
  const data: BookingConfirmationData = {
    bookingNumber,
    type: "passenger",
    tripType: "one-way",
    firstName: "Andrei (test)",
    lastName: "Popescu",
    email: "andrei.test@example.com",
    phone: "+373 60 123 456",
    departureCity: "Chișinău, Moldova",
    arrivalCity: "London, Anglia",
    departureDate: nextWeekday(4, 7, 0), // Joi 07:00 — Anglia DUS
    adults: 2,
    children: 1,
    price: 360,
    currency: "GBP",
    payMethod: "cash_on_pickup",
    ticketUrl: `https://davo.md/bilet/${bookingNumber}`,
  };

  process.stdout.write(`→ adrian@radx.solutions  |  Notificare admin  |  ${bookingNumber}  ... `);
  const res = await sendAdminNotification(data);
  if (res.success) {
    console.log("OK");
  } else {
    console.log(`FAIL: ${res.error}`);
    process.exit(2);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../lib/prisma");
    await prisma.$disconnect();
  });
