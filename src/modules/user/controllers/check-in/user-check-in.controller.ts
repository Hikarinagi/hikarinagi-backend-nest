import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common'
import { UserCheckInService } from '../../services/check-in/user-check-in.service'
import { RequestWithUser } from '../../../auth/interfaces/request-with-user.interface'
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard'
import { Types } from 'mongoose'
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
  ApiExtraModels,
} from '@nestjs/swagger'
import { ApiOkResponseStandard } from '../../../../common/swagger/response.decorators'
import { MakeUpCheckInDto } from '../../dto/check-in/make-up-check-in.dto'
import { CheckInRecord } from '../../schemas/check-in/check-in-record.schema'

@ApiTags('User')
@ApiExtraModels(CheckInRecord)
@Controller('user/check-in')
export class UserCheckInController {
  constructor(private readonly userCheckInService: UserCheckInService) {}

  @Post('')
  @ApiOperation({ summary: '签到' })
  @ApiBearerAuth()
  @ApiOkResponseStandard({
    properties: {
      points: { type: 'number' },
    },
  })
  @ApiUnauthorizedResponse({ description: '未认证' })
  @ApiBadRequestResponse({ description: '已签到' })
  @UseGuards(JwtAuthGuard)
  async checkIn(@Req() req: RequestWithUser) {
    const { points } = await this.userCheckInService.checkIn({
      userId: new Types.ObjectId(req.user._id),
      isMakeUp: false,
    })
    return {
      message: 'check in success',
      data: {
        points,
      },
    }
  }

  @Post('make-up')
  @ApiOperation({ summary: '补签' })
  @ApiBearerAuth()
  @ApiOkResponseStandard({
    properties: {
      points: { type: 'number' },
    },
  })
  @ApiNotFoundResponse({ description: '用户不存在' })
  @ApiBadRequestResponse({ description: '本月补签次数已达到上限/已补签/积分不足' })
  @ApiUnauthorizedResponse({ description: '未认证' })
  @UseGuards(JwtAuthGuard)
  async makeUpCheckIn(@Req() req: RequestWithUser, @Body() dto: MakeUpCheckInDto) {
    const { points } = await this.userCheckInService.makeUpCheckIn(
      new Types.ObjectId(req.user._id),
      dto,
    )
    return {
      message: 'make up check in success',
      data: {
        points,
      },
    }
  }

  @Get('status')
  @ApiOperation({ summary: '获取签到状态' })
  @ApiBearerAuth()
  @ApiOkResponseStandard({
    properties: {
      isCheckIn: { type: 'boolean' },
      streak: { type: 'number' },
    },
  })
  @ApiUnauthorizedResponse({ description: '未认证' })
  @UseGuards(JwtAuthGuard)
  async checkInStatus(@Req() req: RequestWithUser) {
    const status = await this.userCheckInService.checkIsCheckIn(new Types.ObjectId(req.user._id))
    const streak = await this.userCheckInService.getCheckInStreak(new Types.ObjectId(req.user._id))
    return {
      data: {
        isCheckIn: status,
        streak,
      },
    }
  }

  @Get('records')
  @ApiOperation({ summary: '获取签到记录(当月)' })
  @ApiBearerAuth()
  @ApiOkResponseStandard({
    type: 'array',
    items: { $ref: getSchemaPath(CheckInRecord) },
  })
  @ApiUnauthorizedResponse({ description: '未认证' })
  @UseGuards(JwtAuthGuard)
  async getCheckInRecord(@Req() req: RequestWithUser) {
    const records = await this.userCheckInService.getCheckInRecord(new Types.ObjectId(req.user._id))
    return {
      data: records,
    }
  }
}
