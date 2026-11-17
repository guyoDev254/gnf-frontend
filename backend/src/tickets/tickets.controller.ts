import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { TicketsService } from './tickets.service'

@ApiTags('Tickets')
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  @ApiOperation({ summary: 'List active ticket types and prices' })
  @ApiOkResponse({
    description: 'Active tickets ordered by price. Prices are in KES minor units.',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        required: ['slug', 'name', 'detail', 'priceMinor', 'currency'],
        properties: {
          slug: { type: 'string', example: 'regular' },
          name: { type: 'string', example: 'Regular' },
          detail: { type: 'string', example: 'Full access to the festival experience.' },
          priceMinor: { type: 'integer', example: 50000, description: 'KES amount in minor units.' },
          currency: { type: 'string', example: 'KES' },
          capacity: { type: 'integer', nullable: true, example: 100 },
          slotsAvailable: { type: 'integer', nullable: true, example: 72 },
        },
      },
    },
  })
  list() {
    return this.ticketsService.list()
  }
}
