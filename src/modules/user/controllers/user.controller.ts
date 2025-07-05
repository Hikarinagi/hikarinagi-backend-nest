import { Controller, Post, Body, Get, Param, UseGuards, Request, Headers } from '@nestjs/common'
import { UserService } from '../services/user.service'
import { CreateUserDto } from '../dto/create-user.dto'
import { LoginUserDto } from '../dto/login-user.dto'
import { RefreshTokenDto } from '../dto/refresh-token.dto'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { RequestWithUser } from '../../auth/interfaces/request-with-user.interface'
import { HikariUserGroup } from '../../auth/enums/hikari-user-group.enum'
import { Roles } from '../../auth/decorators/roles.decorator'

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    const user = await this.userService.create(createUserDto)
    return {
      data: user,
      message: 'register success',
    }
  }

  @Post('login')
  async login(@Body() loginUserDto: LoginUserDto, @Headers('user-agent') userAgent: string) {
    const result = await this.userService.login(loginUserDto, userAgent)
    return {
      data: result,
    }
  }

  @Post('refresh-token')
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    const result = await this.userService.refreshToken(refreshTokenDto)
    return {
      data: result,
      message: 'token refreshed',
    }
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Request() req: RequestWithUser, @Body() refreshTokenDto: RefreshTokenDto) {
    await this.userService.logout(refreshTokenDto.refreshToken, req.user.userId)
    return {
      message: 'logout success',
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(HikariUserGroup.USER)
  @Get('profile')
  getProfile(@Request() req: RequestWithUser) {
    return {
      data: req.user,
    }
  }

  @Get(':username')
  async findByUsername(@Param('username') username: string) {
    const user = await this.userService.findByUsername(username)
    return {
      data: user,
      message: '获取用户信息成功',
    }
  }
}
