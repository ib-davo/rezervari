import type { Booking } from "@prisma/client";
import { appUrl } from "@/lib/appUrl";

// Ora plecării/întoarcerii e introdusă mereu în ora locală Moldovei (admin +
// flow public). Serverul (Vercel) rulează în UTC, deci fără `timeZone` ar
// afișa orele cu 3h mai puțin în emailuri — clientul vede "04:00" pentru o
// cursă programată la 07:00 Chișinău. Forțăm Europe/Chișinău ca să fie
// consistent indiferent de unde citește destinatarul emailul.
const dateFmt = new Intl.DateTimeFormat("ro-RO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Chisinau",
});

const timeFmt = new Intl.DateTimeFormat("ro-RO", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Chisinau",
});

function logoUrl(): string {
  return `${appUrl()}/images/logo-davo.png`;
}

function ticketUrlFor(bookingNumber: string): string {
  return `${appUrl()}/bilet/${bookingNumber}`;
}

function formatDate(d: Date): string {
  return dateFmt.format(d);
}

function formatTime(d: Date): string {
  return timeFmt.format(d);
}

function formatPrice(amount: number, currency: string): string {
  const symbol = currency === "GBP" ? "£" : currency === "EUR" ? "€" : currency;
  return `${amount} ${symbol}`;
}

// Brand colors — same tokens as the site (lib/globals.css)
const C = {
  navy950: "#08162f",
  navy900: "#0b2653",
  navy800: "#0f2e63",
  navy700: "#143a7a",
  red500: "#e11e2b",
  red400: "#f23b47",
  ink900: "#0f172a",
  ink700: "#334155",
  ink500: "#64748b",
  ink400: "#94a3b8",
  ink200: "#e2e8f0",
  ink100: "#f1f5f9",
  ink50: "#f8fafc",
  success: "#10c49b",
};

// Font stack — emulates the Montserrat display feel with system fallbacks.
// Email clients largely ignore web fonts, so we go heavy weight + tracking.
const FONT_DISPLAY =
  "'Helvetica Neue',Helvetica,Arial,sans-serif";
const FONT_BODY =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export type ResponseUrls = { confirmUrl?: string; cancelUrl?: string };

// ----- Building blocks -----

type DetailRow = { label: string; value: string };

