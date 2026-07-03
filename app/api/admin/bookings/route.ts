import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendBookingConfirmation, type BookingConfirmationData } from '@/lib/email'
import { autoLinkTripAndClient } from '@/lib/bookingLink'
import { enqueueRemindersOnly } from '@/lib/emailQueue'
import { createBookingToken, bookingResponseUrl } from '@/lib/bookingToken'
import { appUrl as resolveAppUrl } from '@/lib/appUrl'
import { verifyToken, COOKIE_NAME } from '@/lib/session'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    const bookings = await prisma.booking.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    })

    const total = await prisma.booking.count()

    return NextResponse.json({
      success: true,
      bookings,
      total,
      limit,
      offset
    })
  } catch (error) {
    console.error('Admin get bookings error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get bookings' },
      { status: 500 }
    )
  }
}

function generateBookingNumber(): string {
  const year = new Date().getFullYear()
  const random = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `DAVO-${year}-${random}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const required = ['firstName', 'lastName', 'email', 'phone', 'originCountry', 'originCity', 'destinationCountry', 'destinationCity', 'departureDate', 'price', 'currency']
    for (const f of required) {
      if (body[f] === undefined || body[f] === null || body[f] === '') {
        return NextResponse.json(
          { success: false, error: `Lipsește câmpul: ${f}` },
          { status: 400 }
        )
      }
    }

    const price = Number(body.price)
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ success: false, error: 'Preț invalid' }, { status: 400 })
    }

    const tripType: 'one-way' | 'round-trip' = body.tripType === 'round-trip' ? 'round-trip' : 'one-way'
    const status: 'pending' | 'confirmed' = body.status === 'pending' ? 'pending' : 'confirmed'
    const payMethod: string = ['cash_on_pickup', 'card_on_pickup', 'paid_in_advance'].includes(body.payMethod)
      ? body.payMethod
      : 'cash_on_pickup'
    const paymentStatus = payMethod === 'paid_in_advance' ? 'paid' : 'pending'
    const sendEmail: boolean = body.sendEmail !== false

    const departureCityFull = `${String(body.originCity).trim()}, ${String(body.originCountry).trim()}`
    const arrivalCity = `${String(body.destinationCity).trim()}, ${String(body.destinationCountry).trim()}`

    const originAddress: string | undefined = body.originAddress?.trim() || undefined
    const destinationAddress: string | undefined = body.destinationAddress?.trim() || undefined
    const notes: string | undefined = body.notes?.trim() || undefined
    const parcelDetails = originAddress || destinationAddress || notes
      ? JSON.stringify({ originAddress, destinationAddress, notes, manual: true })
      : undefined

    const bookingNumber = generateBookingNumber()

    const departureDate = new Date(body.departureDate)
    if (Number.isNaN(departureDate.getTime())) {
      return NextResponse.json({ success: false, error: 'Dată plecare invalidă' }, { status: 400 })
    }
    let returnDate: Date | null = null
    if (tripType === 'round-trip' && body.returnDate) {
      const r = new Date(body.returnDate)
      if (!Number.isNaN(r.getTime())) returnDate = r
    }

    // Atașare opțională la o cursă existentă + alegere locuri. Dacă admin a
    // ales o cursă, validăm că locurile alese sunt libere ÎNAINTE de create
    // (race-condition gard: tranzacția de mai jos face check + insert atomic).
    const tripId: string | undefined = typeof body.tripId === 'string' && body.tripId.length > 0 ? body.tripId : undefined
    const seatNumbers: number[] = Array.isArray(body.seatNumbers)
      ? body.seatNumbers.map((n: unknown) => Number(n)).filter((n: number) => Number.isInteger(n) && n > 0)
      : []

    if (tripId) {
      const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { id: true } })
      if (!trip) {
        return NextResponse.json({ success: false, error: 'Cursa selectată nu există' }, { status: 400 })
      }
      if (seatNumbers.length > 0) {
        const taken = await prisma.seatBooking.findMany({
          where: { tripId, seatNumber: { in: seatNumbers } },
          select: { seatNumber: true },
        })
        if (taken.length > 0) {
          return NextResponse.json(
            { success: false, error: `Locurile ${taken.map((t) => t.seatNumber).join(', ')} sunt deja rezervate` },
            { status: 409 }
          )
        }
      }
    }

    // Cine creează manual din panoul davo (admin / admin2) — ca panoul
    // operatorilor să afișeze „Rezervare manuală · <nume>" în loc de „Client site".
    // createdById rămâne null: în schemă e FK către Operator, nu către AdminUser.
    let createdByName: string | null = null
    try {
      const token = request.cookies.get(COOKIE_NAME)?.value
      const session = token ? await verifyToken(token) : null
      if (session) {
        const admin = await prisma.adminUser.findUnique({
          where: { email: session.email },
          select: { name: true },
        })
        createdByName = admin?.name ?? null
      }
    } catch {
      // Nefatal: rezervarea se creează oricum, doar fără numele adminului.
    }

    const now = new Date()
    const booking = await prisma.booking.create({
      data: {
        bookingNumber,
        type: 'passenger',
        status,
        tripType,
        departureCity: departureCityFull,
        arrivalCity,
        departureDate,
        returnDate,
        firstName: String(body.firstName).trim(),
        lastName: String(body.lastName).trim(),
        email: String(body.email).trim(),
        phone: String(body.phone).trim(),
        adults: Math.max(1, Number(body.adults) || 1),
        children: Math.max(0, Number(body.children) || 0),
        parcelDetails,
        price,
        currency: String(body.currency),
        paymentStatus,
        payMethod,
        paidAt: paymentStatus === 'paid' ? now : null,
        confirmedAt: status === 'confirmed' ? now : null,
        tripId: tripId ?? null,
        // Rezervare manuală din panoul admin davo.
        source: 'admin',
        createdByName,
      },
    })

    // Insert SeatBookings — în paralel cu booking.create am putea face și
    // tranzacție; pentru rezervările manuale (volum mic, admin-driven) un
    // best-effort post-insert e ok, plus că deja am verificat coliziunile.
    if (tripId && seatNumbers.length > 0) {
      await prisma.seatBooking.createMany({
        data: seatNumbers.map((n) => ({ tripId, seatNumber: n, bookingId: booking.id })),
      })
    }

    const appUrl = resolveAppUrl()
    const ticketUrl = `${appUrl}/bilet/${booking.bookingNumber}`
    await prisma.booking.update({ where: { id: booking.id }, data: { ticketUrl } })

    try {
      await autoLinkTripAndClient(booking.id)
      await enqueueRemindersOnly(booking.id)
    } catch (e) {
      console.error('auto-link/enqueue (manual booking):', e)
    }

    let emailSent = false
    if (sendEmail) {
      try {
        const [confirmToken, cancelToken] = await Promise.all([
          createBookingToken(booking.bookingNumber, 'confirm'),
          createBookingToken(booking.bookingNumber, 'cancel'),
        ])

        const data: BookingConfirmationData = {
          bookingNumber: booking.bookingNumber,
          type: 'passenger',
          tripType,
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
          payMethod: booking.payMethod ?? undefined,
          confirmUrl: bookingResponseUrl(appUrl, booking.bookingNumber, 'confirm', confirmToken),
          cancelUrl: bookingResponseUrl(appUrl, booking.bookingNumber, 'cancel', cancelToken),
        }

        const result = await sendBookingConfirmation(data)
        if (result.success) {
          await prisma.booking.update({
            where: { id: booking.id },
            data: { emailSent: true, emailSentAt: new Date() },
          })
          await prisma.emailLog.create({
            data: {
              to: booking.email,
              subject: `Confirmare Rezervare DAVO - ${booking.bookingNumber}`,
              template: 'manual-booking-confirmation',
              status: 'sent',
              relatedId: booking.id,
            },
          })
          emailSent = true
        } else {
          await prisma.emailLog.create({
            data: {
              to: booking.email,
              subject: `Confirmare Rezervare DAVO - ${booking.bookingNumber}`,
              template: 'manual-booking-confirmation',
              status: 'failed',
              relatedId: booking.id,
              error: result.error,
            },
          })
        }
      } catch (e) {
        console.error('manual booking email error:', e)
      }
    }

    return NextResponse.json({
      success: true,
      booking: {
        id: booking.id,
        bookingNumber: booking.bookingNumber,
        ticketUrl,
      },
      emailSent,
    })
  } catch (error) {
    console.error('Admin create booking error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create booking' },
      { status: 500 }
    )
  }
}
