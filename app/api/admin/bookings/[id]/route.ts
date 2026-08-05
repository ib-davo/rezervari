import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enqueueForBooking, cancelForBooking, sendCancellationNow, enqueueRemindersOnly } from '@/lib/emailQueue'
import { autoLinkTripAndClient } from '@/lib/bookingLink'
import { findDuplicateByPhone, duplicateMessageForOperator, phoneKey, passengerKeys } from '@/lib/duplicatePhone'

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

    const previous = await prisma.booking.findUnique({
      where: { id },
      include: {
        // Ziua cursei reale — editarea datei nu are voie să plece de lângă ea.
        trip: { select: { departureAt: true } },
        returnTrip: { select: { departureAt: true } },
      },
    })
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

    // O rezervare legată de o cursă are DOUĂ zile care trebuie să rămână identice:
    // `departureDate` (citită de verificarea de dublură) și `trip.departureAt`
    // (citită de liste, harta de locuri și manifeste). Editarea din admin schimbă
    // doar câmpul de pe rezervare — nu și cursa, locurile sau reminderele — deci
    // o schimbare de ZI ar despărți cele două: rezervarea ar bloca o zi și ar fi
    // afișată pe alta, invizibilă pentru operator (bug-ul DAVO-2026-TB23MN).
    // Blocăm doar schimbarea REALĂ de zi — formularul retrimite mereu data curentă,
    // iar o editare de preț pe un rând vechi deja desincronizat trebuie să treacă.
    const utcDayOf = (d: Date) => d.toISOString().slice(0, 10)
    const dayMoveError = (tripDay: string) =>
      NextResponse.json(
        {
          success: false,
          error: `Rezervarea e legată de cursa din ${tripDay.split('-').reverse().join('.')}. Ziua nu se schimbă din editare — mut-o pe altă cursă (reprogramare), ca să se mute și locurile, și reminderele.`,
        },
        { status: 400 }
      )

    // Pe rezervările FĂRĂ cursă ziua se poate muta — dar reminderele erau
    // calculate pe data veche, deci trebuie reprogramate după salvare
    // (aceeași plasă ca în /api/operator/bookings/[id]).
    let dayChangedNoTrip = false

    if (data.departureDate instanceof Date && utcDayOf(data.departureDate) !== utcDayOf(previous.departureDate)) {
      if (previous.tripId) {
        return dayMoveError(utcDayOf(previous.trip?.departureAt ?? previous.departureDate))
      }
      dayChangedNoTrip = true
    }
    if ('returnDate' in data) {
      if (previous.returnTripId) {
        const retDay = utcDayOf(previous.returnTrip?.departureAt ?? previous.returnDate ?? previous.departureDate)
        // Și ștergerea returului e o „mutare" — locurile de pe cursa retur ar rămâne ocupate.
        if (data.returnDate === null && previous.returnDate) return dayMoveError(retDay)
        if (data.returnDate instanceof Date && (!previous.returnDate || utcDayOf(data.returnDate) !== utcDayOf(previous.returnDate))) {
          return dayMoveError(retDay)
        }
      } else if (data.returnDate === null && previous.returnDate) {
        dayChangedNoTrip = true
      } else if (data.returnDate instanceof Date && (!previous.returnDate || utcDayOf(data.returnDate) !== utcDayOf(previous.returnDate))) {
        dayChangedNoTrip = true
      }
    }

    // Dublura pe telefon: editarea poate schimba telefonul sau numele, iar
    // crearea blochează exact combinația asta. Fără recontrol, ce nu se poate
    // crea se poate obține prin editare. `excludeBookingId` scoate rezervarea
    // însăși din căutare. Ca la operator, doar ACEEAȘI persoană blochează —
    // alt nume pe același telefon e familie și trece.
    if (previous.type === 'passenger') {
      const newPhone = typeof data.phone === 'string' ? data.phone : previous.phone
      const newFirst = typeof data.firstName === 'string' ? data.firstName : previous.firstName
      const newLast = typeof data.lastName === 'string' ? data.lastName : previous.lastName
      const newDep = data.departureDate instanceof Date ? data.departureDate : previous.departureDate
      const newRet = 'returnDate' in data
        ? (data.returnDate instanceof Date ? data.returnDate : null)
        : previous.returnDate
      const identityChanged =
        phoneKey(newPhone) !== phoneKey(previous.phone) ||
        passengerKeys(newFirst, newLast).join('|') !== passengerKeys(previous.firstName, previous.lastName).join('|') ||
        utcDayOf(newDep) !== utcDayOf(previous.departureDate)
      if (identityChanged) {
        const dup = await findDuplicateByPhone(prisma, {
          phone: newPhone,
          firstName: newFirst,
          lastName: newLast,
          departureDate: newDep,
          returnDate: newRet,
          excludeBookingId: id,
        })
        if (dup?.samePerson) {
          return NextResponse.json({ success: false, error: duplicateMessageForOperator(dup) }, { status: 409 })
        }
      }
    }

    // O cursă care a plecat deja nu se mai anulează: ar elibera locuri degeaba și
    // ar trimite clientului email de anulare pentru o călătorie trecută (un tab
    // vechi rămas deschis). Aceeași convenție ca în /api/operator/bookings/[id]:
    // comparăm cu ORA reală de plecare (returul dacă există), nu cu ziua.
    if (data.status === 'cancelled' && previous.status !== 'cancelled') {
      const last = previous.returnDate ?? previous.departureDate
      if (previous.archivedAt || new Date(last) < new Date()) {
        return NextResponse.json(
          { success: false, error: 'Cursa a plecat deja — rezervarea nu mai poate fi anulată.' },
          { status: 400 }
        )
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

    // Anulare: tranziție ATOMICĂ — doar UN request câștigă trecerea în cancelled
    // (updateMany cu gardă pe status), ca două tab-uri/admini concurenți să nu
    // ruleze efectele secundare (email + eliberare locuri) de două ori. Aceeași
    // convenție ca în /api/operator/bookings/[id].
    let cancelledNow = false
    if (data.status === 'cancelled') {
      const r = await prisma.booking.updateMany({
        where: { id, status: { not: 'cancelled' } },
        data,
      })
      cancelledNow = r.count > 0
      if (!cancelledNow) {
        // Rezervarea era DEJA anulată (alt tab a câștigat cursa, sau adminul
        // editează o rezervare anulată — modalul trimite mereu status-ul curent).
        // Câmpurile editate (preț, telefon...) se salvează totuși; doar efectele
        // anulării (email + eliberare locuri) nu se mai repetă.
        await prisma.booking.update({ where: { id }, data })
      }
    } else {
      await prisma.booking.update({ where: { id }, data })
    }

    // Ziua s-a mutat pe o rezervare fără cursă (singurul caz care trece de gardă):
    // reminderele erau programate pe data veche, deci ar pleca la ziua greșită.
    // Nu pe rezervări anulate — acolo nu mai trebuie niciun reminder.
    if (dayChangedNoTrip && !cancelledNow && data.status !== 'cancelled' && previous.status !== 'cancelled') {
      await prisma.emailJob
        .updateMany({
          where: { bookingId: id, type: { in: ['reminder_24h', 'reminder_2h', 'review_request'] }, status: { in: ['scheduled', 'queued'] } },
          data: { status: 'cancelled' },
        })
        .catch(() => {})
      await enqueueRemindersOnly(id).catch((e) => console.error('enqueueReminders after edit:', e))
    }

    // Tranziție de status → acțiuni automate pe coada de emailuri.
    if (cancelledNow) {
      // Fără asta, locurile rezervării anulate rămân ocupate pe hartă și blochează
      // vânzarea lor — aceeași eliberare ca pe calea operatorului.
      await prisma.seatBooking.deleteMany({ where: { bookingId: id } })
      // Anularea pleacă IMEDIAT, nu la cron-ul zilnic.
      await cancelForBooking(id, false)
      await sendCancellationNow(id).catch((e) => console.error('sendCancellationNow:', e))
    } else if (data.status === 'confirmed' && data.status !== previous.status) {
      await prisma.booking.update({
        where: { id },
        data: { confirmedAt: previous.confirmedAt ?? new Date() },
      })
      await autoLinkTripAndClient(id)
      await enqueueForBooking(id)
    }

    const booking = await prisma.booking.findUnique({ where: { id } })
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
