import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import * as nodemailer from 'nodemailer'
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode'
import { PrismaService } from '../prisma/prisma.service'

type TicketEmailStatus = 'sent' | 'pending'

@Injectable()
export class TicketDeliveryService {
  private readonly logger = new Logger(TicketDeliveryService.name)

  constructor(private readonly prisma: PrismaService) {}

  async sendTicket(orderId: string): Promise<TicketEmailStatus> {
    let smtp: ReturnType<typeof this.smtpSettings>
    try {
      smtp = this.smtpSettings()
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : 'SMTP configuration is invalid.')
      return 'pending'
    }

    const now = new Date()
    const staleSendingTime = new Date(now.getTime() - 5 * 60_000)
    const claim = await this.prisma.ticketOrder.updateMany({
      where: {
        id: orderId,
        status: 'PAID',
        ticketEmailSentAt: null,
        OR: [
          { ticketEmailSendingAt: null },
          { ticketEmailSendingAt: { lt: staleSendingTime } },
        ],
      },
      data: { ticketEmailSendingAt: now },
    })
    if (claim.count === 0) {
      const current = await this.prisma.ticketOrder.findUnique({
        where: { id: orderId },
        select: { ticketEmailSentAt: true },
      })
      return current?.ticketEmailSentAt ? 'sent' : 'pending'
    }

