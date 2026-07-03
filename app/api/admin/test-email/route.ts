import { NextRequest, NextResponse } from "next/server";
import { getResend } from "@/lib/email";

export const dynamic = "force-dynamic";

// Endpoint admin pentru testare rapidă a configurării Resend.
// Trimite un email simplu către adresa indicată în query (?to=...).
// Util după verificarea domeniului — confirmă că totul e wired up corect.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const to = (searchParams.get("to") || "").trim();

  if (!to) {
    return NextResponse.json(
      {
        success: false,
        error: "Lipsește parametrul ?to=email@destinatar.com",
        usage: "/api/admin/test-email?to=cineva@gmail.com",
      },
      { status: 400 }
    );
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { success: false, error: "RESEND_API_KEY nu e setat" },
      { status: 500 }
    );
  }

  const from = process.env.EMAIL_FROM || "DAVO Group <info@davo.md>";
  const now = new Date().toLocaleString("ro-RO", { timeZone: "Europe/Chisinau" });

  const html = `
<!DOCTYPE html>
<html lang="ro">
<head><meta charset="UTF-8"><title>Test DAVO</title></head>
<body style="font-family:Segoe UI,Tahoma,sans-serif;background:#f5f7fb;margin:0;padding:20px;color:#0b2653;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 30px 60px -30px rgba(11,38,83,0.25);">
    <div style="background:linear-gradient(135deg,#0b2653,#143a7a);padding:30px 24px;text-align:center;">
      <div style="color:#ff7a85;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:6px;">DAVO Group</div>
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:800;">✓ Email test reușit</h1>
    </div>
    <div style="padding:28px 28px 20px;color:#475569;line-height:1.6;font-size:15px;">
      <p>Dacă citești acest email, înseamnă că <strong style="color:#0b2653;">configurarea Resend cu domeniul davo.md funcționează corect</strong>.</p>
      <p style="background:#f5f7fb;border-left:4px solid #e11e2b;padding:12px 16px;border-radius:6px;font-size:13px;">
        <strong style="color:#0b2653;">Detalii tehnice:</strong><br/>
        From: <code>${from}</code><br/>
        To: <code>${to}</code><br/>
        Trimis: <code>${now}</code><br/>
        App URL: <code>${process.env.NEXT_PUBLIC_APP_URL || "(unset)"}</code>
      </p>
      <p>De acum înainte:</p>
      <ul>
        <li>Confirmările de rezervare vor ajunge la orice client</li>
        <li>Reminder-ele 24h și 2h se trimit automat (cron Vercel)</li>
        <li>Butoanele V/X (confirm/anulez) sunt funcționale</li>
        <li>Emailurile de anulare ajung la client</li>
      </ul>
    </div>
    <div style="background:#0b2653;color:#fff;padding:18px;text-align:center;font-size:12px;">
      © ${new Date().getFullYear()} DAVO Group · <a href="tel:+37368065699" style="color:#ff7a85;text-decoration:none;font-weight:600;">+373 68 065 699</a> · <a href="mailto:info@davo.md" style="color:#ff7a85;text-decoration:none;">info@davo.md</a>
    </div>
  </div>
</body>
</html>`;

  const { data, error } = await getResend().emails.send({
    from,
    to,
    subject: "✓ Test DAVO — configurare Resend funcționează",
    html,
  });

  if (error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        from,
        to,
        hint:
          "Verifică în Resend dashboard că davo.md e marcat 'Verified'. Dacă vezi 'You can only send emails to your own address', domeniul nu e încă verificat.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    from,
    to,
    sentAt: now,
    resendId: data?.id,
    message: "Email trimis. Verifică inbox-ul (și folder-ul Spam la prima trimitere de pe domeniu nou).",
  });
}
