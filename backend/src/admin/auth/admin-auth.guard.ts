import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import type { Request } from 'express'
import { AdminAuthService } from './admin-auth.service'

export interface AdminRequest extends Request {
  admin: { email: string }
}

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly authService: AdminAuthService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AdminRequest>()
    const session = this.authService.getSession(request.headers.cookie)
    if (!session) throw new UnauthorizedException('Admin sign-in is required.')
    request.admin = session
    return true
  }
}
