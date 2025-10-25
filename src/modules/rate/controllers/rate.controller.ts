import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { RateService } from '../services/rate.service'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { RequestWithUser } from '../../auth/interfaces/request-with-user.interface'
import { Roles } from '../../auth/decorators/roles.decorator'
import { HikariUserGroup } from '../../auth/enums/hikari-user-group.enum'
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiOkResponse,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger'
import { ApiOkResponseStandard } from '../../../common/swagger/response.decorators'
import { Rate } from '../schemas/rate.schema'
import { CreateRateDto } from '../dto/create-rate.dto'
import { UpdateRateDto } from '../dto/update-rate.dto'
import { GetRatesQueryDto } from '../dto/get-rates.dto'
import { GetAllRatesQueryDto } from '../dto/get-all-rates.dto'
import { GetReviewsQueryDto } from '../dto/get-reviews.dto'

@ApiTags('Rate')
@ApiExtraModels(Rate)
@Controller('rate')
export class RateController {
  constructor(private readonly rateService: RateService) {}

  @Post()
  @ApiBearerAuth()
  @Roles(HikariUserGroup.USER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: '创建评分' })
  @ApiCreatedResponse({ description: '创建成功' })
  @ApiOkResponseStandard({ $ref: getSchemaPath(Rate) })
  @ApiUnauthorizedResponse({ description: '未认证或令牌无效' })
  async create(@Body() body: CreateRateDto, @Req() req: RequestWithUser) {
    const rate = await this.rateService.createRate(body, req)
    return {
      data: rate,
    }
  }

  @Roles(HikariUserGroup.USER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新评分' })
  @ApiOkResponse({ description: '更新成功' })
  @ApiOkResponseStandard({ $ref: getSchemaPath(Rate) })
  @ApiUnauthorizedResponse({ description: '未认证或令牌无效' })
  @ApiForbiddenResponse({ description: '无权限修改该评分' })
  @ApiNotFoundResponse({ description: '评分不存在或无权限修改' })
  @Put(':id')
  async update(@Param('id') id: string, @Body() body: UpdateRateDto, @Req() req: RequestWithUser) {
    const rate = await this.rateService.updateRate(id, body, req)
    return {
      data: {
        ...rate,
        isRated: true,
      },
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(HikariUserGroup.USER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除评分' })
  @ApiParam({ name: 'id', description: '评分ID', required: true })
  @ApiNoContentResponse({ description: '删除成功' })
  @ApiUnauthorizedResponse({ description: '未认证或令牌无效' })
  @ApiForbiddenResponse({ description: '无权限删除此评分' })
  @ApiNotFoundResponse({ description: '评分不存在' })
  async delete(@Param('id') id: string, @Req() req: RequestWithUser) {
    await this.rateService.deleteRate(id, req)
  }

  @ApiOperation({ summary: '获取评分列表' })
  @ApiOkResponseStandard({
    type: 'object',
    properties: {
      list: { type: 'array', items: { $ref: getSchemaPath(Rate) } },
      myRate: { type: 'object' },
      avgRate: { type: 'number' },
      count: {
        type: 'object',
        properties: {
          total: { type: 'number' },
          going: { type: 'number' },
          completed: { type: 'number' },
          onhold: { type: 'number' },
          dropped: { type: 'number' },
          plan: { type: 'number' },
          avgTime: { type: 'number' },
        },
      },
      pagination: {
        type: 'object',
        properties: {
          page: { type: 'number' },
          totalPages: { type: 'number' },
          limit: { type: 'number' },
          total: { type: 'number' },
        },
      },
    },
  })
  @Get()
  async getRates(@Query() query: GetRatesQueryDto) {
    const data = await this.rateService.getRates(query)
    return {
      data,
    }
  }

  @ApiOperation({ summary: '获取全部评分（分类）' })
  @ApiOkResponseStandard({
    type: 'object',
    properties: {
      rates: { type: 'array', items: { $ref: getSchemaPath(Rate) } },
      pagination: {
        type: 'object',
        properties: {
          page: { type: 'number' },
          totalPages: { type: 'number' },
          limit: { type: 'number' },
          total: { type: 'number' },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: '未认证或令牌无效' })
  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  async getAllRates(@Query() query: GetAllRatesQueryDto, @Req() req: RequestWithUser) {
    const data = await this.rateService.getAllRates(query, req)
    return {
      data,
    }
  }

  @ApiOperation({ summary: '获取点评列表' })
  @ApiOkResponseStandard({
    type: 'object',
    properties: {
      list: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            title: { type: 'string' },
            content: { type: 'string' },
            creator: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                userId: { type: 'string' },
                avatar: { type: 'string' },
              },
            },
          },
        },
      },
      pagination: {
        type: 'object',
        properties: {
          page: { type: 'number' },
          totalPages: { type: 'number' },
          limit: { type: 'number' },
          total: { type: 'number' },
        },
      },
    },
  })
  @Get('review')
  async getReviews(@Query() query: GetReviewsQueryDto) {
    const data = await this.rateService.getReviews(query)
    return {
      data,
    }
  }
}
