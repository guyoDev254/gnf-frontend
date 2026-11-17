import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import { AdminAuthGuard } from './auth/admin-auth.guard'
import { AdminOriginGuard } from './auth/admin-origin.guard'
import { AdminService } from './admin.service'
import { AdminOrdersQueryDto } from './dto/admin-orders-query.dto'
import { CreateAdminTicketDto, UpdateAdminTicketDto } from './dto/admin-ticket.dto'

@ApiTags('Admin')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Admin sign-in is required.' })
@UseGuards(AdminOriginGuard, AdminAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get order, sales, and ticket overview' })
  @ApiOkResponse({ description: 'Sales are totals of verified paid orders.' })
  dashboard() {
    return this.adminService.dashboard()
  }

  @Get('tickets')
  @ApiOperation({ summary: 'List all ticket types, including archived types' })
  @ApiOkResponse()
  listTickets() {
    return this.adminService.listTickets()
  }

  @Post('tickets')
  @ApiOperation({ summary: 'Create a ticket type' })
  @ApiCreatedResponse()
  createTicket(@Body() body: CreateAdminTicketDto) {
    return this.adminService.createTicket(body)
  }

  @Patch('tickets/:id')
  @ApiOperation({ summary: 'Update a ticket type' })
  @ApiOkResponse()
  @ApiNotFoundResponse({ description: 'Ticket type was not found.' })
  updateTicket(@Param('id') id: string, @Body() body: UpdateAdminTicketDto) {
    return this.adminService.updateTicket(id, body)
  }

  @Delete('tickets/:id')
  @ApiOperation({ summary: 'Archive a ticket type without deleting its order history' })
  @ApiOkResponse()
  @ApiNotFoundResponse({ description: 'Ticket type was not found.' })
  archiveTicket(@Param('id') id: string) {
    return this.adminService.archiveTicket(id)
  }

  @Get('orders')
  @ApiOperation({ summary: 'Search and filter ticket orders' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'PAID', 'FAILED'] })
  @ApiQuery({ name: 'search', required: false, description: 'Matches buyer name, email, phone, or payment reference.' })
  @ApiOkResponse({ description: 'Orders are returned newest first, with pagination metadata.' })
  listOrders(@Query() query: AdminOrdersQueryDto) {
    return this.adminService.listOrders(query)
  }
}
