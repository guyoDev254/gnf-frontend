import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common'
import { createHmac, createHash, timingSafeEqual } from 'node:crypto'

const SESSION_COOKIE = 'nkf_admin_session'
const SESSION_DURATION_SECONDS = 8 * 60 * 60

interface AdminSession {
  email: string
  expiresAt: number
}

@Injectable()
export class AdminAuthService {
  authenticate(email: string, password: string) {
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
    const adminPassword = process.env.ADMIN_PASSWORD
    if (!adminEmail || !adminPassword || adminPassword.length < 12) {
      throw new ServiceUnavailableException('Admin sign-in is not securely configured.')
    }

    const emailMatches = this.constantTimeEqual(email.trim().toLowerCase(), adminEmail)
    const passwordMatches = this.constantTimeEqual(password, adminPassword)
    if (!emailMatches || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password.')
    }

    const session: AdminSession = {
      email: adminEmail,
      expiresAt: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
    }
    return {
      cookie: this.sign(session),
      email: session.email,
      maxAge: SESSION_DURATION_SECONDS * 1000,
    }
  }

  getSession(cookieHeader: string | undefined) {
    const cookie = this.readCookie(cookieHeader)
    if (!cookie) return null

    const [payload, signature, extra] = cookie.split('.')
    if (!payload || !signature || extra) return null
    const expected = this.signature(payload)
    if (!this.constantTimeEqual(signature, expected)) return null

    try {
      const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AdminSession
      const configuredEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
      if (
        typeof session.email !== 'string' ||
        session.email !== configuredEmail ||
        typeof session.expiresAt !== 'number' ||
        session.expiresAt <= Math.floor(Date.now() / 1000)
      ) {
        return null
      }
      return { email: session.email }
    } catch {
      return null
    }
  }

  get cookieName() {
    return SESSION_COOKIE
  }

  private sign(session: AdminSession) {
    const payload = Buffer.from(JSON.stringify(session)).toString('base64url')
    return `${payload}.${this.signature(payload)}`
  }

  private signature(payload: string) {
    return createHmac('sha256', this.sessionSecret()).update(payload).digest('base64url')
  }

  private sessionSecret() {
    const secret = process.env.ADMIN_SESSION_SECRET
    if (!secret || secret.length < 32) {
      throw new ServiceUnavailableException('Admin session signing is not securely configured.')
    }
    return secret
  }

  private constantTimeEqual(left: string, right: string) {
    const leftHash = createHash('sha256').update(left).digest()
    const rightHash = createHash('sha256').update(right).digest()
    return timingSafeEqual(leftHash, rightHash) && left.length === right.length
  }

  private readCookie(cookieHeader: string | undefined) {
    if (!cookieHeader) return null
    const item = cookieHeader.split(';').map((part) => part.trim())
      .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    return item?.slice(SESSION_COOKIE.length + 1) ?? null
  }
}
