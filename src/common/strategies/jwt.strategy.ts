import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { HikariConfigService } from '../config/configs'
import { RequestWithUser } from '../../modules/auth/interfaces/request-with-user.interface'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: HikariConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwt.secret'),
    })
  }

  async validate(payload: RequestWithUser['user']) {
    return {
      _id: payload._id,
      userId: payload.userId,
      name: payload.name,
      email: payload.email,
      hikariUserGroup: payload.hikariUserGroup,
    }
  }
}
