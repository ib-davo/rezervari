import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperatorToken, OPERATOR_COOKIE } from "@/lib/operatorSession";
import { cancelForBooking, enqueueRemindersOnly, sendCancellationNow } from "@/lib/emailQueue";
import { seatDataForBooking } from "@/lib/operatorSeats";
import { findDuplicateByPhone, duplicateMessageForOperator, phoneKey, passengerKeys, type DuplicateBooking } from "@/lib/duplicatePhone";

export const dynamic = "force-dynamic";

// Verificarea de dublură de dinaintea tranzacției lasă o fereastră (validarea
// locurilor face între timp propriile interogări) în care o salvare concurentă
// poate strecura același om. Ca la creare (/api/bookings), recontrolăm în
// tranzacție; eroarea o aruncăm ca să anulăm scrierile și o traducem afară în 409.
class DuplicatePhoneEditError extends Error {
  constructor(public dup: DuplicateBooking) {
    super("duplicate-phone");
  }
}

// Operatorul poate confirma / anula manual + marca plata. Statutul se vede instant
// și pe davo (aceeași tabelă Booking). passengerResponse rămâne sursa din email.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyOperatorToken(req.cookies.get(OPERATOR_COOKIE)?.value);
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  // ===== Editare rezervare (anulare parțială + adresă + preț + locuri) =====
  // { edit: { firstName?, lastName?, adults?, departureCity?, arrivalCity?,
  //           price?, freeSeats?: [{tripId, seatNumber}],
  //           seats?: [{tripId, seatNumbers:number[]}] } }
  // Folosit când un pasager dintr-un grup renunță: operatorul îl scoate,
  // eliberează locul lui (dus + retur) și ajustează prețul/adresa.
  if (body.edit && typeof body.edit === "object") {
    const e = body.edit as Record<string, unknown>;
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        seatBookings: { select: { id: true, tripId: true, seatNumber: true } },
        // Ziua cursei reale — editarea datei nu are voie să plece de lângă ea.
        trip: { select: { departureAt: true } },
        returnTrip: { select: { departureAt: true } },
      },
    });
    if (!booking) return NextResponse.json({ success: false, error: "Rezervare inexistentă" }, { status: 404 });
    if (booking.archivedAt) return NextResponse.json({ success: false, error: "Rezervarea e arhivată" }, { status: 400 });
    if (booking.status === "cancelled") {
      return NextResponse.json({ success: false, error: "Rezervarea e anulată — nu se mai editează" }, { status: 400 });
    }

    const upd: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof e.firstName === "string" && e.firstName.trim()) upd.firstName = e.firstName.trim();
    if (typeof e.lastName === "string" && e.lastName.trim()) upd.lastName = e.lastName.trim();
    if (typeof e.departureCity === "string" && e.departureCity.trim()) upd.departureCity = e.departureCity.trim();
    if (typeof e.arrivalCity === "string" && e.arrivalCity.trim()) upd.arrivalCity = e.arrivalCity.trim();
    if (e.adults != null) {
      const a = Number(e.adults);
      if (!Number.isInteger(a) || a < 1) {
        return NextResponse.json({ success: false, error: "Rezervarea trebuie să rămână cu cel puțin 1 pasager" }, { status: 400 });
      }
      upd.adults = a;
    }
    if (e.price != null) {
      const p = Number(e.price);
      if (!Number.isFinite(p) || p < 0) {
        return NextResponse.json({ success: false, error: "Preț invalid" }, { status: 400 });
      }
      upd.price = Math.round(p * 100) / 100;
    }
    // Contact. Telefonul sub 6 cifre nu produce cheie de dedup (vezi phoneKey),
    // deci ar dezactiva tăcut protecția de dublură pentru rezervarea asta —
    // aceeași validare ca la creare.
    if (typeof e.phone === "string") {
      const p = e.phone.trim();
      if (p.replace(/\D/g, "").length < 6) {
        return NextResponse.json(
          { success: false, error: "Număr de telefon prea scurt — scrie numărul complet (cu prefix)." },
          { status: 400 }
        );
      }
      upd.phone = p;
    }
    if (typeof e.email === "string") upd.email = e.email.trim();
    // Monedă (Anglia £ / Europa €)
    if (e.currency === "EUR" || e.currency === "GBP") upd.currency = e.currency;
    // Notițe (null când e gol)
    if (typeof e.notes === "string") upd.notes = e.notes.trim() || null;
    // Date — se schimbă DOAR ziua; ora reală a cursei se păstrează din valoarea existentă.
    const setDay = (iso: string, base: Date): Date | null => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
      if (!m) return null;
      return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], base.getUTCHours(), base.getUTCMinutes(), 0));
    };
    const utcDayOf = (d: Date) => d.toISOString().slice(0, 10);

    // Rezervarea legată de o cursă are DOUĂ zile care trebuie să rămână aceeași:
    // `departureDate` (pe care o citește verificarea de dublură) și `trip.departureAt`
    // (pe care o citesc listele, harta de locuri și manifestele). Editarea schimbă
    // doar câmpul de pe rezervare — nu și cursa, locurile sau reminderele. Dacă
    // le-am lăsa să se despartă, rezervarea ar bloca o zi și ar fi afișată pe alta,
    // invizibilă pentru operatorul care caută dublura (bug-ul DAVO-2026-TB23MN:
    // blocată pe 07.08, afișată pe cursa din 06.08). Mutarea pe altă zi are propria
    // cale — Reprogramare — care mută cursa, locurile, reminderele și anunță clientul.
    const dayMoveError = (tripDay: string) =>
      NextResponse.json(
        {
          success: false,
          error: `Rezervarea e pe cursa din ${tripDay.split("-").reverse().join(".")}. Ziua nu se schimbă din „Editează” — folosește „Reprogramare”, care mută și cursa, și locurile, și reminderele.`,
        },
        { status: 400 }
      );

    let dayChanged = false;
    if (typeof e.departureDate === "string" && e.departureDate) {
      const nd = setDay(e.departureDate, booking.departureDate);
      if (!nd) return NextResponse.json({ success: false, error: "Dată plecare invalidă" }, { status: 400 });
      // Doar o schimbare REALĂ de zi e refuzată — modalul retrimite mereu data
      // curentă, iar o editare de preț pe o rezervare deja desincronizată (rânduri
      // vechi) trebuie să rămână posibilă.
      if (utcDayOf(nd) !== utcDayOf(booking.departureDate)) {
        if (booking.trip) return dayMoveError(utcDayOf(booking.trip.departureAt));
        dayChanged = true;
      }
      upd.departureDate = nd;
    }
    if ("returnDate" in e) {
      if (!e.returnDate) {
        if (booking.returnTrip && booking.returnDate) return dayMoveError(utcDayOf(booking.returnTrip.departureAt));
        if (booking.returnDate) dayChanged = true;
        upd.returnDate = null;
      } else if (typeof e.returnDate === "string") {
        const nd = setDay(e.returnDate, booking.returnDate ?? booking.departureDate);
        if (!nd) return NextResponse.json({ success: false, error: "Dată retur invalidă" }, { status: 400 });
        if (!booking.returnDate || utcDayOf(nd) !== utcDayOf(booking.returnDate)) {
          if (booking.returnTrip) return dayMoveError(utcDayOf(booking.returnTrip.departureAt));
          dayChanged = true;
        }
        upd.returnDate = nd;
      }
    }

    // ===== Dublură pe telefon (aceeași verificare ca la CREARE) =====
    // Editarea poate schimba telefonul, numele sau — pe rezervările fără cursă —
    // ziua. Oricare din ele poate transforma o rezervare curată în exact dublura
    // pe care crearea o blochează (același om, înscris a doua oară). Fără
    // re-verificare, editarea era poarta tăcută de ocolire a blocajului.
    // Rulăm DOAR când unul din cele trei chiar se schimbă: rezervările vechi cu
    // dubluri pre-existente trebuie să rămână editabile la preț/adresă/locuri.
    let dupCheck: Parameters<typeof findDuplicateByPhone>[1] | null = null;
    if (booking.type === "passenger") {
      const newPhone = typeof upd.phone === "string" ? upd.phone : booking.phone;
      const newFirst = typeof upd.firstName === "string" ? upd.firstName : booking.firstName;
      const newLast = typeof upd.lastName === "string" ? upd.lastName : booking.lastName;
      // Comparăm pe CHEI, nu pe text brut: „+373 60..." vs „060..." și
      // „ion popescu" vs „Popescu Ion" sunt același telefon / același om.
      const phoneChanged = phoneKey(newPhone) !== phoneKey(booking.phone);
      const nameChanged =
        passengerKeys(newFirst, newLast).sort().join("|") !==
        passengerKeys(booking.firstName, booking.lastName).sort().join("|");
      if (phoneChanged || nameChanged || dayChanged) {
        dupCheck = {
          phone: newPhone,
          firstName: newFirst,
          lastName: newLast,
          departureDate: (upd.departureDate as Date | undefined) ?? booking.departureDate,
          returnDate: "returnDate" in upd ? (upd.returnDate as Date | null) : booking.returnDate,
          excludeBookingId: id, // rezervarea editată nu e dublura ei însăși
        };
        const dup = await findDuplicateByPhone(prisma, dupCheck);
        // Blocăm DOAR aceeași persoană. Alt nume pe același telefon (familie)
        // trece fără bifă: la creare bifa confirmă că operatorul adaugă cu bună
        // știință a doua persoană pe telefon, dar aici rezervarea există deja —
        // operatorul doar o corectează, nu mai adaugă pe nimeni pe cursă.
        if (dup && dup.samePerson) {
          return NextResponse.json({ success: false, error: duplicateMessageForOperator(dup) }, { status: 409 });
        }
      }
    }

    // ===== Locuri =====
    // Două căi (modalul trimite una SAU alta per cursă, nu ambele):
    //  • seats: reconciliază TOATE locurile rezervării pe o cursă la mulțimea nouă
    //    (schimbare de loc din hartă). Validăm circuit-aware — fiecare loc nou să fie
    //    valid în schemă și liber (ne-ocupat de ALȚII pe rulare + circuitul DAW 077).
    //  • freeSeats: eliberează locuri anume (pasager care renunță) — șterge rândurile.
    const seatsRaw = Array.isArray(e.seats) ? e.seats : [];
    const reconcile: { tripId: string; seatNumbers: number[] }[] = [];
    if (seatsRaw.length > 0) {
      const segData = await seatDataForBooking(id);
      const byTrip = new Map(segData.map((s) => [s.tripId, s]));
      for (const raw of seatsRaw) {
        const r = raw as { tripId?: unknown; seatNumbers?: unknown };
        const t = String(r?.tripId ?? "");
        if (t !== booking.tripId && t !== booking.returnTripId) {
          return NextResponse.json({ success: false, error: "Cursă necunoscută pentru locuri" }, { status: 400 });
        }
        const nums = Array.isArray(r?.seatNumbers) ? r.seatNumbers.map((x) => Number(x)) : [];
        if (nums.some((n) => !Number.isInteger(n) || n < 1)) {
          return NextResponse.json({ success: false, error: "Număr de loc invalid" }, { status: 400 });
        }
        if (new Set(nums).size !== nums.length) {
          return NextResponse.json({ success: false, error: "Același loc ales de două ori" }, { status: 400 });
        }
        const seg = byTrip.get(t);
        if (seg) {
          const occ = new Set(seg.occupied); // ocupate de ALȚII (propriile locuri sunt excluse)
          const valid = seg.layoutSeats.length ? new Set(seg.layoutSeats) : null;
          for (const n of nums) {
            if (occ.has(n)) {
              return NextResponse.json({ success: false, error: `Locul ${n} e deja ocupat` }, { status: 409 });
            }
            if (valid && !valid.has(n)) {
              return NextResponse.json({ success: false, error: `Locul ${n} nu există în acest autocar` }, { status: 400 });
            }
          }
        }
        reconcile.push({ tripId: t, seatNumbers: nums });
      }
    }

    // freeSeats: doar pentru cursele NEreconciliate (reconcilierea le rescrie oricum).
    const seatTripIds = new Set(reconcile.map((r) => r.tripId));
    const freeSeats = Array.isArray(e.freeSeats) ? e.freeSeats : [];
    const toDelete: string[] = [];
    for (const raw of freeSeats) {
      const fs = raw as { tripId?: unknown; seatNumber?: unknown };
      const t = String(fs?.tripId ?? "");
      if (seatTripIds.has(t)) continue;
      const n = Number(fs?.seatNumber);
      const row = booking.seatBookings.find((s) => s.tripId === t && s.seatNumber === n);
      if (!row) {
        return NextResponse.json({ success: false, error: `Locul ${n} nu aparține acestei rezervări` }, { status: 400 });
      }
      toDelete.push(row.id);
    }

    try {
      await prisma.$transaction(async (tx) => {
        // Recontrol de dublură (ca la creare): două salvări simultane ale
        // aceleiași persoane trec amândouă de verificarea de mai sus înainte
        // ca vreuna să scrie. Aici fereastra e de milisecunde.
        if (dupCheck) {
          const dup = await findDuplicateByPhone(tx, dupCheck);
          if (dup && dup.samePerson) throw new DuplicatePhoneEditError(dup);
        }
        if (toDelete.length > 0) {
          await tx.seatBooking.deleteMany({ where: { id: { in: toDelete }, bookingId: id } });
        }
        // Reconciliere loc: șterge locurile proprii pe cursă, apoi pune-le pe cele noi.
        for (const r of reconcile) {
          await tx.seatBooking.deleteMany({ where: { bookingId: id, tripId: r.tripId } });
          if (r.seatNumbers.length > 0) {
            await tx.seatBooking.createMany({
              data: r.seatNumbers.map((n) => ({ tripId: r.tripId, seatNumber: n, bookingId: id })),
            });
          }
        }
        await tx.booking.update({ where: { id }, data: upd });
      });
    } catch (err) {
      if (err instanceof DuplicatePhoneEditError) {
        return NextResponse.json({ success: false, error: duplicateMessageForOperator(err.dup) }, { status: 409 });
      }
      // @@unique([tripId, seatNumber]): cineva a luat locul între validare și salvare.
      if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") {
        return NextResponse.json({ success: false, error: "Un loc tocmai a fost ocupat de altcineva — reîncarcă și încearcă din nou." }, { status: 409 });
      }
      throw err;
    }

    // Ziua s-a mutat pe o rezervare fără cursă (singurul caz care mai trece de
    // gardă): reminderele erau calculate pe data veche, deci ar pleca la ziua
    // greșită. Aceeași reprogramare ca la „Reprogramare”.
    if (dayChanged) {
      await prisma.emailJob
        .updateMany({
          where: { bookingId: id, type: { in: ["reminder_24h", "reminder_2h", "review_request"] }, status: { in: ["scheduled", "queued"] } },
          data: { status: "cancelled" },
        })
        .catch(() => {});
      await enqueueRemindersOnly(id).catch((err) => console.error("enqueueReminders after edit:", err));
    }

    return NextResponse.json({ success: true });
  }

  // ===== Îmbarcare (scanner QR din panou) =====
  // { board: { boarded: boolean, baggageSurplus?: string|null, markPaid?: boolean } }
  if (body.board && typeof body.board === "object") {
    const bd = body.board as Record<string, unknown>;
    const bk = await prisma.booking.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!bk) return NextResponse.json({ success: false, error: "Rezervare inexistentă" }, { status: 404 });
    if (bk.status === "cancelled") {
      return NextResponse.json({ success: false, error: "Rezervarea e ANULATĂ — nu se îmbarcă" }, { status: 400 });
    }
    const upd: Record<string, unknown> = { updatedAt: new Date() };
    if (bd.boarded === true) {
      upd.boardedAt = new Date();
      upd.boardedBy = session.name ?? null;
    } else if (bd.boarded === false) {
      upd.boardedAt = null;
      upd.boardedBy = null;
    }
    if (typeof bd.baggageSurplus === "string") upd.baggageSurplus = bd.baggageSurplus.trim() || null;
    if (bd.baggageSurplus === null) upd.baggageSurplus = null;
    if (bd.markPaid === true) {
      upd.paymentStatus = "paid";
      upd.paidAt = new Date();
    }
    // Dropdown-ul de stare din listă trimite retragerea îmbarcării ȘI noua stare
    // de contact într-un singur request (o stare, nu două câmpuri separate).
    if (typeof body.passengerResponse === "string" && ["confirmed", "no_answer", "cancelled"].includes(body.passengerResponse)) {
      upd.passengerResponse = body.passengerResponse;
      upd.passengerResponseAt = new Date();
    } else if (body.passengerResponse === null) {
      upd.passengerResponse = null;
      upd.passengerResponseAt = null;
    }
    await prisma.booking.update({ where: { id }, data: upd });
    return NextResponse.json({ success: true });
  }

  const data: Record<string, unknown> = { updatedAt: new Date() };

  if (typeof body.status === "string" && ["pending", "confirmed", "cancelled"].includes(body.status)) {
    data.status = body.status;
    if (body.status === "confirmed") data.confirmedAt = new Date();
  }
  if (typeof body.paymentStatus === "string" && ["pending", "paid"].includes(body.paymentStatus)) {
    data.paymentStatus = body.paymentStatus;
    if (body.paymentStatus === "paid") data.paidAt = new Date();
  }
  // Statut de CONFIRMARE (contact) setat de operator — mai ales pentru pasagerii
  // fără email, pe care operatorul îi sună: confirmat / nu răspunde / anulat.
  // Soft: NU schimbă statutul rezervării (anularea „hard" = body.status=cancelled).
  if (typeof body.passengerResponse === "string" && ["confirmed", "no_answer", "cancelled"].includes(body.passengerResponse)) {
    data.passengerResponse = body.passengerResponse;
    data.passengerResponseAt = new Date();
  } else if (body.passengerResponse === null) {
    // „Necontactat" din dropdown = revenire la starea inițială.
    data.passengerResponse = null;
    data.passengerResponseAt = null;
  }
  if (body.archive === true) data.archivedAt = new Date();
  if (body.archive === false) data.archivedAt = null;

  // Atribuire autobuz manual (alătură rezervarea foii fizice a autobuzului).
  // string = Bus.id, null = scoate atribuirea. Validăm că autobuzul există.
  if (body.manualBusId === null) {
    data.manualBusId = null;
  } else if (typeof body.manualBusId === "string" && body.manualBusId.length > 0) {
    const bus = await prisma.bus.findFirst({ where: { id: body.manualBusId, active: true }, select: { id: true } });
    if (!bus) return NextResponse.json({ success: false, error: "Autocar inexistent sau inactiv" }, { status: 400 });
    data.manualBusId = bus.id;
  }

  const existing = await prisma.booking.findUnique({
    where: { id },
    select: { id: true, status: true, departureDate: true, returnDate: true, archivedAt: true },
  });
  if (!existing) return NextResponse.json({ success: false, error: "Rezervare inexistentă" }, { status: 404 });

  // O cursă care a plecat deja nu se mai anulează — ar elibera locuri degeaba
  // și ar trimite clientului email de anulare pentru o călătorie trecută (ex.
  // un tab vechi rămas deschis pe Active). Aceeași convenție de „trecut" ca în
  // GET: comparăm cu ORA reală de plecare (retur dacă există), nu cu ziua.
  if (data.status === "cancelled") {
    const last = existing.returnDate ?? existing.departureDate;
    if (existing.archivedAt || new Date(last) < new Date()) {
      return NextResponse.json(
        { success: false, error: "Cursa a plecat deja — rezervarea nu mai poate fi anulată." },
        { status: 400 }
      );
    }
  }

  // Anulare: tranziție atomică (doar UN request câștigă trecerea în cancelled),
  // ca două tab-uri/operatori concurenți să nu ruleze efectele secundare de 2 ori.
  let cancelledNow = false;
  if (data.status === "cancelled") {
    const r = await prisma.booking.updateMany({
      where: { id, status: { not: "cancelled" } },
      data,
    });
    cancelledNow = r.count > 0;
  } else {
    await prisma.booking.update({ where: { id }, data });
  }

  // Aceleași efecte secundare ca anularea din email (vezi /api/bookings/respond):
  // altfel locurile rămân ocupate pe cursă și reminder-ele pleacă degeaba.
  if (cancelledNow) {
    await prisma.seatBooking.deleteMany({ where: { bookingId: id } });
    // Oprește job-urile programate, apoi trimite anularea IMEDIAT (nu la cron-ul
    // de a doua zi). cancelForBooking(id, false) doar oprește reminderele.
    await cancelForBooking(id, false).catch((e) => console.error("cancelForBooking:", e));
    await sendCancellationNow(id).catch((e) => console.error("sendCancellationNow:", e));
  }

  // Anulare din greșeală + re-confirmare imediată: retrage emailul de anulare
  // încă netrimis (altfel cron-ul davo îl livrează deși booking-ul e confirmat)
  // și repune reminder-ul 24h. Locurile NU se realocă automat — se aleg din davo.
  if (data.status === "confirmed" && existing.status === "cancelled") {
    await prisma.emailJob.updateMany({
      where: { bookingId: id, type: "cancellation", status: "queued", sentAt: null },
      data: { status: "cancelled" },
    });
    await enqueueRemindersOnly(id).catch((e) => console.error("enqueueReminders:", e));
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: { id: true, status: true, paymentStatus: true, archivedAt: true },
  });
  return NextResponse.json({ success: true, booking });
}
