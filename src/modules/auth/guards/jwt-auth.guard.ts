import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { Request } from 'express'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    super()
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>()
    const token = this.extractTokenFromHeader(request) || this.extractTokenFromCookie(request)

    if (!token) {
      throw new UnauthorizedException('身份验证失败: 未提供访问令牌')
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('jwt.secret'),
      })

      request['user'] = payload
    } catch {
      throw new UnauthorizedException('身份验证失败: 令牌无效或已过期')
    }

    return true
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? []
    return type === 'Bearer' ? token : undefined
  }

  private extractTokenFromCookie(request: Request): string | undefined {
    if (request.cookies) {
      if (request.cookies['hikari_access_token']) {
        return request.cookies['hikari_access_token']
      }
    }
    return undefined
  }
}
