import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
  Get,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { AdminAuthGuard, AdminRequest } from './admin-auth.guard'
import { AdminOriginGuard } from './admin-origin.guard'
import { AdminAuthService } from './admin-auth.service'
import { AdminLoginDto } from './admin-login.dto'

@ApiTags('Admin authentication')
@UseGuards(AdminOriginGuard)
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly authService: AdminAuthService) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Sign in to the admin dashboard' })
  @ApiOkResponse({ schema: { example: { email: 'admin@example.com' } } })
  @ApiUnauthorizedResponse({ description: 'Credentials are incorrect.' })
  @ApiServiceUnavailableResponse({ description: 'Admin credentials or session secret are not configured.' })
  login(
    @Body() body: AdminLoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = this.authService.authenticate(body.email, body.password)
    response.cookie(this.authService.cookieName, session.cookie, this.cookieOptions(session.maxAge))
    return { email: session.email }
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'End the admin session' })
  @ApiOkResponse({ schema: { example: { success: true } } })
  @ApiUnauthorizedResponse({ description: 'Admin sign-in is required.' })
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(this.authService.cookieName, this.cookieOptions(0))
    return { success: true }
  }

  @Get('session')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Check the current admin session' })
  @ApiOkResponse({ schema: { example: { email: 'admin@example.com' } } })
  @ApiUnauthorizedResponse({ description: 'Admin sign-in is required.' })
  session(@Req() request: Request) {
    return { email: (request as AdminRequest).admin.email }
  }

  private cookieOptions(maxAge: number) {
    const production = process.env.NODE_ENV === 'production'
    return {
      httpOnly: true,
      secure: production,
      sameSite: production ? 'none' as const : 'lax' as const,
      path: '/api/admin',
      maxAge,
    }
  }
}
