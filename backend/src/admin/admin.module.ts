import { Module } from '@nestjs/common'
import { AdminAuthController } from './auth/admin-auth.controller'
import { AdminAuthService } from './auth/admin-auth.service'
import { AdminAuthGuard } from './auth/admin-auth.guard'
import { AdminOriginGuard } from './auth/admin-origin.guard'
import { AdminController } from './admin.controller'
import { AdminService } from './admin.service'
import { TicketsModule } from '../tickets/tickets.module'

@Module({
  controllers: [AdminAuthController, AdminController],
  providers: [AdminAuthService, AdminAuthGuard, AdminOriginGuard, AdminService],
  imports: [TicketsModule],
})
export class AdminModule {}
