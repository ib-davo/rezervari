import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sendBookingConfirmation, sendAdminNotification, BookingConfirmationData } from '@/lib/email'
import { calculatePrice, calculatePriceFromRoute, calculateParcelPrice, seatSurcharge } from '@/lib/pricing'
import { occupiedSeatsForRun } from '@/lib/runSeats'
import { autoLinkTripAndClient } from '@/lib/bookingLink'
import { enqueueRemindersOnly } from '@/lib/emailQueue'
import { createBookingToken, bookingResponseUrl } from '@/lib/bookingToken'
import { publicAppUrl } from '@/lib/appUrl'
import { verifyOperatorToken, OPERATOR_COOKIE } from '@/lib/operatorSession'
import {
  findDuplicateByPhone,
  duplicateMessageForOperator,
  duplicateMessagePublic,
  type DuplicateBooking,
} from '@/lib/duplicatePhone'
import type { SeatLayout } from '@/lib/adminMock'

// Dublură de telefon prinsă ÎN tranzacție (doi operatori care salvează în
// aceeași secundă). O aruncăm ca să anulăm tranzacția, o traducem afară în 409.
class DuplicatePhoneError extends Error {
  constructor(readonly dup: DuplicateBooking) {
    super('duplicate phone')
  }
}

// Cine poate trece peste avertisment: DOAR un operator, DOAR când e alt nume pe
// același telefon (familia care rezervă de pe telefonul unuia singur) și DOAR
// dacă a bifat explicit confirmarea. Același om înscris a doua oară nu trece
// niciodată — ăsta e chiar bug-ul pe care îl închidem. Pe site nu există bifă.
function allowedDuplicate(
  dup: DuplicateBooking,
  operator: { id: string } | null,
  body: { allowSamePhone?: unknown }
): boolean {
  return !!operator && !dup.samePerson && body.allowSamePhone === true
}

function duplicateResponse(dup: DuplicateBooking, operator: { id: string } | null) {
  return NextResponse.json(
    {
      success: false,
      error: operator ? duplicateMessageForOperator(dup) : duplicateMessagePublic(dup),
      duplicate: {
        samePerson: dup.samePerson,
        canOverride: !!operator && !dup.samePerson,
        // Numărul rezervării altcuiva rămâne intern — pe site nu-l trimitem.
        ...(operator ? { bookingNumber: dup.bookingNumber, seats: dup.seats } : {}),
      },
    },
    { status: 409 }
  )
}

function generateBookingNumber(): string {
  const year = new Date().getFullYear()
  const random = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `DAVO-${year}-${random}`
}

type AnyLayout = SeatLayout | { decks: { layout: SeatLayout }[] }

function safeLayout(raw: string): AnyLayout {
  try {
    const l = JSON.parse(raw)
    if (l && Array.isArray((l as { decks: unknown[] }).decks)) return l as AnyLayout
    if (l && Array.isArray((l as SeatLayout).cells)) return l as SeatLayout
  } catch {}
  return { rows: 1, cols: 1, cells: ['empty'] }
}

function countSeatCells(layout: AnyLayout): number {
  if ('decks' in layout) {
    return layout.decks.reduce(
      (s, d) => s + d.layout.cells.filter((c) => c === 'seat').length,
      0,
    )
  }
  return layout.cells.filter((c) => c === 'seat').length
}

type TripWithRouteAndBus = Prisma.TripGetPayload<{
  include: { bus: true; route: { include: { originCity: true; destinationCity: true } } }
}>

type ValidationResult =
  | { ok: true; trip: TripWithRouteAndBus }
  | { ok: false; error: string }

