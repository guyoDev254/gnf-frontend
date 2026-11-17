import { ApiProperty } from '@nestjs/swagger'

export class InitializePaymentResponseDto {
  @ApiProperty({ example: 'nkf_64a0c8b562c747b4b1d615812d1854bc' })
  reference!: string

  @ApiProperty({ example: 'https://checkout.paystack.com/abc123' })
  authorizationUrl!: string
}

export class VerifyPaymentResponseDto {
  @ApiProperty({ enum: ['paid', 'pending', 'failed'], example: 'paid' })
  status!: 'paid' | 'pending' | 'failed'

  @ApiProperty({ example: 'nkf_64a0c8b562c747b4b1d615812d1854bc' })
  reference!: string

  @ApiProperty({ enum: ['sent', 'pending'], required: false, description: 'Ticket email delivery state.' })
  ticketEmailStatus?: 'sent' | 'pending'
}

export class PaystackWebhookResponseDto {
  @ApiProperty({ example: true })
  received!: boolean
}

export class ApiErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number

  @ApiProperty({ example: 'Validation failed' })
  message!: string | string[]

  @ApiProperty({ example: 'Bad Request' })
  error!: string
}