function detailsCard(rows: DetailRow[]): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:${C.ink50};border:1px solid ${C.ink200};border-radius:14px;margin:0 0 28px;overflow:hidden;">
    ${rows
      .map(
        (r, i) => `
    <tr>
      <td style="padding:16px 20px;${i < rows.length - 1 ? `border-bottom:1px solid ${C.ink200};` : ""}">
        <div style="font-family:${FONT_BODY};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.6px;color:${C.ink500};">${r.label}</div>
        <div style="margin-top:4px;font-family:${FONT_BODY};font-size:16px;font-weight:600;color:${C.navy900};line-height:1.3;">${r.value}</div>
      </td>
    </tr>`
      )
      .join("")}
  </table>`;
}

function vxButtons(urls: ResponseUrls, intro?: string): string {
  if (!urls.confirmUrl || !urls.cancelUrl) return "";
  const text =
    intro ??
    "Apasă pe unul din butoane ca să ne confirmi prezența. Dacă nu mai poți, anulează — eliberăm locul.";
  return `
  <div style="margin:0 0 28px;">
    <div style="font-family:${FONT_DISPLAY};font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:${C.red500};margin-bottom:6px;">Confirmare prezență</div>
    <div style="font-family:${FONT_DISPLAY};font-size:22px;font-weight:800;color:${C.navy900};line-height:1.2;margin-bottom:8px;">Mai vii la cursă?</div>
    <p style="margin:0 0 18px;font-family:${FONT_BODY};font-size:14px;color:${C.ink700};line-height:1.55;">${text}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td width="50%" style="padding-right:6px;">
          <a href="${urls.confirmUrl}"
             style="display:block;background:${C.success};color:#ffffff;text-align:center;text-decoration:none;padding:18px 12px;border-radius:12px;font-family:${FONT_DISPLAY};font-weight:800;font-size:14px;letter-spacing:0.05em;text-transform:uppercase;box-shadow:0 12px 24px -8px rgba(16,196,155,0.45);">
            ✓ Confirm că vin
          </a>
        </td>
        <td width="50%" style="padding-left:6px;">
          <a href="${urls.cancelUrl}"
             style="display:block;background:#ffffff;color:${C.navy900};text-align:center;text-decoration:none;padding:16px 12px;border-radius:12px;font-family:${FONT_DISPLAY};font-weight:800;font-size:14px;letter-spacing:0.05em;text-transform:uppercase;border:2px solid ${C.ink200};">
            ✗ Nu mai pot
          </a>
        </td>
      </tr>
    </table>
  </div>`;
}

function ticketButton(bookingNumber: string): string {
  const href = ticketUrlFor(bookingNumber);
  return `
  <div style="margin:0 0 8px;text-align:center;">
    <a href="${href}"
       style="display:inline-block;background:${C.navy900};color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-family:${FONT_DISPLAY};font-weight:800;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;">
      Vezi biletul electronic →
    </a>
  </div>`;
}

// ----- Hero header (renders strong even when logo image is blocked) -----

function hero(opts: { eyebrow: string; eyebrowColor?: string }): string {
  const eyebrowColor = opts.eyebrowColor ?? C.red400;
  return `
  <tr>
    <td style="background:${C.red500};height:6px;line-height:6px;font-size:0;">&nbsp;</td>
  </tr>
  <tr>
    <td style="background:${C.navy900};padding:0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="padding:36px 32px 32px;vertical-align:middle;">
            <div style="font-family:${FONT_DISPLAY};font-size:11px;font-weight:800;letter-spacing:3.5px;text-transform:uppercase;color:${eyebrowColor};margin-bottom:14px;">
              ${opts.eyebrow}
            </div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:middle;padding-right:16px;">
                  <div style="font-family:${FONT_DISPLAY};font-size:38px;font-weight:900;letter-spacing:-0.01em;color:#ffffff;line-height:0.95;">
                    DAVO
                  </div>
                  <div style="font-family:${FONT_DISPLAY};font-size:13px;font-weight:700;letter-spacing:0.4em;color:rgba(255,255,255,0.7);text-transform:uppercase;margin-top:6px;">
                    Group
                  </div>
                </td>
                <td style="vertical-align:middle;padding-left:18px;border-left:2px solid rgba(255,255,255,0.15);">
                  <img src="${logoUrl()}" alt="" width="100" height="27" style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:100px;opacity:0.85;">
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

// ----- Layout -----

function layout(opts: {
  preheader?: string;
  title: string;
  eyebrow: string;
  eyebrowColor?: string;
  body: string;
}): string {
  const { preheader = "", title, eyebrow, eyebrowColor, body } = opts;
  return `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${C.ink100};font-family:${FONT_BODY};color:${C.navy900};-webkit-font-smoothing:antialiased;">
  ${
    preheader
      ? `<div style="display:none;font-size:1px;color:${C.ink100};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>`
      : ""
  }
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.ink100};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 30px 60px -25px rgba(11,38,83,0.25);">
          ${hero({ eyebrow, eyebrowColor })}
          <tr>
            <td style="padding:36px 32px 28px;font-family:${FONT_BODY};font-size:15px;line-height:1.6;color:${C.ink700};">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="background:${C.navy950};padding:22px 28px;text-align:center;">
              <div style="font-family:${FONT_BODY};font-size:13px;color:rgba(255,255,255,0.7);line-height:1.6;">
                Întrebări? Suntem 24/7 lângă tine.
              </div>
              <div style="margin-top:8px;font-family:${FONT_DISPLAY};font-size:14px;font-weight:700;">
                <a href="tel:+37368065699" style="color:${C.red400};text-decoration:none;">+373 68 065 699</a>
                <span style="color:rgba(255,255,255,0.3);margin:0 8px;">·</span>
                <a href="mailto:info@davo.md" style="color:${C.red400};text-decoration:none;">info@davo.md</a>
              </div>
              <div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.08);font-family:${FONT_BODY};font-size:11px;color:rgba(255,255,255,0.5);letter-spacing:0.05em;">
                © ${new Date().getFullYear()} DAVO Group · Calea Ieșilor 11/3, Chișinău
              </div>
            </td>
          </tr>
        </table>
        <div style="margin-top:18px;font-family:${FONT_BODY};font-size:11px;color:${C.ink400};text-align:center;letter-spacing:0.05em;">
          Primești acest email pentru că ai făcut o rezervare la DAVO Group.
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ----- Confirmation -----

