import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TicketInventoryService } from './ticket-inventory.service'

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: TicketInventoryService,
  ) {}

  async list() {
    await this.inventory.releaseExpiredReservations()
    return this.prisma.ticketType.findMany({
      where: { active: true },
      select: {
        slug: true,
        name: true,
        detail: true,
        priceMinor: true,
        capacity: true,
        slotsAvailable: true,
      },
      orderBy: { priceMinor: 'asc' },
    }).then((ticketTypes) => ticketTypes.map((ticketType) => ({
      ...ticketType,
      currency: 'KES',
    })))
  }
}
