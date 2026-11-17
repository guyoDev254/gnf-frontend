import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import type { Request } from 'express'

@Injectable()
export class AdminOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>()
    const origin = request.headers.origin
    if (!origin) return true

    let requestOrigin: string
    try {
      requestOrigin = new URL(origin).origin
    } catch {
      throw new ForbiddenException('Request origin is not allowed.')
    }

    const allowedOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:3000')
      .split(',')
      .map((value) => {
        try {
          return new URL(value.trim()).origin
        } catch {
          return ''
        }
      })
    if (!allowedOrigins.includes(requestOrigin)) {
      throw new ForbiddenException('Request origin is not allowed.')
    }
    return true
  }
}