export type ConfirmationData = {
  bookingNumber: string;
  type: "passenger" | "parcel";
  tripType?: "one-way" | "round-trip";
  firstName: string;
  departureCity: string;
  arrivalCity: string;
  departureDate: Date;
  returnDate?: Date | null;
  adults: number;
  children: number;
  parcelDetails?: string | null;
  price: number;
  currency: string;
  payMethod?: string | null;
  // Ora literală din programul țării (admin → Țări → "Ora plecării").
  // Când e setată, înlocuiește `formatTime(departureDate)` în template, ca să
  // afișăm exact ce vede admin-ul (ex: "07:00" pentru Anglia DUS).
  departureTime?: string | null;
  returnTime?: string | null;
  // Autocarul atașat la cursa dus, dacă rezervarea e legată de un Trip.
  busLabel?: string | null;
  busPlate?: string | null;
};

function paxLine(adults: number, children: number): string {
  const a = `${adults} ${adults === 1 ? "adult" : "adulți"}`;
  return children > 0 ? `${a}, ${children} ${children === 1 ? "copil" : "copii"}` : a;
}

function payLabel(payMethod?: string | null): string {
  if (payMethod === "card_on_pickup") return "Card la îmbarcare (POS la șofer)";
  if (payMethod === "cash_on_pickup") return "Cash la îmbarcare";
  if (payMethod === "cash_on_delivery") return "Cash la livrare";
  if (payMethod === "paid_in_advance") return "Achitată în avans";
  return "La îmbarcare";
}

function intro(text: string): string {
  return `<p style="margin:0 0 28px;font-family:${FONT_BODY};font-size:15px;color:${C.ink700};line-height:1.6;">${text}</p>`;
}

function headline(text: string): string {
  return `<h1 style="margin:0 0 14px;font-family:${FONT_DISPLAY};font-size:28px;font-weight:900;letter-spacing:-0.01em;color:${C.navy900};line-height:1.15;">${text}</h1>`;
}

export function confirmationHtml(b: ConfirmationData, urls?: ResponseUrls): string {
  const isParcel = b.type === "parcel";
  const isRoundTrip = b.tripType === "round-trip";

  // Coletele NU au oră fixă — admin sună expeditorul pentru grafic propriu.
  // Pentru ele afișăm doar data, altfel apare "03:00" doar pentru că
  // `new Date("YYYY-MM-DD")` e UTC midnight = 03:00 Europe/Chișinău vara.
  const depTime = isParcel ? null : (b.departureTime ?? formatTime(b.departureDate));
  const retTime = !isParcel && b.returnDate ? (b.returnTime ?? formatTime(b.returnDate)) : null;
  const rows: DetailRow[] = [
    { label: "Cursa", value: `${b.departureCity} → ${b.arrivalCity}` },
    {
      label: "Plecare",
      value: depTime ? `${formatDate(b.departureDate)} · ${depTime}` : formatDate(b.departureDate),
    },
  ];
  if (isRoundTrip && b.returnDate && retTime) {
    rows.push({
      label: "Întoarcere",
      value: `${formatDate(b.returnDate)} · ${retTime}`,
    });
  }
  if (isParcel && b.parcelDetails) {
    rows.push({ label: "Colet", value: b.parcelDetails });
  } else if (!isParcel) {
    rows.push({ label: "Pasageri", value: paxLine(b.adults, b.children) });
  }
  // Autocar (când rezervarea e legată de un Trip). Util la îmbarcare ca
  // pasagerul să-l recunoască vizual + nr. înmatriculare.
  if (b.busLabel) {
    rows.push({
      label: "Autocar",
      value: b.busPlate ? `${b.busLabel} · ${b.busPlate}` : b.busLabel,
    });
  }
  rows.push({ label: "Total", value: formatPrice(b.price, b.currency) });
  rows.push({ label: "Plata", value: payLabel(b.payMethod) });
  rows.push({ label: "Nr. rezervare", value: b.bookingNumber });

  const body = `
    ${headline(`Bună ${b.firstName},<br>te așteptăm la cursă.`)}
    ${intro(
      isParcel
        ? "Mai jos găsești detaliile transportului. Te sunăm în curând pentru ridicare și confirmare."
        : "Mai jos găsești detaliile călătoriei. Sosește la îmbarcare cu 30 de minute înainte de plecare."
    )}
    ${detailsCard(rows)}
    ${urls ? vxButtons(urls, "Confirmă-ne acum că vii sau anulează — durează 1 secundă, ne ajuți să gestionăm locurile.") : ""}
    ${ticketButton(b.bookingNumber)}
  `;

  return layout({
    preheader: `Rezervare ${b.bookingNumber} confirmată — ${b.departureCity} → ${b.arrivalCity}`,
    title: `Confirmare rezervare DAVO — ${b.bookingNumber}`,
    eyebrow: "✓ Rezervare confirmată",
    eyebrowColor: C.red400,
    body,
  });
}

