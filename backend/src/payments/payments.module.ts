import { Module } from '@nestjs/common'
import { PaymentsController } from './payments.controller'
import { PaymentsService } from './payments.service'
import { TicketsModule } from '../tickets/tickets.module'
import { TicketDeliveryService } from './ticket-delivery.service'

@Module({
  imports: [TicketsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, TicketDeliveryService],
})
export class PaymentsModule {}
