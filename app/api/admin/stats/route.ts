import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const totalBookings = await prisma.booking.count()
    const totalPassengers = await prisma.booking.count({
      where: { type: 'passenger' }
    })
    const totalParcels = await prisma.booking.count({
      where: { type: 'parcel' }
    })

    const revenue = await prisma.booking.aggregate({
      _sum: {
        price: true
      }
    })

    const pending = await prisma.booking.count({
      where: { status: 'pending' }
    })
    const confirmed = await prisma.booking.count({
      where: { status: 'confirmed' }
    })

    return NextResponse.json({
      success: true,
      stats: {
        totalBookings,
        totalPassengers,
        totalParcels,
        totalRevenue: revenue._sum.price || 0,
        pending,
        confirmed
      }
    })
  } catch (error) {
    console.error('Admin stats error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get stats' },
      { status: 500 }
    )
  }
}