// ----- Reminders -----

export function reminder24hHtml(b: Booking, urls?: ResponseUrls, scheduledDepartureTime?: string | null): string {
  const isParcel = b.type === "parcel" || b.type === "colet_la_cheie";
  const depTime = isParcel ? null : (scheduledDepartureTime ?? formatTime(b.departureDate));
  const plecareValue = depTime
    ? `${formatDate(b.departureDate)} · ${depTime}`
    : formatDate(b.departureDate);
  const body = `
    ${headline(`${b.firstName}, mâine e ziua mare.`)}
    ${intro(`Cursa ta <strong style="color:${C.navy900};">${b.departureCity} → ${b.arrivalCity}</strong> pleacă mâine. Vezi detaliile și confirmă-ne că vii.`)}
    ${detailsCard([
      { label: "Cursa", value: `${b.departureCity} → ${b.arrivalCity}` },
      { label: "Plecare", value: plecareValue },
      { label: "Nr. rezervare", value: b.bookingNumber },
    ])}
    ${urls ? vxButtons(urls, "Mai vii la cursă? Confirmă-ne acum sau anulează dacă nu mai poți.") : ""}
    ${ticketButton(b.bookingNumber)}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:24px;border-collapse:collapse;background:#fef3c7;border-left:4px solid #f59e0b;border-radius:8px;">
      <tr>
        <td style="padding:14px 18px;font-family:${FONT_BODY};font-size:13px;color:#78350f;line-height:1.55;">
          <strong>Pregătește pentru drum:</strong> buletin/pașaport valabil, max. 35 kg bagaj, sosește cu 30 min înainte.
        </td>
      </tr>
    </table>
  `;
  return layout({
    preheader: `Cursa ta pleacă mâine — ${b.departureCity} → ${b.arrivalCity}`,
    title: "Mâine pleci cu DAVO",
    eyebrow: "Mâine pleci",
    body,
  });
}

// ----- Cancellation -----

export function cancellationHtml(b: Booking): string {
  const refundLine =
    b.paymentStatus === "paid"
      ? `Suma de <strong style="color:${C.navy900};">${formatPrice(b.price, b.currency)}</strong> va fi rambursată în 5–7 zile lucrătoare pe aceeași metodă de plată.`
      : "Plata urma să se facă la îmbarcare/livrare, deci nu există o sumă de rambursat.";

  const body = `
    ${headline(`${b.firstName}, rezervarea a fost anulată.`)}
    ${intro(refundLine)}
    ${detailsCard([
      { label: "Cursa", value: `${b.departureCity} → ${b.arrivalCity}` },
      { label: "Plecare", value: formatDate(b.departureDate) },
      { label: "Nr. rezervare", value: b.bookingNumber },
    ])}
    <p style="margin:0;font-family:${FONT_BODY};font-size:14px;color:${C.ink700};line-height:1.6;">
      Vrei o nouă rezervare? Sună la
      <a href="tel:+37368065699" style="color:${C.red500};font-weight:700;text-decoration:none;">+373 68 065 699</a>
      sau scrie pe
      <a href="mailto:info@davo.md" style="color:${C.red500};font-weight:700;text-decoration:none;">info@davo.md</a>.
    </p>
  `;
  return layout({
    preheader: `Rezervarea ${b.bookingNumber} a fost anulată`,
    title: "Rezervare anulată",
    eyebrow: "Anulată",
    eyebrowColor: "rgba(255,255,255,0.7)",
    body,
  });
}

