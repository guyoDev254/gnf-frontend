import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  RawBodyRequest,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { Prisma } from '@prisma/client'
import type { Request } from 'express'
import { PrismaService } from '../prisma/prisma.service'
import { InitializePaymentDto } from './dto/initialize-payment.dto'
import { RESERVATION_HOLD_MINUTES, TicketInventoryService } from '../tickets/ticket-inventory.service'
import { TicketDeliveryService } from './ticket-delivery.service'

interface PaystackResponse<T> {
  status: boolean
  message: string
  data: T
}

interface InitializeTransaction {
  authorization_url: string
  access_code: string
  reference: string
}

interface VerifiedTransaction {
  status: string
  reference: string
  amount: number
  currency: string
  id: number
  customer?: { email?: string }
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: TicketInventoryService,
    private readonly ticketDelivery: TicketDeliveryService,
  ) {}

  async initialize(dto: InitializePaymentDto) {
    await this.inventory.releaseExpiredReservations()
    const reference = `nkf_${randomUUID().replaceAll('-', '')}`
    const expiresAt = new Date(Date.now() + RESERVATION_HOLD_MINUTES * 60_000)
    const order = await this.reserveOrder(dto, reference, expiresAt)
    const ticketType = order.ticketType

    let payment: InitializeTransaction
    try {
      payment = await this.requestPaystack<InitializeTransaction>('/transaction/initialize', {
        method: 'POST',
        body: JSON.stringify({
          email: order.email,
          amount: order.amountMinor,
          currency: order.currency,
          reference: order.reference,
          callback_url: this.callbackUrl(),
          metadata: {
            orderId: order.id,
            ticketType: ticketType.slug,
            quantity: order.quantity,
            county: order.county,
          },
        }),
      })

      if (
        typeof payment.authorization_url !== 'string' ||
        typeof payment.access_code !== 'string' ||
        payment.reference !== order.reference
      ) {
        throw new BadGatewayException('Paystack returned an invalid checkout response.')
      }

      await this.prisma.ticketOrder.update({
        where: { id: order.id },
        data: {
          authorizationUrl: payment.authorization_url,
          accessCode: payment.access_code,
        },
      })
    } catch (error) {
      await this.failOrderAndRelease(order.id)
      throw error
    }

    return {
      reference: order.reference,
      authorizationUrl: payment.authorization_url,
    }
  }

  async verify(reference: string) {
    await this.inventory.releaseExpiredReservations()
    const order = await this.prisma.ticketOrder.findUnique({ where: { reference } })
    if (!order) throw new NotFoundException('Payment reference was not found.')
    if (order.status === 'PAID') {
      const ticketEmailStatus = await this.ticketDelivery.sendTicket(order.id)
      return { status: 'paid', reference: order.reference, ticketEmailStatus }
    }
    if (order.status === 'FAILED') return { status: 'failed', reference: order.reference }

    const transaction = await this.requestPaystack<VerifiedTransaction>(
      `/transaction/verify/${encodeURIComponent(reference)}`,
    )
    this.assertTransactionMatchesOrder(transaction, order)

    if (transaction.status === 'success') {
      await this.markPaid(order.id, transaction.id)
      const ticketEmailStatus = await this.ticketDelivery.sendTicket(order.id)
      return { status: 'paid', reference: order.reference, ticketEmailStatus }
    }

    if (transaction.status === 'failed' || transaction.status === 'abandoned') {
      await this.failOrderAndRelease(order.id)
      return { status: 'failed', reference: order.reference }
    }

    return { status: 'pending', reference: order.reference }
  }

  downloadTicket(reference: string) {
    return this.ticketDelivery.downloadTicket(reference)
  }

  validateTicket(reference: string) {
    return this.ticketDelivery.validateTicket(reference)
  }

  async handleWebhook(request: RawBodyRequest<Request>) {
    const signature = request.headers['x-paystack-signature']
    if (typeof signature !== 'string' || !request.rawBody) {
      throw new UnauthorizedException('Invalid Paystack webhook signature.')
    }

    const expected = createHmac('sha512', this.secretKey()).update(request.rawBody).digest()
    const received = Buffer.from(signature, 'hex')
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      throw new UnauthorizedException('Invalid Paystack webhook signature.')
    }

    const body: unknown = request.body
    if (
      typeof body === 'object' &&
      body !== null &&
      'event' in body &&
      body.event === 'charge.success' &&
      'data' in body &&
      typeof body.data === 'object' &&
      body.data !== null &&
      'reference' in body.data &&
      typeof body.data.reference === 'string'
    ) {
      await this.verify(body.data.reference)
    }

    return { received: true }
  }

  private async markPaid(orderId: string, transactionId: number) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      let updated: boolean
      try {
        updated = await this.prisma.$transaction(async (transaction) => {
          const order = await transaction.ticketOrder.findUnique({ where: { id: orderId } })
          if (!order) throw new NotFoundException('Payment reference was not found.')
          if (order.status === 'PAID') return true
          if (order.status !== 'PENDING') return false

          const result = await transaction.ticketOrder.updateMany({
            where: {
              id: orderId,
              status: 'PENDING',
              reservationReleasedAt: order.reservationReleasedAt,
            },
            data: {
              status: 'PAID',
              gatewayTransactionId: String(transactionId),
              paidAt: new Date(),
            },
          })
          if (result.count === 0) return false

          if (order.reservationReleasedAt === null) {
            await transaction.ticketType.update({
              where: { id: order.ticketTypeId },
              data: {
                slotsReserved: { decrement: order.quantity },
                slotsSold: { increment: order.quantity },
              },
            })
          } else {
            const ticketType = await transaction.ticketType.findUniqueOrThrow({
              where: { id: order.ticketTypeId },
            })
            await transaction.ticketType.update({
              where: { id: order.ticketTypeId },
              data: {
                slotsAvailable: ticketType.slotsAvailable === null
                  ? null
                  : Math.max(0, ticketType.slotsAvailable - order.quantity),
                slotsSold: { increment: order.quantity },
              },
            })
          }
          return true
        }, { isolationLevel: 'Serializable' })
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
          continue
        }
        throw error
      }
      if (updated) return
    }
    throw new ConflictException('Payment status changed while confirming. Please retry verification.')
  }

  private async reserveOrder(
    dto: InitializePaymentDto,
    reference: string,
    expiresAt: Date,
  ) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (transaction) => {
          const ticketType = await transaction.ticketType.findFirst({
            where: { slug: dto.ticketType, active: true },
          })
          if (!ticketType) throw new NotFoundException('The selected ticket is unavailable.')

          const amountMinor = ticketType.priceMinor * dto.quantity
          if (!Number.isSafeInteger(amountMinor)) {
            throw new BadRequestException('The requested ticket total is invalid.')
          }

          const reservation = await transaction.ticketType.updateMany({
            where: {
              id: ticketType.id,
              active: true,
              OR: [
                { slotsAvailable: null },
                { slotsAvailable: { gte: dto.quantity } },
              ],
            },
            data: {
              slotsAvailable: { decrement: dto.quantity },
              slotsReserved: { increment: dto.quantity },
            },
          })
          if (reservation.count === 0) {
            throw new ConflictException('There are not enough ticket slots available.')
          }

          return transaction.ticketOrder.create({
            data: {
              reference,
              buyerName: dto.name.trim(),
              email: dto.email.trim().toLowerCase(),
              phone: dto.phone.trim(),
              county: dto.county,
              quantity: dto.quantity,
              unitPriceMinor: ticketType.priceMinor,
              amountMinor,
              ticketTypeId: ticketType.id,
              expiresAt,
            },
            include: { ticketType: { select: { slug: true } } },
          })
        }, { isolationLevel: 'Serializable' })
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
          if (attempt < 2) continue
          throw new ConflictException('Ticket inventory changed during checkout. Please try again.')
        }
        throw error
      }
    }
    throw new ConflictException('Could not reserve ticket slots. Please try again.')
  }

  private async failOrderAndRelease(orderId: string) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const updated = await this.prisma.$transaction(async (transaction) => {
          const order = await transaction.ticketOrder.findUnique({ where: { id: orderId } })
          if (!order || order.status !== 'PENDING') return true

          const failed = await transaction.ticketOrder.updateMany({
            where: {
              id: orderId,
              status: 'PENDING',
              reservationReleasedAt: order.reservationReleasedAt,
            },
            data: {
              status: 'FAILED',
              reservationReleasedAt: order.reservationReleasedAt ?? new Date(),
            },
          })
          if (failed.count === 0) return false

          if (order.reservationReleasedAt === null) {
            await transaction.ticketType.update({
              where: { id: order.ticketTypeId },
              data: {
                slotsReserved: { decrement: order.quantity },
                slotsAvailable: { increment: order.quantity },
              },
            })
          }
          return true
        })
        if (updated) return
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
          continue
        }
        throw error
      }
    }
    throw new ConflictException('Order status changed while releasing the ticket reservation. Please retry.')
  }

  private assertTransactionMatchesOrder(transaction: VerifiedTransaction, order: {
    reference: string
    amountMinor: number
    currency: string
    email: string
  }) {
    if (
      transaction.reference !== order.reference ||
      transaction.amount !== order.amountMinor ||
      transaction.currency !== order.currency ||
      transaction.customer?.email?.toLowerCase() !== order.email.toLowerCase()
    ) {
      throw new BadGatewayException('Paystack transaction details did not match the ticket order.')
    }
  }

  private callbackUrl() {
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000'
    const callback = new URL('/', frontendUrl)
    callback.searchParams.set('payment', 'callback')
    return callback.toString()
  }

  private secretKey() {
    const secretKey = process.env.PAYSTACK_SECRET_KEY
    if (!secretKey) {
      throw new ServiceUnavailableException('Paystack is not configured on the server.')
    }
    return secretKey
  }

  private async requestPaystack<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`https://api.paystack.co${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.secretKey()}`,
        'Content-Type': 'application/json',
        ...init?.headers,
      },
      signal: AbortSignal.timeout(15_000),
    })

    let result: PaystackResponse<T>
    try {
      result = await response.json() as PaystackResponse<T>
    } catch {
      throw new BadGatewayException('Paystack returned an unreadable response.')
    }
    if (!response.ok || result.status !== true || !result.data) {
      throw new BadGatewayException(result.message || 'Paystack could not process the payment request.')
    }
    return result.data
  }
}
