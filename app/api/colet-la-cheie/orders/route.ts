import { NextRequest, NextResponse } from "next/server";
import { getResend } from "@/lib/email";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type OrderLine = {
  productId: string;
  name: string;
  quantity: number;
  price: number;
};

type CustomerInput = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  destinationCountry?: string;
  destinationCity?: string;
  address?: string;
  notes?: string;
  consent?: boolean;
};

function generateOrderRef() {
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `CLC-${year}-${random}`;
}

function formatMdl(n: number) {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "MDL",
    maximumFractionDigits: 0,
  }).format(n);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const customer: CustomerInput = body.customer || {};
    const lines: OrderLine[] = Array.isArray(body.lines) ? body.lines : [];
    const totalMdl = Number(body.totalMdl) || 0;

    const required: (keyof CustomerInput)[] = [
      "firstName",
      "lastName",
      "email",
      "phone",
      "destinationCountry",
      "destinationCity",
      "address",
    ];
    for (const f of required) {
      if (!customer[f]) {
        return NextResponse.json(
          { success: false, error: `Lipsește câmpul: ${f}` },
          { status: 400 }
        );
      }
    }
    if (!customer.consent) {
      return NextResponse.json(
        { success: false, error: "Trebuie să accepți Termenii și Condițiile" },
        { status: 400 }
      );
    }
    if (lines.length === 0) {
      return NextResponse.json(
        { success: false, error: "Coșul este gol" },
        { status: 400 }
      );
    }

    const orderRef = generateOrderRef();
    const summary = lines
      .map((l) => `${l.quantity}× ${l.name} — ${formatMdl(l.price * l.quantity)}`)
      .join(" · ");

    // Salvăm ca Booking de tip "colet_la_cheie" — vizibil în /admin/bookings.
    // Detaliile complete (line items, adresă) merg în parcelDetails ca JSON.
    const stored = await prisma.booking.create({
      data: {
        bookingNumber: orderRef,
        type: "colet_la_cheie",
        status: "pending",
        departureCity: "Chișinău",
        arrivalCity: `${customer.destinationCity}, ${customer.destinationCountry}`,
        departureDate: new Date(),
        firstName: customer.firstName!,
        lastName: customer.lastName!,
        email: customer.email!,
        phone: customer.phone!,
        adults: 0,
        children: 0,
        price: totalMdl,
        currency: "MDL",
        parcelDetails: JSON.stringify({
          address: customer.address,
          notes: customer.notes,
          lines,
        }),
        payMethod: "cash_on_delivery",
        paymentStatus: "pending",
      },
    });

    // Email admin
    try {
      const adminHtml = `
        <h2>🛒 Comandă nouă "Colet la cheie"</h2>
        <p><strong>Nr. comandă:</strong> ${orderRef}</p>
        <p><strong>Client:</strong> ${customer.firstName} ${customer.lastName}<br/>
           <strong>Email:</strong> <a href="mailto:${customer.email}">${customer.email}</a><br/>
           <strong>Telefon:</strong> <a href="tel:${customer.phone}">${customer.phone}</a></p>
        <p><strong>Livrare:</strong><br/>
           ${customer.destinationCity}, ${customer.destinationCountry}<br/>
           ${customer.address}</p>
        ${customer.notes ? `<p><strong>Observații:</strong> ${customer.notes}</p>` : ""}
        <h3>Produse comandate</h3>
        <table cellpadding="6" cellspacing="0" border="1" style="border-collapse: collapse; font-family: sans-serif;">
          <tr>
            <th align="left">Produs</th>
            <th align="right">Cantitate</th>
            <th align="right">Preț</th>
            <th align="right">Subtotal</th>
          </tr>
          ${lines
            .map(
              (l) => `
            <tr>
              <td>${l.name}</td>
              <td align="right">${l.quantity}</td>
              <td align="right">${formatMdl(l.price)}</td>
              <td align="right">${formatMdl(l.price * l.quantity)}</td>
            </tr>
          `
            )
            .join("")}
          <tr>
            <td colspan="3" align="right"><strong>Total produse</strong></td>
            <td align="right"><strong>${formatMdl(totalMdl)}</strong></td>
          </tr>
        </table>
        <p style="margin-top: 16px;">Sună clientul pentru a confirma prețul livrării și termenul.</p>
        <p>Sumar text: ${summary}</p>
      `;

      await getResend().emails.send({
        from: process.env.EMAIL_FROM || "DAVO Group <onboarding@resend.dev>",
        to: "adrian@radx.solutions",
        subject: `🛒 Colet la cheie — comandă ${orderRef}`,
        html: adminHtml,
      });

      // Email client (dacă RESEND e configurat și permite)
      const customerHtml = `
        <p>Bună ${customer.firstName},</p>
        <p>Mulțumim pentru comanda <strong>${orderRef}</strong> de pe DAVO Group — Colet la cheie.</p>
        <p>Te vom suna în câteva ore pentru a confirma prețul livrării și termenul aproximativ.</p>
        <h3>Comandă</h3>
        <p>${summary}</p>
        <p><strong>Total produse:</strong> ${formatMdl(totalMdl)}</p>
        <p><strong>Plata:</strong> la livrare (cash sau card).</p>
        <p>Pentru întrebări: +373 68 065 699 sau info@davo.md</p>
      `;
      await getResend().emails.send({
        from: process.env.EMAIL_FROM || "DAVO Group <onboarding@resend.dev>",
        to: customer.email!,
        subject: `Comanda ta DAVO — ${orderRef}`,
        html: customerHtml,
      });

      await prisma.emailLog.create({
        data: {
          to: customer.email!,
          subject: `Comanda ta DAVO — ${orderRef}`,
          template: "colet-la-cheie-order",
          status: "sent",
          relatedId: stored.id,
        },
      });
    } catch (e) {
      console.error("CLC email error:", e);
      await prisma.emailLog.create({
        data: {
          to: customer.email!,
          subject: `Comanda ta DAVO — ${orderRef}`,
          template: "colet-la-cheie-order",
          status: "failed",
          relatedId: stored.id,
          error: e instanceof Error ? e.message : "unknown",
        },
      });
    }

    return NextResponse.json({ success: true, orderRef });
  } catch (error) {
    console.error("CLC order error:", error);
    return NextResponse.json(
      { success: false, error: "Eroare la procesarea comenzii" },
      { status: 500 }
    );
  }
}