    try {
      const order = await this.prisma.ticketOrder.findUnique({
        where: { id: orderId },
        include: { ticketType: true },
      })
      if (!order || order.status !== 'PAID') {
        throw new NotFoundException('Paid ticket order was not found.')
      }

      const pdf = await this.createTicketPdf(order)
      const downloadUrl = this.ticketUrl(order.reference, 'download')
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: { user: smtp.user, pass: smtp.password },
        connectionTimeout: 15_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      })

      await transporter.sendMail({
        from: smtp.from,
        to: order.email,
        subject: `Your ${order.ticketType.name} festival ticket`,
        text: [
          `Hello ${order.buyerName},`,
          '',
          'Your payment is confirmed. Your festival ticket is attached as a PDF.',
          `Download your ticket: ${downloadUrl}`,
          `Ticket reference: ${order.reference}`,
          `Quantity: ${order.quantity}`,
        ].join('\n'),
        html: `<p>Hello ${this.escapeHtml(order.buyerName)},</p><p>Your payment is confirmed. Your festival ticket is attached as a PDF.</p><p><a href="${this.escapeHtml(downloadUrl)}">Download your ticket</a></p><p>Ticket reference: <strong>${this.escapeHtml(order.reference)}</strong><br>Quantity: ${order.quantity}</p>`,
        attachments: [{
          filename: `festival-ticket-${order.reference}.pdf`,
          content: pdf,
          contentType: 'application/pdf',
        }],
      })

      await this.prisma.ticketOrder.update({
        where: { id: orderId },
        data: { ticketEmailSentAt: new Date(), ticketEmailSendingAt: null },
      })
      return 'sent'
    } catch (error) {
      try {
        await this.prisma.ticketOrder.updateMany({
          where: { id: orderId, ticketEmailSentAt: null },
          data: { ticketEmailSendingAt: null },
        })
      } catch (releaseError) {
        this.logger.error(
          'Could not release the ticket email delivery claim.',
          releaseError instanceof Error ? releaseError.stack : undefined,
        )
      }
      this.logger.error(
        'Ticket email delivery failed.',
        error instanceof Error ? error.stack : undefined,
      )
      return 'pending'
    }
  }

  async downloadTicket(reference: string) {
    const order = await this.prisma.ticketOrder.findFirst({
      where: { reference, status: 'PAID' },
      include: { ticketType: true },
    })
    if (!order) throw new NotFoundException('A paid ticket with that reference was not found.')

    return {
      filename: `festival-ticket-${order.reference}.pdf`,
      content: await this.createTicketPdf(order),
    }
  }

  async validateTicket(reference: string) {
    const order = await this.prisma.ticketOrder.findUnique({
      where: { reference },
      include: { ticketType: { select: { name: true } } },
    })
    if (!order || order.status !== 'PAID') return { valid: false }

    return {
      valid: true,
      reference: order.reference,
      ticketName: order.ticketType.name,
      quantity: order.quantity,
      paidAt: order.paidAt,
    }
  }

  private smtpSettings() {
    const { SMTP_HOST: host, SMTP_USER: user, SMTP_PASSWORD: password } = process.env
    const port = Number(process.env.SMTP_PORT ?? 587)
    if (!host || !user || !password || !Number.isInteger(port) || port < 1 || port > 65_535) {
      throw new Error('Ticket email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD.')
    }
    return {
      host,
      user,
      password,
      port,
      secure: process.env.SMTP_SECURE === 'true' || port === 465,
      from: process.env.TICKETS_FROM_EMAIL || user,
    }
  }

  private async createTicketPdf(order: {
    reference: string
    buyerName: string
    county: string
    quantity: number
    amountMinor: number
    currency: string
    paidAt: Date | null
    ticketType: { name: string }
  }): Promise<Buffer> {
    const validationUrl = this.ticketUrl(order.reference, 'validate')
    const qrCode = await QRCode.toBuffer(validationUrl, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 240,
    })
    const document = new PDFDocument({
  size: 'A4',
  margin: 40,
});
    const chunks: Buffer[] = []
    const completed = new Promise<Buffer>((resolve, reject) => {
      document.on('data', (chunk: Buffer) => chunks.push(chunk))
      document.on('end', () => resolve(Buffer.concat(chunks)))
      document.on('error', reject)
    })

    document.font('Helvetica-Bold').fontSize(10).fillColor('#c34b2b').text('NORTHERN KENYA FESTIVAL')
    document.moveDown(0.8)
    document.fontSize(22).fillColor('#163b35').text(order.ticketType.name)
    document.moveDown(0.3)
    document.font('Helvetica').fontSize(11).fillColor('#315850').text(`Admit ${order.quantity} ${order.quantity === 1 ? 'guest' : 'guests'}`)
    document.moveDown(1)
    document.font('Helvetica-Bold').fontSize(10).text('Ticket holder', { width: 205 })
    document.font('Helvetica').fontSize(12).text(order.buyerName, { width: 205 })
    document.moveDown(0.7)
    document.font('Helvetica-Bold').fontSize(10).text('County', { width: 205 })
    document.font('Helvetica').fontSize(12).text(order.county, { width: 205 })
    document.moveDown(0.7)
    document.font('Helvetica-Bold').fontSize(10).text('Reference', { width: 205 })
    document.font('Helvetica').fontSize(10).text(order.reference, { width: 205 })
    document.moveDown(0.7)
    document.font('Helvetica-Bold').fontSize(10).text('Amount paid', { width: 205 })
    document.font('Helvetica').fontSize(12).text(
      new Intl.NumberFormat('en-KE', { style: 'currency', currency: order.currency }).format(order.amountMinor / 100),
      { width: 205 },
    )
    document.image(qrCode, document.page.width - 155, 168, { width: 115 })
    document.fontSize(8).fillColor('#547069').text('Scan this QR code to validate the ticket.', 40, 350, { width: 270 })
    if (order.paidAt) {
      document.text(`Paid ${new Intl.DateTimeFormat('en-KE', { dateStyle: 'medium', timeStyle: 'short' }).format(order.paidAt)}`)
    }
    document.end()

    return completed
  }

  private ticketUrl(reference: string, action: 'download' | 'validate') {
    const apiUrl = (process.env.PUBLIC_API_URL ?? 'http://localhost:6001/api').replace(/\/+$/, '')
    return `${apiUrl}/payments/ticket/${encodeURIComponent(reference)}/${action}`
  }

  private escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character]!)
  }
}