// ----- Admin notification -----

export function adminNotificationHtml(b: ConfirmationData): string {
  const isParcel = b.type === "parcel";
  const depTime = isParcel ? null : (b.departureTime ?? formatTime(b.departureDate));
  const plecareValue = depTime
    ? `${formatDate(b.departureDate)} · ${depTime}`
    : formatDate(b.departureDate);
  const rows: DetailRow[] = [
    { label: "Nr. rezervare", value: b.bookingNumber },
    { label: "Tip", value: isParcel ? "Colet" : "Pasager" },
    { label: "Client", value: b.firstName },
    { label: "Cursa", value: `${b.departureCity} → ${b.arrivalCity}` },
    { label: "Plecare", value: plecareValue },
  ];
  if (!isParcel) {
    rows.push({ label: "Pasageri", value: paxLine(b.adults, b.children) });
  }
  rows.push({ label: "Total", value: formatPrice(b.price, b.currency) });
  rows.push({ label: "Plata", value: payLabel(b.payMethod) });

  const body = `
    ${headline(`${b.firstName} a făcut o rezervare.`)}
    ${detailsCard(rows)}
    <div style="text-align:center;">
      <a href="${appUrl()}/admin/bookings"
         style="display:inline-block;background:${C.navy900};color:#fff;text-decoration:none;padding:14px 28px;border-radius:999px;font-family:${FONT_DISPLAY};font-weight:800;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;">
        Vezi în panoul admin →
      </a>
    </div>
  `;
  return layout({
    preheader: `Rezervare nouă ${b.bookingNumber}`,
    title: `Rezervare nouă — ${b.bookingNumber}`,
    eyebrow: "Rezervare nouă",
    body,
  });
}

// ----- Subjects -----

// ----- Admin trip manifest (24h before) -----

export type TripManifestPassenger = {
  bookingNumber: string;
  isParcel: boolean;
  passengerNames: string;   // "Andrei Popescu" sau "Andrei, Ion / Popescu, Vasile"
  phone: string;
  email: string;
  arrivalCity: string;      // destinația specifică a clientului (poate diferi de capul de cursă)
  seats: number[];          // locurile rezervate pe ACEASTĂ cursă (dus sau retur)
  paxCount: number;
  price: number;
  currency: string;
  payMethod: string | null;
  parcelDetails: string | null;
};

export type TripManifestData = {
  origin: string;                 // "Chișinău"
  originCountry: string;          // "Moldova"
  destination: string;            // "York"
  destinationCountry: string;     // "Anglia"
  departureDate: Date;
  localTime: string;              // "07:00" — citit din schedule (NU din departureDate)
  busLabel: string;               // "Setra S517 · NR 444 AS"
  totalSeats: number;             // capacity
  passengers: TripManifestPassenger[];
  adminUrl: string;
};

