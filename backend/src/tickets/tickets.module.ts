import { Module } from '@nestjs/common'
import { TicketsController } from './tickets.controller'
import { TicketsService } from './tickets.service'
import { TicketInventoryService } from './ticket-inventory.service'

@Module({
  controllers: [TicketsController],
  providers: [TicketsService, TicketInventoryService],
  exports: [TicketsService, TicketInventoryService],
})
export class TicketsModule {}
