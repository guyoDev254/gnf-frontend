import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

export const RESERVATION_HOLD_MINUTES = 30

@Injectable()
export class TicketInventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async releaseExpiredReservations() {
    const now = new Date()
    const expiredOrders = await this.prisma.ticketOrder.findMany({
      where: {
        status: 'PENDING',
        reservationReleasedAt: null,
        expiresAt: { lte: now },
      },
      select: {
        id: true,
        ticketTypeId: true,
        quantity: true,
      },
    })

    for (const order of expiredOrders) {
      await this.prisma.$transaction(async (transaction) => {
        const released = await transaction.ticketOrder.updateMany({
          where: {
            id: order.id,
            status: 'PENDING',
            reservationReleasedAt: null,
            expiresAt: { lte: now },
          },
          data: { reservationReleasedAt: now },
        })
        if (released.count === 0) return

        await transaction.ticketType.update({
          where: { id: order.ticketTypeId },
          data: {
            slotsReserved: { decrement: order.quantity },
            slotsAvailable: { increment: order.quantity },
          },
        })
      })
    }
  }
}
