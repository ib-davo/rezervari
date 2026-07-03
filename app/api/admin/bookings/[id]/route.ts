import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enqueueForBooking, cancelForBooking } from '@/lib/emailQueue'
import { autoLinkTripAndClient } from '@/lib/bookingLink'

// Whitelist explicit — admin nu poate seta id/createdAt/relații etc.
type EditableField = keyof typeof EDITABLE_FIELDS
const EDITABLE_FIELDS = {
  status: 'string',
  firstName: 'string',
  lastName: 'string',
  email: 'string',
  phone: 'string',
  departureCity: 'string',
  arrivalCity: 'string',
  departureDate: 'date',
  returnDate: 'date-or-null',
  tripType: 'string',
  adults: 'int',
  children: 'int',
  price: 'float',
  currency: 'string',
  payMethod: 'string-or-null',
  paymentStatus: 'string',
  parcelDetails: 'string-or-null',
} as const

function coerce(value: unknown, type: (typeof EDITABLE_FIELDS)[EditableField]): unknown {
  if (type === 'string') return typeof value === 'string' ? value : null
  if (type === 'string-or-null') {
    if (value === null || value === undefined || value === '') return null
    return typeof value === 'string' ? value : null
  }
  if (type === 'int') {
    const n = Number(value)
    return Number.isFinite(n) ? Math.trunc(n) : null
  }
  if (type === 'float') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  if (type === 'date') {
    if (value === null || value === undefined || value === '') return null
    const d = new Date(value as string)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (type === 'date-or-null') {
    if (value === null || value === undefined || value === '') return null
    const d = new Date(value as string)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const previous = await prisma.booking.findUnique({ where: { id } })
    if (!previous) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 })
    }

    const data: Record<string, unknown> = { updatedAt: new Date() }
    for (const [key, type] of Object.entries(EDITABLE_FIELDS) as [EditableField, (typeof EDITABLE_FIELDS)[EditableField]][]) {
      if (key in body) {
        const v = coerce(body[key], type)
        if (v !== null || type === 'string-or-null' || type === 'date-or-null') {
          data[key] = v
        }
      }
    }

    // Marcăm paidAt când admin schimbă paymentStatus pe "paid"
    if (data.paymentStatus === 'paid' && previous.paymentStatus !== 'paid') {
      data.paidAt = new Date()
    } else if (data.paymentStatus && data.paymentStatus !== 'paid' && previous.paymentStatus === 'paid') {
      data.paidAt = null
    }

    // Ștergere scaune individuale (de ex. când unul din 4 pasageri renunță).
    // Folosim tripId / returnTripId ale rezervării PRECEDENTE ca să găsim
    // SeatBooking-urile corecte. Ștergerea eliberează scaunul pentru alți pasageri.
    const removeOutbound: number[] = Array.isArray(body.removeOutboundSeats)
      ? body.removeOutboundSeats.map((n: unknown) => Number(n)).filter((n: number) => Number.isInteger(n))
      : []
    const removeReturn: number[] = Array.isArray(body.removeReturnSeats)
      ? body.removeReturnSeats.map((n: unknown) => Number(n)).filter((n: number) => Number.isInteger(n))
      : []

    if (removeOutbound.length > 0 && previous.tripId) {
      await prisma.seatBooking.deleteMany({
        where: { bookingId: id, tripId: previous.tripId, seatNumber: { in: removeOutbound } },
      })
    }
    if (removeReturn.length > 0 && previous.returnTripId) {
      await prisma.seatBooking.deleteMany({
        where: { bookingId: id, tripId: previous.returnTripId, seatNumber: { in: removeReturn } },
      })
    }

    const booking = await prisma.booking.update({
      where: { id },
      data,
    })

    // Tranziție de status → acțiuni automate pe coada de emailuri.
    if (data.status && data.status !== previous.status) {
      if (data.status === 'confirmed') {
        await prisma.booking.update({
          where: { id },
          data: { confirmedAt: previous.confirmedAt ?? new Date() },
        })
        await autoLinkTripAndClient(id)
        await enqueueForBooking(id)
      } else if (data.status === 'cancelled') {
        await cancelForBooking(id)
      }
    }

    return NextResponse.json({ success: true, booking })
  } catch (error) {
    console.error('Admin update booking error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update booking' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { action } = await request.json()

    if (action === 'resend-email') {
      const { sendBookingConfirmation } = await import('@/lib/email')
      const booking = await prisma.booking.findUnique({ where: { id } })

      if (!booking) {
        return NextResponse.json(
          { success: false, error: 'Booking not found' },
          { status: 404 }
        )
      }

      await sendBookingConfirmation({
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
        ticketUrl: booking.ticketUrl || ''
      })

      await prisma.booking.update({
        where: { id },
        data: { emailSent: true, emailSentAt: new Date() }
      })

      return NextResponse.json({ success: true, message: 'Email sent' })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Admin action error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process action' },
      { status: 500 }
    )
  }
}
