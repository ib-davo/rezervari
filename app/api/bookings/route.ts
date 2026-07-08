import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sendBookingConfirmation, sendAdminNotification, BookingConfirmationData } from '@/lib/email'
import { calculatePrice, calculatePriceFromRoute, calculateParcelPrice } from '@/lib/pricing'
import { autoLinkTripAndClient } from '@/lib/bookingLink'
import { enqueueRemindersOnly } from '@/lib/emailQueue'
import { createBookingToken, bookingResponseUrl } from '@/lib/bookingToken'
import { appUrl as resolveAppUrl } from '@/lib/appUrl'
import { verifyOperatorToken, OPERATOR_COOKIE } from '@/lib/operatorSession'
import type { SeatLayout } from '@/lib/adminMock'

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
      if (!body[field]) {
        return NextResponse.json(
          { success: false, error: `Lipsește câmpul: ${field}` },
          { status: 400 }
        )
      }
    }

    const tripId: string | undefined = body.tripId || undefined
    const returnTripId: string | undefined = body.returnTripId || undefined
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
    if (returnTripId) {
      // Doar validare — datele cursei retur nu sunt folosite mai jos.
      const v = await validateTripSeats(returnTripId, returnSeatNumbers)
      if (!v.ok) return NextResponse.json({ success: false, error: v.error }, { status: 400 })
    }

    let price: number
    let currency: string
    if (body.type === 'parcel') {
      // Colet: preț pe greutate (1.5/kg), NU tarif de pasager — chiar dacă are
      // cursă atașată. Valuta vine din ruta cursei când există (GBP pe Anglia).
      const res = outboundTrip
        ? calculateParcelPrice(Number(body.parcelWeight) || null, outboundTrip.route.currency)
        : calculatePrice({
            departureCity: body.departureCity,
            arrivalCity: body.arrivalCity,
            type: 'parcel',
            parcelWeight: Number(body.parcelWeight) || null,
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

    const bookingNumber = generateBookingNumber()

    let booking
    try {
      booking = await prisma.$transaction(async (tx) => {
        const b = await tx.booking.create({
          data: {
            bookingNumber,
            type: body.type,
            tripType: body.tripType || 'one-way',
            departureCity: body.departureCity,
            arrivalCity: body.arrivalCity,
            departureDate: new Date(body.departureDate),
            returnDate: body.returnDate ? new Date(body.returnDate) : null,
            firstName: body.firstName,
            lastName: body.lastName,
            email: body.email,
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

    const appUrl = resolveAppUrl()
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
      confirmUrl: bookingResponseUrl(appUrl, booking.bookingNumber, 'confirm', confirmToken),
      cancelUrl: bookingResponseUrl(appUrl, booking.bookingNumber, 'cancel', cancelToken),
      trackUrl: `${appUrl.replace(/\/$/, '')}/livrare?nr=${booking.bookingNumber}`,
    }

    const emailResult = await sendBookingConfirmation(bookingData)
    await sendAdminNotification(bookingData)

    if (emailResult.success) {
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
    } else {
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
      emailSent: emailResult.success,
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