export function adminTripManifestHtml(d: TripManifestData): string {
  const totalPax = d.passengers.reduce((s, p) => s + p.paxCount, 0);
  const totalSeats = d.passengers.reduce((s, p) => s + p.seats.length, 0);
  const totalRevenue = d.passengers.reduce((s, p) => s + p.price, 0);
  const occupancy = d.totalSeats > 0 ? Math.round((totalSeats / d.totalSeats) * 100) : 0;
  const currencies = Array.from(new Set(d.passengers.map((p) => p.currency))).filter(Boolean);
  const revenueLabel = currencies.length === 1
    ? formatPrice(totalRevenue, currencies[0])
    : `${totalRevenue} (mixt: ${currencies.join(", ")})`;

  const rows: DetailRow[] = [
    { label: "Cursa", value: `${d.origin}, ${d.originCountry} → ${d.destination}, ${d.destinationCountry}` },
    { label: "Plecare", value: `${formatDate(d.departureDate)} · ${d.localTime} (ora locală)` },
    { label: "Autocar", value: d.busLabel },
    { label: "Ocupare", value: `${totalSeats}/${d.totalSeats} locuri (${occupancy}%) · ${totalPax} pasageri` },
    { label: "Total încasat", value: revenueLabel },
  ];

  const passengerRows = d.passengers.length === 0
    ? `<tr><td colspan="6" style="padding:18px;text-align:center;color:${C.ink500};font-style:italic;">Nicio rezervare pe această cursă.</td></tr>`
    : d.passengers
        .map((p, i) => {
          const seatsLabel = p.seats.length ? p.seats.join(", ") : "—";
          const payLabel = p.isParcel ? "Colet" : `${p.paxCount} pax`;
          const dest = p.arrivalCity.replace(/, /g, ",&#8202;");
          return `
        <tr style="${i % 2 === 0 ? `background:${C.ink50};` : ""}">
          <td style="padding:10px 12px;font-family:${FONT_BODY};font-size:12px;color:${C.navy900};border-bottom:1px solid ${C.ink200};">
            <div style="font-weight:700;">${p.passengerNames}</div>
            <div style="color:${C.ink500};font-size:11px;margin-top:2px;font-family:monospace;">${p.bookingNumber}</div>
          </td>
          <td style="padding:10px 12px;font-family:${FONT_BODY};font-size:12px;color:${C.navy900};border-bottom:1px solid ${C.ink200};">
            <a href="tel:${p.phone}" style="color:${C.navy900};text-decoration:none;">${p.phone}</a><br>
            <a href="mailto:${p.email}" style="color:${C.ink500};text-decoration:none;font-size:11px;">${p.email}</a>
          </td>
          <td style="padding:10px 12px;font-family:${FONT_BODY};font-size:12px;color:${C.navy900};border-bottom:1px solid ${C.ink200};">${dest}</td>
          <td style="padding:10px 12px;font-family:${FONT_BODY};font-size:13px;font-weight:700;color:${C.navy900};border-bottom:1px solid ${C.ink200};text-align:center;">${seatsLabel}</td>
          <td style="padding:10px 12px;font-family:${FONT_BODY};font-size:12px;color:${C.navy900};border-bottom:1px solid ${C.ink200};text-align:right;">${formatPrice(p.price, p.currency)}<br><span style="color:${C.ink500};font-size:11px;">${payLabel}</span></td>
        </tr>`;
        })
        .join("");

  const passengerTable = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border:1px solid ${C.ink200};border-radius:14px;overflow:hidden;margin:0 0 28px;">
      <tr style="background:${C.navy900};color:#ffffff;">
        <th style="padding:11px 12px;font-family:${FONT_BODY};font-size:10px;text-transform:uppercase;letter-spacing:1.4px;text-align:left;">Pasager / Nr.</th>
        <th style="padding:11px 12px;font-family:${FONT_BODY};font-size:10px;text-transform:uppercase;letter-spacing:1.4px;text-align:left;">Contact</th>
        <th style="padding:11px 12px;font-family:${FONT_BODY};font-size:10px;text-transform:uppercase;letter-spacing:1.4px;text-align:left;">Destinație</th>
        <th style="padding:11px 12px;font-family:${FONT_BODY};font-size:10px;text-transform:uppercase;letter-spacing:1.4px;text-align:center;">Loc</th>
        <th style="padding:11px 12px;font-family:${FONT_BODY};font-size:10px;text-transform:uppercase;letter-spacing:1.4px;text-align:right;">Tarif</th>
      </tr>
      ${passengerRows}
    </table>`;

  const body = `
    ${headline(`Mâine pleacă cursa ${d.origin} → ${d.destination}.`)}
    ${intro(`Peste ~24h pleacă cursa <strong style="color:${C.navy900};">${d.origin}, ${d.originCountry} → ${d.destination}, ${d.destinationCountry}</strong>. Mâine la <strong style="color:${C.red500};">${d.localTime}</strong> (ora locală a plecării). Mai jos manifestul complet — pregătește listele și sună pasagerii dacă mai e nevoie.`)}
    ${detailsCard(rows)}
    <h3 style="margin:0 0 14px;font-family:${FONT_DISPLAY};font-size:18px;font-weight:800;color:${C.navy900};">Manifest pasageri</h3>
    ${passengerTable}
    <div style="text-align:center;">
      <a href="${d.adminUrl}" style="display:inline-block;background:${C.red500};color:#fff;text-decoration:none;padding:14px 28px;border-radius:999px;font-family:${FONT_DISPLAY};font-weight:800;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;box-shadow:0 14px 28px -12px rgba(225,30,43,0.55);">
        Vezi cursa în admin
      </a>
    </div>
  `;

  return layout({
    preheader: `Manifest cursă ${d.origin} → ${d.destination} — mâine ${d.localTime}, ${totalPax} pasageri`,
    title: `DAVO admin · ${d.origin} → ${d.destination} (mâine ${d.localTime})`,
    eyebrow: "Manifest cursă · 24h",
    eyebrowColor: C.red400,
    body,
  });
}

// ----- Admin country manifest (24h before, ONE email per country/day) -----
//
// Înlocuiește vechile manifeste per cursă: în loc de 40 de email-uri cu o
// rută fiecare, admin primește unul per țară per zi, cu toate cursele
// agregate. Cursele fără pasageri sunt omise complet (numite în array dar
// nu apar în output) ca să nu pollueze inbox-ul.

export type CountryManifestData = {
  countryName: string;       // "Anglia"
  dateLabel: string;         // "Joi, 11 iunie 2026"
  trips: TripManifestData[]; // doar curse cu passengers.length > 0
  adminUrl: string;          // /admin/trips?date=YYYY-MM-DD
};

export function adminCountryManifestHtml(d: CountryManifestData): string {
  // Sumar agregat across all trips
  const allPassengers = d.trips.flatMap((t) => t.passengers);
  const totalPax = allPassengers.reduce((s, p) => s + p.paxCount, 0);
  const totalSeats = allPassengers.reduce((s, p) => s + p.seats.length, 0);
  const totalCapacity = d.trips.reduce((s, t) => s + t.totalSeats, 0);
  const totalRevenue = allPassengers.reduce((s, p) => s + p.price, 0);
  const occupancy = totalCapacity > 0 ? Math.round((totalSeats / totalCapacity) * 100) : 0;
  const currencies = Array.from(new Set(allPassengers.map((p) => p.currency))).filter(Boolean);
  const revenueLabel = currencies.length === 1
    ? formatPrice(totalRevenue, currencies[0])
    : `${totalRevenue} (mixt: ${currencies.join(", ")})`;

  const summaryRows: DetailRow[] = [
    { label: "Țară", value: d.countryName },
    { label: "Data", value: d.dateLabel },
    { label: "Curse cu pasageri", value: `${d.trips.length}` },
    { label: "Ocupare totală", value: `${totalSeats}/${totalCapacity} (${occupancy}%) · ${totalPax} pasageri` },
    { label: "Total încasat", value: revenueLabel },
  ];

  // Pentru fiecare cursă: header compact + tabel pasageri.
  const tripsSection = d.trips
    .map((t) => {
      const tripSeats = t.passengers.reduce((s, p) => s + p.seats.length, 0);
      const tripPax = t.passengers.reduce((s, p) => s + p.paxCount, 0);
      const tripRevenue = t.passengers.reduce((s, p) => s + p.price, 0);
      const tripCurrencies = Array.from(new Set(t.passengers.map((p) => p.currency))).filter(Boolean);
      const tripRevenueLabel = tripCurrencies.length === 1
        ? formatPrice(tripRevenue, tripCurrencies[0])
        : `${tripRevenue}`;

      const rows = t.passengers
        .map((p, i) => {
          const seatsLabel = p.seats.length ? p.seats.join(", ") : "—";
          const dest = p.arrivalCity.replace(/, /g, ",&#8202;");
          const paxLabel = p.isParcel ? "Colet" : `${p.paxCount} pax`;
          return `
        <tr style="${i % 2 === 0 ? `background:${C.ink50};` : ""}">
          <td style="padding:9px 11px;font-family:${FONT_BODY};font-size:12px;color:${C.navy900};border-bottom:1px solid ${C.ink200};">
            <div style="font-weight:700;">${p.passengerNames}</div>
            <div style="color:${C.ink500};font-size:11px;margin-top:2px;font-family:monospace;">${p.bookingNumber}</div>
          </td>
          <td style="padding:9px 11px;font-family:${FONT_BODY};font-size:12px;color:${C.navy900};border-bottom:1px solid ${C.ink200};">
            <a href="tel:${p.phone}" style="color:${C.navy900};text-decoration:none;">${p.phone}</a><br>
            <a href="mailto:${p.email}" style="color:${C.ink500};text-decoration:none;font-size:11px;">${p.email}</a>
          </td>
          <td style="padding:9px 11px;font-family:${FONT_BODY};font-size:12px;color:${C.navy900};border-bottom:1px solid ${C.ink200};">${dest}</td>
          <td style="padding:9px 11px;font-family:${FONT_BODY};font-size:13px;font-weight:700;color:${C.navy900};border-bottom:1px solid ${C.ink200};text-align:center;">${seatsLabel}</td>
          <td style="padding:9px 11px;font-family:${FONT_BODY};font-size:12px;color:${C.navy900};border-bottom:1px solid ${C.ink200};text-align:right;">${formatPrice(p.price, p.currency)}<br><span style="color:${C.ink500};font-size:11px;">${paxLabel}</span></td>
        </tr>`;
        })
        .join("");

      return `
        <div style="margin:0 0 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:${C.navy900};color:#ffffff;border-radius:12px 12px 0 0;overflow:hidden;">
            <tr>
              <td style="padding:14px 18px;">
                <div style="font-family:${FONT_DISPLAY};font-size:15px;font-weight:800;letter-spacing:-0.01em;">
                  ${t.origin} <span style="color:${C.red400};">→</span> ${t.destination}
                </div>
                <div style="margin-top:4px;font-family:${FONT_BODY};font-size:12px;color:rgba(255,255,255,0.75);">
                  Plecare <strong style="color:#fff;">${t.localTime}</strong>
                  · ${t.busLabel}
                  · ${tripSeats}/${t.totalSeats} locuri
                  · ${tripPax} pax
                  · ${tripRevenueLabel}
                </div>
              </td>
            </tr>
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border:1px solid ${C.ink200};border-top:none;border-radius:0 0 12px 12px;overflow:hidden;">
            <tr style="background:${C.ink100};">
              <th style="padding:9px 11px;font-family:${FONT_BODY};font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:${C.ink700};text-align:left;">Pasager / Nr.</th>
              <th style="padding:9px 11px;font-family:${FONT_BODY};font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:${C.ink700};text-align:left;">Contact</th>
              <th style="padding:9px 11px;font-family:${FONT_BODY};font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:${C.ink700};text-align:left;">Destinație</th>
              <th style="padding:9px 11px;font-family:${FONT_BODY};font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:${C.ink700};text-align:center;">Loc</th>
              <th style="padding:9px 11px;font-family:${FONT_BODY};font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:${C.ink700};text-align:right;">Tarif</th>
            </tr>
            ${rows}
          </table>
        </div>`;
    })
    .join("");

  const body = `
    ${headline(`Mâine pe ${d.countryName}.`)}
    ${intro(`Mai jos manifestul pentru toate cursele de mâine spre/dinspre <strong style="color:${C.navy900};">${d.countryName}</strong>. ${d.dateLabel}. Cursele fără rezervări nu sunt listate.`)}
    ${detailsCard(summaryRows)}
    ${d.trips.length > 0 ? tripsSection : `<p style="margin:0;padding:18px;text-align:center;color:${C.ink500};font-style:italic;">Nicio rezervare pe nicio cursă a acestei țări pentru data ${d.dateLabel}.</p>`}
    <div style="text-align:center;margin-top:8px;">
      <a href="${d.adminUrl}" style="display:inline-block;background:${C.red500};color:#fff;text-decoration:none;padding:14px 28px;border-radius:999px;font-family:${FONT_DISPLAY};font-weight:800;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;box-shadow:0 14px 28px -12px rgba(225,30,43,0.55);">
        Vezi cursele în admin
      </a>
    </div>
  `;

  return layout({
    preheader: `${d.countryName} · ${d.dateLabel} · ${totalPax} pasageri pe ${d.trips.length} curse`,
    title: `DAVO admin · ${d.countryName} · mâine`,
    eyebrow: `${d.countryName} · 24h`,
    eyebrowColor: C.red400,
    body,
  });
}

export function subjectForType(type: string, bookingNumber: string): string {
  switch (type) {
    case "confirmation":
      return `Rezervare confirmată — DAVO ${bookingNumber}`;
    case "reminder_24h":
      return "Mâine pleci cu DAVO — confirmă-ne că vii";
    case "cancellation":
      return `Rezervare ${bookingNumber} anulată`;
    default:
      return "DAVO Group";
  }
}
