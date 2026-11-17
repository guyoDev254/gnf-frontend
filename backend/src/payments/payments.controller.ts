import {
  Controller,
  Body,
  Get,
  HttpCode,
  Param,
  Post,
  RawBodyRequest,
  Res,
  Req,
} from '@nestjs/common'
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import type { Request } from 'express'
import type { Response } from 'express'
import { InitializePaymentDto } from './dto/initialize-payment.dto'
import {
  ApiErrorResponseDto,
  InitializePaymentResponseDto,
  PaystackWebhookResponseDto,
  VerifyPaymentResponseDto,
} from './dto/payment-responses.dto'
import { PaymentsService } from './payments.service'

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('initialize')
  @ApiOperation({ summary: 'Create a ticket order and initialize Paystack checkout' })
  @ApiBody({ type: InitializePaymentDto })
  @ApiCreatedResponse({ type: InitializePaymentResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto, description: 'Invalid ticket or buyer details.' })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto, description: 'Ticket type is unavailable.' })
  @ApiBadGatewayResponse({ type: ApiErrorResponseDto, description: 'Paystack could not initialize checkout.' })
  @ApiServiceUnavailableResponse({ type: ApiErrorResponseDto, description: 'Paystack is not configured.' })
  initialize(@Body() body: InitializePaymentDto) {
    return this.paymentsService.initialize(body)
  }

  @Get('verify/:reference')
  @ApiOperation({ summary: 'Verify a payment transaction with Paystack' })
  @ApiParam({ name: 'reference', description: 'Payment reference returned when checkout was initialized.' })
  @ApiOkResponse({ type: VerifyPaymentResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto, description: 'Payment reference was not found.' })
  @ApiBadGatewayResponse({ type: ApiErrorResponseDto, description: 'Paystack verification failed or did not match the order.' })
  @ApiServiceUnavailableResponse({ type: ApiErrorResponseDto, description: 'Paystack is not configured.' })
  verify(@Param('reference') reference: string) {
    return this.paymentsService.verify(reference)
  }

  @Get('ticket/:reference/download')
  @ApiOperation({ summary: 'Download the PDF ticket for a paid order' })
  @ApiParam({ name: 'reference', description: 'Unpredictable ticket order reference.' })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto, description: 'A paid ticket with that reference was not found.' })
  async downloadTicket(@Param('reference') reference: string, @Res() response: Response) {
    const ticket = await this.paymentsService.downloadTicket(reference)
    response.setHeader('Content-Type', 'application/pdf')
    response.setHeader('Content-Disposition', `attachment; filename="${ticket.filename}"`)
    response.setHeader('Cache-Control', 'private, no-store')
    response.send(ticket.content)
  }

  @Get('ticket/:reference/validate')
  @ApiOperation({ summary: 'Validate a ticket QR code' })
  @ApiParam({ name: 'reference', description: 'Ticket order reference encoded in the QR code.' })
  @ApiOkResponse({
    schema: {
      oneOf: [
        { type: 'object', properties: { valid: { type: 'boolean', example: false } } },
        {
          type: 'object',
          properties: {
            valid: { type: 'boolean', example: true },
            reference: { type: 'string' },
            ticketName: { type: 'string' },
            quantity: { type: 'integer' },
            paidAt: { type: 'string', format: 'date-time', nullable: true },
          },
        },
      ],
    },
  })
  validateTicket(@Param('reference') reference: string) {
    return this.paymentsService.validateTicket(reference)
  }

  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Receive and validate Paystack webhook events' })
  @ApiHeader({
    name: 'x-paystack-signature',
    required: true,
    description: 'Hex-encoded HMAC SHA-512 signature generated with the Paystack secret key.',
  })
  @ApiBody({
    description: 'Paystack webhook event payload. Successful charge events are verified with Paystack before an order is marked paid.',
    schema: {
      type: 'object',
      properties: {
        event: { type: 'string', example: 'charge.success' },
        data: {
          type: 'object',
          properties: {
            reference: { type: 'string', example: 'nkf_64a0c8b562c747b4b1d615812d1854bc' },
          },
        },
      },
    },
  })
  @ApiOkResponse({ type: PaystackWebhookResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto, description: 'Webhook signature is missing or invalid.' })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto, description: 'The referenced order was not found.' })
  webhook(@Req() request: RawBodyRequest<Request>) {
    return this.paymentsService.handleWebhook(request)
  }
}
