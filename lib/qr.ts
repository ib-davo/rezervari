import QRCode from "qrcode";
import { appUrl, publicAppUrl } from "@/lib/appUrl";

// QR-ul de pe bilet e scanat de telefoane externe — trebuie să fie întotdeauna
// URL public canonic (davo.md), nu localhost, indiferent de mediul în care e
// generat.
export function ticketUrl(bookingNumber: string): string {
  return `${publicAppUrl()}/bilet/${bookingNumber}`;
}

export function qrPngUrl(bookingNumber: string): string {
  return `${appUrl()}/api/tickets/${bookingNumber}/qr.png`;
}

export async function generateQrPng(bookingNumber: string): Promise<Buffer> {
  return QRCode.toBuffer(ticketUrl(bookingNumber), {
    errorCorrectionLevel: "M",
    width: 300,
    margin: 2,
    color: { dark: "#1f2937", light: "#ffffff" },
  });
}

export async function generateQrDataUrl(bookingNumber: string): Promise<string> {
  return QRCode.toDataURL(ticketUrl(bookingNumber), {
    errorCorrectionLevel: "M",
    width: 300,
    margin: 2,
    color: { dark: "#1f2937", light: "#ffffff" },
  });
}
