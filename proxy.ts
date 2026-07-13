import { NextRequest, NextResponse } from "next/server";
import { verifyOperatorToken, OPERATOR_COOKIE } from "@/lib/operatorSession";

// ===== Panou operatori (davo-operatori) =====
// Întreaga aplicație e internă: necesită sesiune de operator (login cu PIN).
// Excepții publice: ecranul de login + endpoint-urile lui + cron-ul de arhivare.

function isPublic(pathname: string): boolean {
  return (
    pathname === "/panou/login" ||
    pathname.startsWith("/api/operator/login") ||
    pathname.startsWith("/api/operator/list") ||
    pathname.startsWith("/api/cron") ||
    // Linkuri din emailurile clienților (Confirm/Anulez, QR bilet) — publice.
    // Emailurile vechi pointau spre acest domeniu; fără astea, clientul primea
    // „Unauthorized" la Confirm. Securitatea vine din tokenul HMAC, nu din PIN.
    pathname.startsWith("/api/bookings/respond") ||
    pathname.startsWith("/api/tickets") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  );
}

// Pagini de CLIENT (din emailuri): biletul + tracking-ul. Nu cer PIN, dar
// primesc rescrierea /ro ca restul site-ului (sunt sub [lang]).
function isPublicPage(pathname: string): boolean {
  return (
    pathname.startsWith("/bilet") ||
    pathname.startsWith("/livrare")
  );
}

// Pagini care NU trebuie rescrise cu locale (panou, api, login, static).
function shouldSkipLocale(pathname: string): boolean {
  return (
    pathname.startsWith("/panou") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/_next") ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  );
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Davo admin nu există în panoul operatorilor — blocăm complet.
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ success: false, error: "Indisponibil" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/panou", req.url));
  }

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  if (!isPublicPage(pathname)) {
    const session = await verifyOperatorToken(req.cookies.get(OPERATOR_COOKIE)?.value);
    if (!session) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }
      const url = new URL("/panou/login", req.url);
      if (pathname !== "/") url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }

    // Operator autentificat.
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/panou", req.url));
    }
  }

  if (shouldSkipLocale(pathname)) {
    return NextResponse.next();
  }

  // Restul (formularul de rezervare = paginile site-ului) → rescriere la /ro.
  const url = req.nextUrl.clone();
  url.pathname = `/ro${pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|apple-icon.png|icon.png|images/|videos/).*)"],
};
