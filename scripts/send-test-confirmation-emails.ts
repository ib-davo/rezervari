/**
 * Trimite emailuri de confirmare DAVO către o listă de destinatari, pentru
 * 2 țări de destinație (Anglia & Olanda). Booking-urile sunt fictive — NU
 * se scriu în DB. Folosesc însă același flow ca producția (sendBooking-
 * Confirmation → resolveScheduledTimes), deci ora afișată în email este
 * cea din programul țării din admin.
 *
 * Usage:
 *   npx tsx scripts/send-test-confirmation-emails.ts
 *
 * Variabile env necesare: RESEND_API_KEY, EMAIL_FROM (opțional), DATABASE_URL.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { sendBookingConfirmation, type BookingConfirmationData } from "../lib/email";

const RECIPIENTS = ["adrian@inter-bus.md", "bobernagadamianw2312@gmail.com"];

type Scenario = {
  label: string;
  city: string;
  country: string;
  ticketCurrency: "GBP" | "EUR";
  ticketPrice: number;
};

const SCENARIOS: Scenario[] = [
  {
    label: "Moldova → Anglia",
    city: "London",
    country: "Anglia",
    ticketCurrency: "GBP",
    ticketPrice: 120,
  },
  {
    label: "Moldova → Olanda",
    city: "Amsterdam",
    country: "Olanda",
    ticketCurrency: "EUR",
    ticketPrice: 130,
  },
];

function fakeBookingNumber(): string {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TEST-${random}`;
}

function nextWeekday(weekday: number, hour: number, minute: number): Date {
  // weekday: 0=Duminică ... 6=Sâmbătă. Returnează următoarea apariție.
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

  const results: { to: string; scenario: string; bookingNumber: string; ok: boolean; error?: string }[] = [];

  for (const to of RECIPIENTS) {
    for (const scenario of SCENARIOS) {
      const bookingNumber = fakeBookingNumber();
      // Zilele alese aproximativ (Joi 07:00 pentru Anglia, Vineri 08:30 pentru
      // Olanda — corespund programului din admin); orele exacte vor fi
      // suprascrise de schedule-ul real din DB la randare.
      const isAnglia = scenario.country === "Anglia";
      const departureDate = isAnglia
        ? nextWeekday(4, 7, 0)   // Joi 07:00
        : nextWeekday(5, 8, 30); // Vineri 08:30
      const returnDate = isAnglia
        ? nextWeekday(0, 19, 0)  // Duminică 19:00
        : nextWeekday(0, 12, 0); // Duminică 12:00

      const data: BookingConfirmationData = {
        bookingNumber,
        type: "passenger",
        tripType: "round-trip",
        firstName: "Test",
        lastName: "Davo",
        email: to,
        phone: "+373 60 000 000",
        departureCity: "Chișinău, Moldova",
        arrivalCity: `${scenario.city}, ${scenario.country}`,
        departureDate,
        returnDate,
        adults: 1,
        children: 0,
        price: scenario.ticketPrice,
        currency: scenario.ticketCurrency,
        payMethod: "cash_on_pickup",
        ticketUrl: `https://davo.md/bilet/${bookingNumber}`,
      };

      process.stdout.write(`→ ${to}  |  ${scenario.label}  |  ${bookingNumber}  ... `);
      const res = await sendBookingConfirmation(data);
      if (res.success) {
        console.log("OK");
        results.push({ to, scenario: scenario.label, bookingNumber, ok: true });
      } else {
        console.log(`FAIL: ${res.error}`);
        results.push({ to, scenario: scenario.label, bookingNumber, ok: false, error: res.error });
      }
    }
  }

  console.log("");
  console.log("=== Rezumat ===");
  for (const r of results) {
    console.log(`  ${r.ok ? "✓" : "✗"} ${r.to.padEnd(35)} ${r.scenario.padEnd(22)} ${r.bookingNumber}${r.error ? "  — " + r.error : ""}`);
  }
  console.log("");
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
