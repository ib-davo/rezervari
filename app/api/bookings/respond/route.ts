import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyBookingToken } from "@/lib/bookingToken";

export const dynamic = "force-dynamic";

function htmlPage({
  title,
  heading,
  body,
  tone,
  bookingNumber,
}: {
  title: string;
  heading: string;
  body: string;
  tone: "ok" | "cancel" | "error";
  bookingNumber?: string;
}) {
  const accent =
    tone === "ok" ? "#10c49b" : tone === "cancel" ? "#e11e2b" : "#1f2937";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "/";
  const trackUrl = bookingNumber
    ? `${appUrl.replace(/\/$/, "")}/livrare?nr=${bookingNumber}`
    : null;

  return `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title} — DAVO Group</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; min-height: 100vh; background: #f5f7fb; display: flex; align-items: center; justify-content: center; padding: 24px; color: #0b2653; }
  .card { width: 100%; max-width: 520px; background: #fff; border-radius: 24px; box-shadow: 0 30px 80px -40px rgba(11,38,83,0.25); overflow: hidden; }
  .top { background: ${accent}; padding: 32px 28px; color: #fff; text-align: center; }
  .top h1 { margin: 0; font-size: 22px; letter-spacing: 0.02em; }
  .top .icon { font-size: 48px; line-height: 1; margin-bottom: 12px; }
  .body { padding: 28px; line-height: 1.6; color: #475569; }
  .body p { margin: 0 0 14px; }
  .bn { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 700; color: #0b2653; padding: 4px 10px; background: #eef2f8; border-radius: 6px; }
  .actions { display: flex; flex-wrap: wrap; gap: 10px; padding: 0 28px 28px; }
  a.btn { display: inline-flex; align-items: center; gap: 8px; padding: 12px 20px; border-radius: 999px; font-weight: 600; font-size: 14px; text-decoration: none; }
  a.primary { background: #e11e2b; color: #fff; }
  a.secondary { border: 1px solid #d6dde9; color: #0b2653; }
</style>
</head>
<body>
  <main class="card">
    <header class="top">
      <div class="icon">${tone === "ok" ? "✓" : tone === "cancel" ? "✗" : "ℹ"}</div>
      <h1>${heading}</h1>
    </header>
    <div class="body">${body}</div>
    <div class="actions">
      ${
        trackUrl
          ? `<a class="btn primary" href="${trackUrl}">Urmărește status →</a>`
          : ""
      }
      <a class="btn secondary" href="${appUrl}">Mergi la site</a>
    </div>
  </main>
</body>
</html>`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token") || "";
  const bn = (searchParams.get("bn") || "").toUpperCase();
  const action = searchParams.get("action") || "";

  const verified = await verifyBookingToken(token);
  if (!verified || verified.bookingNumber !== bn || verified.action !== action) {
    return new Response(
      htmlPage({
        title: "Link invalid",
        heading: "Link invalid sau expirat",
        body: `<p>Link-ul nu mai este valabil. Te rugăm să folosești cele mai recente link-uri din e-mail sau să ne contactezi la <a href="tel:+37368065699">+373 68 065 699</a>.</p>`,
        tone: "error",
      }),
      { status: 400, headers: { "content-type": "text/html; charset=utf-8" } }
    );
  }

  const booking = await prisma.booking.findUnique({
    where: { bookingNumber: bn },
  });

  if (!booking) {
    return new Response(
      htmlPage({
        title: "Rezervare negăsită",
        heading: "Rezervare negăsită",
        body: `<p>Nu am găsit nicio rezervare cu numărul <span class="bn">${bn}</span>. Verifică e-mailul de confirmare sau contactează-ne.</p>`,
        tone: "error",
      }),
      { status: 404, headers: { "content-type": "text/html; charset=utf-8" } }
    );
  }

  // Idempotent: dacă utilizatorul deja a răspuns la fel, doar afișăm confirmarea.
  if (booking.passengerResponse === verified.action) {
    const same =
      verified.action === "confirm"
        ? {
            title: "Confirmat",
            heading: "Te-ai confirmat deja — mulțumim!",
            body: `<p>Rezervarea <span class="bn">${bn}</span> rămâne <strong>activă</strong>. Te așteptăm cu drag.</p>`,
            tone: "ok" as const,
          }
        : {
            title: "Anulat",
            heading: "Rezervarea este deja anulată",
            body: `<p>Rezervarea <span class="bn">${bn}</span> a fost marcată ca anulată anterior. Dacă a fost o eroare, sună-ne la <a href="tel:+37368065699">+373 68 065 699</a>.</p>`,
            tone: "cancel" as const,
          };
    return new Response(
      htmlPage({ ...same, bookingNumber: bn }),
      { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }
    );
  }

  if (verified.action === "confirm") {
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        passengerResponse: "confirmed",
        passengerResponseAt: new Date(),
        // Re-confirmare: dacă era anulată, o readucem ca confirmată
        ...(booking.status === "cancelled"
          ? { status: "confirmed", confirmedAt: new Date() }
          : {}),
      },
    });
    return new Response(
      htmlPage({
        title: "Confirmare primită",
        heading: "Mulțumim — confirmarea a fost înregistrată",
        body: `
          <p>Pasagerul pentru rezervarea <span class="bn">${bn}</span> este <strong>confirmat că vine</strong>.</p>
          <p>Te așteptăm la îmbarcare cu 30 de minute înainte de plecare. Pentru orice modificare ulterioară, sună la <a href="tel:+37368065699">+373 68 065 699</a>.</p>
        `,
        tone: "ok",
        bookingNumber: bn,
      }),
      { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }
    );
  }

  // action === "cancel"
  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      passengerResponse: "cancelled",
      passengerResponseAt: new Date(),
      status: "cancelled",
    },
  });

  // Eliberează scaunele rezervate (dacă există)
  await prisma.seatBooking.deleteMany({
    where: { bookingId: booking.id },
  });

  // Marchează jobs-urile de reminder neexpediate ca anulate
  await prisma.emailJob.updateMany({
    where: {
      bookingId: booking.id,
      status: "scheduled",
      sentAt: null,
    },
    data: { status: "cancelled" },
  });

  return new Response(
    htmlPage({
      title: "Rezervare anulată",
      heading: "Rezervarea a fost anulată",
      body: `
        <p>Rezervarea <span class="bn">${bn}</span> a fost <strong>anulată</strong>. Locurile au fost eliberate, iar reminder-ele au fost oprite.</p>
        <p>Dacă ai anulat din greșeală, sună-ne la <a href="tel:+37368065699">+373 68 065 699</a> sau dă click din nou pe butonul "Confirm că vin" din e-mail.</p>
      `,
      tone: "cancel",
      bookingNumber: bn,
    }),
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}