async function validateTripSeats(tripId: string, seatNumbers: number[]): Promise<ValidationResult> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      bus: true,
      route: { include: { originCity: true, destinationCity: true } },
    },
  })
  if (!trip) return { ok: false, error: 'Cursa nu a fost găsită' }
  if (!['scheduled', 'boarding'].includes(trip.status)) {
    return { ok: false, error: 'Cursa nu mai acceptă rezervări' }
  }
  const layout = safeLayout(trip.bus.layoutJson)
  const total = countSeatCells(layout)
  for (const n of seatNumbers) {
    if (!Number.isInteger(n) || n < 1 || n > total) {
      return { ok: false, error: `Scaun invalid: ${n}` }
    }
  }
  if (new Set(seatNumbers).size !== seatNumbers.length) {
    return { ok: false, error: 'Scaune duplicate' }
  }
  // Backend = sursa de adevăr pentru ocupare: respinge locurile deja rezervate
  // pe ÎNTREAGA rulare fizică (toate trip-urile aceluiași autobuz din ziua aia),
  // chiar dacă harta din frontend e învechită. Vezi lib/runSeats.
  const taken = new Set(await occupiedSeatsForRun(tripId))
  const conflict = seatNumbers.filter((n) => taken.has(n))
  if (conflict.length > 0) {
    return { ok: false, error: `Locurile ${conflict.join(', ')} sunt deja rezervate. Alege altele.` }
  }
  return { ok: true, trip }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Panou operatori: dacă cererea vine dintr-o sesiune de operator, marcăm
    // sursa + cine a creat-o. Vizibil instant și pe davo (aceeași tabelă).
    const operator = await verifyOperatorToken(request.cookies.get(OPERATOR_COOKIE)?.value)

    const requiredFields = ['type', 'departureCity', 'arrivalCity', 'departureDate', 'firstName', 'lastName', 'email', 'phone']
    for (const field of requiredFields) {
      // Operatorii pot crea rezervări fără email (mulți clienți nu au) —
      // rămâne obligatoriu pentru rezervările de pe site.
      if (field === 'email' && operator) continue
      if (!body[field]) {
        return NextResponse.json(
          { success: false, error: `Lipsește câmpul: ${field}` },
          { status: 400 }
        )
      }
    }

    // Telefonul e singurul identificator pe care îl avem mereu — pe el se face
    // verificarea de dublură (lib/duplicatePhone). Un număr cu sub 6 cifre nu
    // identifică pe nimeni: phoneKey returnează cheie goală și dedup-ul se
    // dezactivează TĂCUT pentru rezervarea aia. Deci refuzăm de la intrare,
    // și pentru operator, și pentru site — 4 cifre nu sunt un telefon oricum.
    const phoneDigits = String(body.phone).replace(/\D/g, '')
    if (phoneDigits.length < 6) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Număr de telefon invalid: are sub 6 cifre. Scrie numărul complet al clientului ' +
            '(ex. 060123456 sau +373 60 123 456) — fără el nu putem verifica rezervările duble.',
        },
        { status: 400 }
      )
    }

    let departureDate = new Date(body.departureDate)
    let returnDate = body.returnDate ? new Date(body.returnDate) : null
    if (Number.isNaN(departureDate.getTime()) || (returnDate && Number.isNaN(returnDate.getTime()))) {
      return NextResponse.json({ success: false, error: 'Dată invalidă' }, { status: 400 })
    }

    const tripId: string | undefined = body.tripId || undefined
    const returnTripId: string | undefined = body.returnTripId || undefined

    // Când există cursă, ea dă data — nu ce a trimis clientul. Cele două trebuie
    // să rămână lipite: verificarea de dublură citește `booking.departureDate`,
    // iar listele, harta de locuri și manifestele citesc `trip.departureAt`. Dacă
    // se despart, rezervarea blochează o zi și e afișată pe alta — operatorul
    // primește un avertisment despre o rezervare pe care n-o găsește nicăieri
    // (bug-ul DAVO-2026-TB23MN). Panoul le trimite deja sincronizate; asta e plasa
    // pentru davo.md public și pentru orice alt client al acestui API.
    if (tripId || returnTripId) {
      const ids = [tripId, returnTripId].filter((x): x is string => !!x)
      const trips = await prisma.trip.findMany({
        where: { id: { in: ids } },
        select: { id: true, departureAt: true },
      })
      const out = trips.find((t) => t.id === tripId)
      const ret = trips.find((t) => t.id === returnTripId)
      if (out) departureDate = out.departureAt
      if (ret) returnDate = ret.departureAt
    }

    // Un pasager = O rezervare pe zi. Verificăm ÎNAINTE de validarea locurilor
    // și de trimiterea emailurilor, ca operatorul să afle imediat că omul e deja
    // înscris (l-a sunat și pe colegul lui) și să editeze rezervarea existentă.
    // Vezi lib/duplicatePhone — recontrolăm și în tranzacție, pentru salvări
    // simultane. Doar pasageri: un expeditor poate trimite mai multe colete/zi.
    const dupCheck = { phone: body.phone, firstName: body.firstName, lastName: body.lastName, departureDate, returnDate }
    if (body.type === 'passenger') {
      const dup = await findDuplicateByPhone(prisma, dupCheck)
      if (dup && !allowedDuplicate(dup, operator, body)) return duplicateResponse(dup, operator)
    }

    const seatNumbers: number[] = Array.isArray(body.seatNumbers)
      ? body.seatNumbers.map((n: unknown) => Number(n)).filter((n: number) => !Number.isNaN(n))
      : []
    const returnSeatNumbers: number[] = Array.isArray(body.returnSeatNumbers)
      ? body.returnSeatNumbers.map((n: unknown) => Number(n)).filter((n: number) => !Number.isNaN(n))
      : []

    const adults = Math.max(0, Number(body.adults) || 0)
    const children = Math.max(0, Number(body.children) || 0)
    const totalPassengers = body.type === 'passenger' ? Math.max(1, adults + children) : 0

    const payMethodRaw = typeof body.payMethod === 'string' ? body.payMethod : 'card'
    const payMethod = payMethodRaw === 'cash' ? 'cash_on_pickup' : 'card_on_pickup'

    if (tripId && seatNumbers.length !== totalPassengers) {
      return NextResponse.json(
        { success: false, error: `Alege ${totalPassengers} scaune pentru cursa dus` },
        { status: 400 }
      )
    }
    if (returnTripId && returnSeatNumbers.length !== totalPassengers) {
      return NextResponse.json(
        { success: false, error: `Alege ${totalPassengers} scaune pentru cursa retur` },
        { status: 400 }
      )
    }

    let outboundTrip: TripWithRouteAndBus | null = null

    if (tripId) {
      const v = await validateTripSeats(tripId, seatNumbers)
      if (!v.ok) return NextResponse.json({ success: false, error: v.error }, { status: 400 })
      outboundTrip = v.trip
    }
    let returnTrip: TripWithRouteAndBus | null = null

    if (returnTripId) {
      const v = await validateTripSeats(returnTripId, returnSeatNumbers)
      if (!v.ok) return NextResponse.json({ success: false, error: v.error }, { status: 400 })
      returnTrip = v.trip
    }

    let price: number
    let currency: string
    if (body.type === 'parcel') {
      // Colet: preț pe greutate (1.5/kg), NU tarif de pasager — chiar dacă are
      // cursă atașată. Valuta vine din ruta cursei când există (GBP pe Anglia).
      const res = outboundTrip
        ? calculateParcelPrice(Number(body.parcelWeight) || null, outboundTrip.route.currency, !!body.pickupFromAddress)
        : calculatePrice({
            departureCity: body.departureCity,
            arrivalCity: body.arrivalCity,
            type: 'parcel',
            parcelWeight: Number(body.parcelWeight) || null,
            pickupFromAddress: !!body.pickupFromAddress,
          })
      price = res.price
      currency = res.currency
    } else if (outboundTrip) {
      const res = calculatePriceFromRoute({
        basePrice: outboundTrip.route.basePrice,
        currency: outboundTrip.route.currency,
        seats: totalPassengers,
        roundTrip: !!returnTripId,
      })
      price = res.price
      currency = res.currency
      // Locuri premium (ex. DAW 777: 1–8, 25–28 = +30/loc) — pe fiecare segment.
      price += seatSurcharge(outboundTrip.bus.plate, seatNumbers)
      if (returnTrip) price += seatSurcharge(returnTrip.bus.plate, returnSeatNumbers)
    } else {
      const res = calculatePrice({
        departureCity: body.departureCity,
        arrivalCity: body.arrivalCity,
        type: body.type,
        tripType: body.tripType,
        adults: body.adults,
        children: body.children,
        parcelWeight: body.parcelWeight,
      })
      price = res.price
      currency = res.currency
    }

    // Rezervare manuală: un OPERATOR autentificat poate pune suma liberă pe bilet
    // (preț custom). Publicul de pe site NU poate — se ignoră dacă nu e operator.
    if (operator && body.customPrice != null && String(body.customPrice).trim() !== '') {
      const cp = Number(body.customPrice)
      if (Number.isFinite(cp) && cp >= 0) price = Math.round(cp)
    }

    // Moștenirea autocarului MUTAT manual: dacă restul rezervărilor de pe ACELAȘI
    // card (aceeași zi + același autocar programat) au fost mutate manual pe alt
    // autocar (ex. duminica Belgia mutată de pe ZNQ 874 pe DAW 777), rezervarea
    // nouă preia același autocar. Altfel ar apărea singură pe autocarul programat
    // în timp ce restul cardului e pe DAW 777 (bug raportat: „rezerv pe DAW 777,
    // se pune pe ZNQ"). Preluăm DOAR dacă mutarea e consistentă (un singur autocar).
    let inheritedManualBusId: string | null = null
    if (outboundTrip) {
      const dep = outboundTrip.departureAt
      const dayStart = new Date(Date.UTC(dep.getUTCFullYear(), dep.getUTCMonth(), dep.getUTCDate(), 0, 0, 0))
      const dayEnd = new Date(Date.UTC(dep.getUTCFullYear(), dep.getUTCMonth(), dep.getUTCDate(), 23, 59, 59, 999))
      const movedSiblings = await prisma.booking.findMany({
        where: {
          status: { not: 'cancelled' },
          manualBusId: { not: null },
          trip: { busId: outboundTrip.busId, departureAt: { gte: dayStart, lte: dayEnd } },
        },
        select: { manualBusId: true },
        distinct: ['manualBusId'],
      })
      if (movedSiblings.length === 1) inheritedManualBusId = movedSiblings[0].manualBusId
    }

    const bookingNumber = generateBookingNumber()

    let booking
    try {
      booking = await prisma.$transaction(async (tx) => {
        // Recontrol în tranzacție: doi operatori pot apăsa „Rezervă" în aceeași
        // secundă, iar verificarea de mai sus s-ar fi făcut la amândoi înainte
        // ca vreunul să scrie. Aici fereastra e de milisecunde.
        if (body.type === 'passenger') {
          const dup = await findDuplicateByPhone(tx, dupCheck)
          if (dup && !allowedDuplicate(dup, operator, body)) throw new DuplicatePhoneError(dup)
        }
        const b = await tx.booking.create({
          data: {
            bookingNumber,
            type: body.type,
            tripType: body.tripType || 'one-way',
            departureCity: body.departureCity,
            arrivalCity: body.arrivalCity,
            departureDate,
            returnDate,
            firstName: body.firstName,
            lastName: body.lastName,
            email: body.email || '',
            notes: typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null,
            phone: body.phone,
            adults: adults || 1,
            children,
            parcelWeight: body.parcelWeight || null,
            parcelDetails: body.parcelDetails || null,
            price,
            currency,
            payMethod,
            status: 'confirmed',
            confirmedAt: new Date(),
            tripId: tripId || null,
            returnTripId: returnTripId || null,
            manualBusId: inheritedManualBusId,
            source: operator ? 'operator' : 'site',
            createdById: operator?.id ?? null,
            createdByName: operator?.name ?? null,
          },
        })
        if (tripId && seatNumbers.length > 0) {
          await tx.seatBooking.createMany({
            data: seatNumbers.map((n) => ({
              tripId,
              seatNumber: n,
              bookingId: b.id,
            })),
          })
        }
        if (returnTripId && returnSeatNumbers.length > 0) {
          await tx.seatBooking.createMany({
            data: returnSeatNumbers.map((n) => ({
              tripId: returnTripId,
              seatNumber: n,
              bookingId: b.id,
            })),
          })
        }
        return b
      })
    } catch (error) {
      if (error instanceof DuplicatePhoneError) return duplicateResponse(error.dup, operator)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return NextResponse.json(
          {
            success: false,
            error: 'Unul din scaunele alese a fost rezervat între timp. Te rog alege altele.',
          },
          { status: 409 }
        )
      }
      throw error
    }

    // Linkurile din email (bilet/confirm/anulare/tracking) sunt pentru CLIENT —
    // întotdeauna davo.md, nu domeniul panoului (unde proxy-ul cere PIN).
    const appUrl = publicAppUrl()
    const ticketUrl = `${appUrl}/bilet/${booking.bookingNumber}`

    await prisma.booking.update({
      where: { id: booking.id },
      data: { ticketUrl }
    })

    try {
      await autoLinkTripAndClient(booking.id)
      await enqueueRemindersOnly(booking.id)
    } catch (e) {
      console.error('auto-link/enqueue after booking:', e)
    }

    const [confirmToken, cancelToken] = await Promise.all([
      createBookingToken(booking.bookingNumber, 'confirm'),
      createBookingToken(booking.bookingNumber, 'cancel'),
    ])

    const bookingData: BookingConfirmationData = {
      bookingNumber: booking.bookingNumber,
      type: booking.type as 'passenger' | 'parcel',
      tripType: booking.tripType as 'one-way' | 'round-trip',
      firstName: booking.firstName,
      lastName: booking.lastName,
      email: booking.email,
      phone: booking.phone,
      departureCity: booking.departureCity,
      arrivalCity: booking.arrivalCity,
      departureDate: booking.departureDate,
      returnDate: booking.returnDate,
      adults: booking.adults,
      children: booking.children,
      parcelDetails: booking.parcelDetails,
      price: booking.price,
      currency: booking.currency,
      ticketUrl,
      payMethod: booking.payMethod,
      busLabel: outboundTrip?.bus.label ?? null,
      busPlate: outboundTrip?.bus.plate ?? null,
      source: booking.source,
      createdByName: booking.createdByName,
      confirmUrl: bookingResponseUrl(appUrl, booking.bookingNumber, 'confirm', confirmToken),
      cancelUrl: bookingResponseUrl(appUrl, booking.bookingNumber, 'cancel', cancelToken),
      trackUrl: `${appUrl.replace(/\/$/, '')}/livrare?nr=${booking.bookingNumber}`,
    }

    // Fără email (rezervare de operator) nu avem cui trimite confirmarea —
    // sărim și logarea (nu e un eșec, e intenționat).
    const emailResult = booking.email
      ? await sendBookingConfirmation(bookingData)
      : null
    await sendAdminNotification(bookingData)

    if (emailResult?.success) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          emailSent: true,
          emailSentAt: new Date()
        }
      })
      await prisma.emailLog.create({
        data: {
          to: booking.email,
          subject: `Confirmare Rezervare DAVO - ${booking.bookingNumber}`,
          template: 'booking-confirmation',
          status: 'sent',
          relatedId: booking.id,
        }
      })
    } else if (emailResult) {
      await prisma.emailLog.create({
        data: {
          to: booking.email,
          subject: `Confirmare Rezervare DAVO - ${booking.bookingNumber}`,
          template: 'booking-confirmation',
          status: 'failed',
          relatedId: booking.id,
          error: emailResult.error,
        }
      })
    }

    return NextResponse.json({
      success: true,
      booking: {
        id: booking.id,
        bookingNumber: booking.bookingNumber,
        price: booking.price,
        currency: booking.currency,
        ticketUrl,
      },
      emailSent: emailResult?.success ?? false,
    })
  } catch (error) {
    console.error('Booking error:', error)
    return NextResponse.json(
      { success: false, error: 'Eroare la procesarea rezervării' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    const bookingNumber = searchParams.get('bookingNumber')

    if (!email && !bookingNumber) {
      return NextResponse.json(
        { success: false, error: 'Email sau număr rezervare necesar' },
        { status: 400 }
      )
    }

    const bookings = await prisma.booking.findMany({
      where: {
        OR: [
          { email: email || undefined },
          { bookingNumber: bookingNumber || undefined }
        ]
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ success: true, bookings })
  } catch (error) {
    console.error('Get bookings error:', error)
    return NextResponse.json(
      { success: false, error: 'Eroare la obținerea rezervărilor' },
      { status: 500 }
    )
  }
}
