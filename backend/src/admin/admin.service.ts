import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { OrderStatus, Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { TicketInventoryService } from '../tickets/ticket-inventory.service'
import { AdminOrdersQueryDto } from './dto/admin-orders-query.dto'
import { CreateAdminTicketDto, UpdateAdminTicketDto } from './dto/admin-ticket.dto'

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: TicketInventoryService,
  ) {}

  async dashboard() {
    await this.inventory.releaseExpiredReservations()
    const [orderCounts, paidSales, activeTickets, recentOrders] = await Promise.all([
      this.prisma.ticketOrder.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.ticketOrder.aggregate({
        where: { status: OrderStatus.PAID },
        _count: { _all: true },
        _sum: { amountMinor: true, quantity: true },
      }),
      this.prisma.ticketType.count({ where: { active: true } }),
      this.prisma.ticketOrder.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        select: this.orderSelect(),
      }),
    ])

    const counts = { PENDING: 0, PAID: 0, FAILED: 0 }
    for (const result of orderCounts) counts[result.status] = result._count._all

    return {
      orders: counts,
      paidSales: {
        count: paidSales._count._all,
        amountMinor: paidSales._sum.amountMinor ?? 0,
        tickets: paidSales._sum.quantity ?? 0,
        currency: 'KES',
      },
      activeTickets,
      recentOrders,
    }
  }

  async listTickets() {
    await this.inventory.releaseExpiredReservations()
    return this.prisma.ticketType.findMany({ orderBy: { createdAt: 'asc' } })
  }

  async createTicket(dto: CreateAdminTicketDto) {
    try {
      const { capacity = null, ...ticketData } = dto
      return await this.prisma.ticketType.create({
        data: {
          ...ticketData,
          capacity,
          slotsAvailable: capacity,
        },
      })
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('A ticket type with that slug already exists.')
      }
      throw error
    }
  }

  async updateTicket(id: string, dto: UpdateAdminTicketDto) {
    if (dto.capacity !== undefined) {
      return this.updateTicketCapacity(id, dto)
    }
    await this.requireTicket(id)
    try {
      return await this.prisma.ticketType.update({ where: { id }, data: dto })
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('A ticket type with that slug already exists.')
      }
      throw error
    }
  }

  async archiveTicket(id: string) {
    await this.requireTicket(id)
    return this.prisma.ticketType.update({
      where: { id },
      data: { active: false },
    })
  }

  async listOrders(query: AdminOrdersQueryDto) {
    await this.inventory.releaseExpiredReservations()
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const search = query.search?.trim()
    const where: Prisma.TicketOrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(search ? {
        OR: [
          { buyerName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { reference: { contains: search, mode: 'insensitive' } },
        ],
      } : {}),
    }

    const [items, total] = await Promise.all([
      this.prisma.ticketOrder.findMany({
        where,
        select: this.orderSelect(),
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.ticketOrder.count({ where }),
    ])
    return { items, total, page, limit, pages: Math.ceil(total / limit) }
  }

  private async requireTicket(id: string) {
    const ticket = await this.prisma.ticketType.findUnique({ where: { id } })
    if (!ticket) throw new NotFoundException('Ticket type was not found.')
    return ticket
  }

  private async updateTicketCapacity(id: string, dto: UpdateAdminTicketDto) {
    const { capacity, ...ticketData } = dto
    const updatedCapacity = capacity ?? null
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const ticket = await transaction.ticketType.findUnique({ where: { id } })
        if (!ticket) throw new NotFoundException('Ticket type was not found.')
        const committedSlots = ticket.slotsSold + ticket.slotsReserved
        if (updatedCapacity !== null && updatedCapacity < committedSlots) {
          throw new ConflictException(
            `Capacity cannot be lower than ${committedSlots} sold or currently reserved slots.`,
          )
        }

        return transaction.ticketType.update({
          where: { id },
          data: {
            ...ticketData,
            capacity: updatedCapacity,
            slotsAvailable: updatedCapacity === null ? null : updatedCapacity - committedSlots,
          },
        })
      }, { isolationLevel: 'Serializable' })
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('A ticket type with that slug already exists.')
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException('Ticket inventory changed during the update. Please retry.')
      }
      throw error
    }
  }

  private isUniqueViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
  }

  private orderSelect() {
    return {
      id: true,
      reference: true,
      buyerName: true,
      email: true,
      phone: true,
      county: true,
      quantity: true,
      amountMinor: true,
      currency: true,
      status: true,
      createdAt: true,
      paidAt: true,
      expiresAt: true,
      reservationReleasedAt: true,
      ticketType: { select: { name: true, slug: true } },
    } as const
  }
}
