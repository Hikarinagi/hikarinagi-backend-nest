import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Request,
  Headers,
  HttpStatus,
  HttpCode,
  Req,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common'
import { UserService } from '../services/user.service'
import {
  VerificationForSignupDto,
  CreateUserDto,
  LoginUserDto,
  RefreshTokenDto,
  ResetPasswordDto,
} from '../dto/user'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RequestWithUser } from '../../auth/interfaces/request-with-user.interface'
import { HikariUserGroup } from '../../auth/enums/hikari-user-group.enum'
import { Roles } from '../../auth/decorators/roles.decorator'
import { UpdateUserEmailDto } from '../dto/user/update-user-email.dto'
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiExtraModels,
  getSchemaPath,
  ApiHeader,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger'
import {
  ApiOkResponseStandard,
  ApiOkResponsePaginated,
} from '../../../common/swagger/response.decorators'
import { ApiRoles } from '../../../common/swagger/api-roles.decorator'
import { User } from '../schemas/user.schema'
import { UserSetting } from '../schemas/user-setting.schema'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { UserStatusDto } from '../dto/response/user-status.dto'
import { UserUnreadSummaryDto } from '../dto/response/user-unread-summary.dto'

@ApiTags('User')
@ApiExtraModels(User, UserSetting, UserStatusDto, UserUnreadSummaryDto)
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('verification-for-signup')
  @ApiOperation({ summary: '请求注册验证码' })
  @ApiOkResponseStandard(
    {
      type: 'object',
      properties: {
        uuid: { type: 'string' },
        email: { type: 'string' },
        type: { type: 'string', example: 'register' },
      },
    },
    { description: '返回验证码请求信息' },
  )
  @ApiBadRequestResponse({ description: '参数错误' })
  @ApiConflictResponse({ description: '用户名或邮箱已被使用' })
  async verificationForSignup(@Body() verificationForSignupDto: VerificationForSignupDto) {
    const result = await this.userService.sendVerificationEmailForSignUp(verificationForSignupDto)
    return {
      data: result,
      message: 'verification email sent',
    }
  }

  @Post('register')
  @ApiOperation({ summary: '注册用户' })
  @ApiCreatedResponse({ description: '注册成功' })
  @ApiOkResponseStandard({ $ref: getSchemaPath(User) })
  @ApiBadRequestResponse({ description: '参数错误' })
  @ApiForbiddenResponse({ description: '注册已关闭/验证码未通过' })
  @ApiConflictResponse({ description: '用户名或邮箱已被使用' })
  async register(@Body() createUserDto: CreateUserDto) {
    const user = await this.userService.create(createUserDto)
    return {
      data: user,
      message: 'register success',
    }
  }

  @Post('reset-password')
  @ApiOperation({ summary: '重置密码（通过邮箱验证码）' })
  @ApiOkResponse({
    description: '密码重置成功',
  })
  @ApiBadRequestResponse({ description: '参数错误' })
  @ApiNotFoundResponse({ description: '用户不存在' })
  @ApiForbiddenResponse({ description: '验证码无效或已过期' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    await this.userService.resetPassword(resetPasswordDto)
    return {
      message: '密码重置成功',
    }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '登录' })
  @ApiOkResponseStandard({
    type: 'object',
    properties: {
      hikariAccessToken: { type: 'string' },
      hikariRefreshToken: { type: 'string' },
      user: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          userId: { type: 'string' },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: '用户不存在' })
  @ApiUnauthorizedResponse({ description: '密码错误' })
  @ApiHeader({ name: 'user-agent', description: '用户代理', required: false })
  async login(@Body() loginUserDto: LoginUserDto, @Headers('user-agent') userAgent?: string) {
    const result = await this.userService.login(loginUserDto, userAgent)
    return {
      data: result,
    }
  }

  @Post('refresh-token')
  @ApiOperation({ summary: '刷新 access token' })
  @ApiOkResponseStandard({
    type: 'object',
    properties: {
      hikariAccessToken: { type: 'string' },
    },
  })
  @ApiUnauthorizedResponse({ description: '无效的 refreshToken/用户不存在' })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    const result = await this.userService.refreshToken(refreshTokenDto)
    return {
      data: result,
      message: 'token refreshed',
    }
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '登出（移除 refresh token）' })
  @ApiRoles('USER')
  @ApiOkResponse({ description: '登出成功' })
  @ApiUnauthorizedResponse({ description: '无效 refreshToken 或未登录' })
  async logout(@Request() req: RequestWithUser, @Body() refreshTokenDto: RefreshTokenDto) {
    await this.userService.logout(refreshTokenDto.refreshToken, req.user.userId)
    return {
      message: 'logout success',
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前用户资料' })
  @ApiRoles('USER')
  @ApiOkResponseStandard({
    type: 'object',
    allOf: [
      { $ref: getSchemaPath(User) },
      {
        type: 'object',
        properties: {
          userSetting: { $ref: getSchemaPath(UserSetting) },
        },
      },
    ],
  })
  @ApiUnauthorizedResponse({ description: '未认证' })
  async getProfile(@Request() req: RequestWithUser) {
    const user = await this.userService.getProfile(req.user._id)
    return {
      data: user,
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('status')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取用户状态' })
  @ApiRoles('USER')
  @ApiOkResponseStandard({ $ref: getSchemaPath(UserStatusDto) })
  @ApiUnauthorizedResponse({ description: '未认证' })
  @ApiNotFoundResponse({ description: '用户不存在' })
  async getUserStatus(@Req() req: RequestWithUser) {
    const status = await this.userService.getUserStatus(req)

    return {
      data: status,
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('unread')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取未读消息数量' })
  @ApiRoles('USER')
  @ApiOkResponseStandard({ $ref: getSchemaPath(UserUnreadSummaryDto) })
  @ApiUnauthorizedResponse({ description: '未认证' })
  async getUnreadMessageCount(@Req() req: RequestWithUser) {
    const unreadMessageSummary = await this.userService.getUnreadMessageSummary(req)
    return {
      data: unreadMessageSummary,
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(HikariUserGroup.ADMIN)
  @Get(':username')
  @ApiBearerAuth()
  @ApiOperation({ summary: '按用户名查询用户' })
  @ApiRoles('ADMIN')
  @ApiOkResponseStandard({ $ref: getSchemaPath(User) })
  @ApiUnauthorizedResponse({ description: '未认证' })
  @ApiForbiddenResponse({ description: '无权限' })
  @ApiNotFoundResponse({ description: '用户不存在' })
  async findByUsername(@Param('username') username: string) {
    const user = await this.userService.findByUsername(username)
    return {
      data: user,
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-email/request')
  @ApiBearerAuth()
  @ApiOperation({ summary: '请求修改邮箱验证码' })
  @ApiRoles('USER')
  @ApiOkResponseStandard({
    type: 'object',
    properties: { uuid: { type: 'string' } },
  })
  @ApiUnauthorizedResponse({ description: '未认证' })
  async requestUpdateEmail(@Req() req: RequestWithUser) {
    const { uuid } = await this.userService.requestUpdateEmail(req)
    return {
      data: {
        uuid,
      },
      message: 'verification email sent',
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-email/update')
  @ApiBearerAuth()
  @ApiOperation({ summary: '提交修改邮箱' })
  @ApiRoles('USER')
  @ApiOkResponse({ description: '邮箱已更新' })
  @ApiUnauthorizedResponse({ description: '未认证' })
  @ApiForbiddenResponse({ description: '验证码未通过/流程过期' })
  @ApiConflictResponse({ description: '邮箱已被使用' })
  async updateEmail(@Req() req: RequestWithUser, @Body() updateUserEmailDto: UpdateUserEmailDto) {
    await this.userService.updateEmail(req, updateUserEmailDto)
    return {
      message: 'email updated',
    }
  }

  @Get(':userId/following')
  @ApiOperation({
    summary: '获取用户关注列表',
    description: '获取指定用户的关注列表，支持分页查询。此接口不需要认证。',
  })
  @ApiParam({
    name: 'userId',
    description: '用户ID',
    example: '123456',
    type: 'string',
  })
  @ApiQuery({
    name: 'page',
    description: '页码，从1开始',
    required: false,
    example: 1,
    type: 'number',
  })
  @ApiQuery({
    name: 'limit',
    description: '每页数量',
    required: false,
    example: 10,
    type: 'number',
  })
  @ApiOkResponsePaginated(User, { description: 'get following list' })
  @ApiNotFoundResponse({ description: 'user not found' })
  async getFollowingList(
    @Param('userId') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    const followingList = await this.userService.getFollowingList(userId, page, limit)
    return {
      data: followingList,
    }
  }

  @Get(':userId/followers')
  @ApiOperation({
    summary: '获取用户粉丝列表',
    description: '获取指定用户的粉丝列表，支持分页查询。此接口不需要认证。',
  })
  @ApiParam({
    name: 'userId',
    description: '用户ID',
    example: '123456',
    type: 'string',
  })
  @ApiQuery({
    name: 'page',
    description: '页码，从1开始',
    required: false,
    example: 1,
    type: 'number',
  })
  @ApiQuery({
    name: 'limit',
    description: '每页数量',
    required: false,
    example: 10,
    type: 'number',
  })
  @ApiOkResponsePaginated(User, { description: 'get follower list' })
  @ApiNotFoundResponse({ description: 'user not found' })
  async getFollowerList(
    @Param('userId') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    const followerList = await this.userService.getFollowerList(userId, page, limit)
    return {
      data: followerList,
    }
  }
}
