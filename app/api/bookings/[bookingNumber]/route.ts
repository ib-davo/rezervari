import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveScheduledTimes } from '@/lib/scheduledTime'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookingNumber: string }> }
) {
  try {
    const { bookingNumber } = await params

    const booking = await prisma.booking.findUnique({
      where: { bookingNumber },
      include: {
        // Includem scaunele cu tripId ca să putem grupa locurile pe dus/retur
        // în pagina /bilet/[bookingNumber] și în email-urile de confirmare.
        seatBookings: {
          select: { seatNumber: true, tripId: true },
          orderBy: { seatNumber: 'asc' },
        },
        // Bus pe cursa dus — afișat pe bilet și în emailuri ("Van Hool ·
        // DAW 77"). Returul are alt trip, dar UI-ul afișează doar busul
        // principal al rezervării.
        trip: { include: { bus: { select: { label: true, plate: true } } } },
      },
    })

    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      )
    }

    const outboundSeats = booking.seatBookings
      .filter((s) => s.tripId === booking.tripId)
      .map((s) => s.seatNumber)
    const returnSeats = booking.returnTripId
      ? booking.seatBookings
          .filter((s) => s.tripId === booking.returnTripId)
          .map((s) => s.seatNumber)
      : []

    const scheduled = await resolveScheduledTimes(booking)

    const { seatBookings: _seatBookings, ...rest } = booking
    void _seatBookings
    return NextResponse.json({
      success: true,
      booking: {
        ...rest,
        outboundSeats,
        returnSeats,
        departureTime: scheduled.departureTime ?? null,
        returnTime: scheduled.returnTime ?? null,
      },
    })
  } catch (error) {
    console.error('Get booking error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get booking' },
      { status: 500 }
    )
  }
}

// Doar câmpuri de contact/notă — NU status, preț, plată sau legături de cursă.
// Pentru acelea există rutele dedicate (/api/operator/bookings/[id], davo admin),
// care aplică și efectele secundare corecte (eliberare locuri, emailuri).
const PATCHABLE_FIELDS = new Set(['firstName', 'lastName', 'email', 'phone', 'parcelDetails'])

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ bookingNumber: string }> }
) {
  try {
    const { bookingNumber } = await params
    const body = await request.json()

    const data: Record<string, string> = {}
    for (const [key, value] of Object.entries(body)) {
      if (PATCHABLE_FIELDS.has(key) && typeof value === 'string') data[key] = value
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Niciun câmp editabil în cerere' },
        { status: 400 }
      )
    }

    const booking = await prisma.booking.update({
      where: { bookingNumber },
      data,
    })

    return NextResponse.json({ success: true, booking })
  } catch (error) {
    console.error('Update booking error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update booking' },
      { status: 500 }
    )
  }
}
