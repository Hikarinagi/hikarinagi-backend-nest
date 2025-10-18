import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger'
import { ApiRoles } from '../../../common/swagger/api-roles.decorator'
import {
  ApiOkResponsePaginated,
  ApiOkResponseStandard,
} from '../../../common/swagger/response.decorators'
import { UpdateRequestService } from '../services/update-request.service'
import { GetUpdateRequestsDto } from '../dto/get-update-requests.dto'
import { GetUpdateRequestsByEntityParamsDto } from '../dto/get-update-requests-by-entity-params.dto'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { Roles } from '../../auth/decorators/roles.decorator'
import { HikariUserGroup } from '../../auth/enums/hikari-user-group.enum'
import { RequestWithUser } from '../../auth/interfaces/request-with-user.interface'
import { Types } from 'mongoose'
import { ProcessUpdateRequestDto } from '../dto/process-update-request.dto'
import { UpdateRequest } from '../schemas/update-request.schema'

@ApiTags('Update Requests')
@ApiBearerAuth()
@ApiExtraModels(UpdateRequest)
@Controller('update-request/requests')
export class UpdateRequestController {
  constructor(private readonly updateRequestService: UpdateRequestService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(HikariUserGroup.CREATOR)
  @ApiRoles('CREATOR')
  @ApiOperation({ summary: '获取当前用户提交的更新请求（分页）' })
  @ApiQuery({ name: 'entityType', required: false, description: '实体类型过滤' })
  @ApiQuery({ name: 'status', required: false, description: '请求状态过滤' })
  @ApiQuery({ name: 'page', required: false, description: '页码，从1开始', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量，最少10', example: 10 })
  @ApiOkResponsePaginated(UpdateRequest, { description: '返回分页的更新请求列表' })
  @ApiUnauthorizedResponse({ description: '未认证' })
  @ApiForbiddenResponse({ description: '无权限' })
  async getUpdateRequests(@Query() options: GetUpdateRequestsDto, @Req() req: RequestWithUser) {
    const requests = await this.updateRequestService.getUserUpdateRequests(req, options)
    return {
      data: requests,
    }
  }

  @Get('auditable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(HikariUserGroup.CREATOR)
  @ApiRoles('CREATOR')
  @ApiOperation({ summary: '获取当前用户可审核的更新请求（分页）' })
  @ApiQuery({ name: 'entityType', required: false, description: '实体类型过滤' })
  @ApiQuery({ name: 'status', required: false, description: '请求状态过滤' })
  @ApiQuery({ name: 'page', required: false, description: '页码，从1开始', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量，最少10', example: 10 })
  @ApiOkResponsePaginated(UpdateRequest, { description: '返回分页的更新请求列表' })
  @ApiUnauthorizedResponse({ description: '未认证' })
  @ApiForbiddenResponse({ description: '无权限' })
  async getAuditableUpdateRequests(
    @Query() options: GetUpdateRequestsDto,
    @Req() req: RequestWithUser,
  ) {
    const requests = await this.updateRequestService.getUserAuditableUpdateRequests(req, options)
    return {
      data: requests,
    }
  }

  @Get(':entityType/:entityId')
  @ApiOperation({ summary: '按实体获取已合并的更新请求的简要列表' })
  @ApiParam({ name: 'entityType', description: '实体类型' })
  @ApiParam({ name: 'entityId', description: '实体ID(ObjectId)' })
  @ApiOkResponseStandard(
    {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          _id: { type: 'string', description: '更新请求ID' },
          requestedBy: {
            type: 'object',
            properties: {
              userId: { type: 'string' },
              name: { type: 'string' },
              avatar: { type: 'string' },
            },
          },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
    { description: '返回简要列表' },
  )
  async getUpdateRequestsByEntity(@Param() params: GetUpdateRequestsByEntityParamsDto) {
    const requests = await this.updateRequestService.getUpdateRequestsByEntity(params)
    return {
      data: requests,
    }
  }

  @Get(':updateRequestId')
  @ApiOperation({ summary: '根据ID获取更新请求' })
  @ApiParam({ name: 'updateRequestId', description: '更新请求ID(ObjectId)' })
  @ApiOkResponseStandard(
    { $ref: getSchemaPath(UpdateRequest) },
    { description: '返回单个更新请求' },
  )
  @ApiNotFoundResponse({ description: '未找到更新请求' })
  async getUpdateRequestById(@Param('updateRequestId') updateRequestId: string) {
    const request = await this.updateRequestService.getUpdateRequestById(
      new Types.ObjectId(updateRequestId),
    )
    return {
      data: request,
    }
  }

  @Patch(':id/process')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(HikariUserGroup.CREATOR)
  @ApiRoles('CREATOR')
  @ApiOperation({ summary: '处理更新请求（合并/拒绝）' })
  @ApiParam({ name: 'id', description: '更新请求ID(ObjectId)' })
  @ApiOkResponseStandard(
    { $ref: getSchemaPath(UpdateRequest) },
    { description: '处理后的更新请求' },
  )
  @ApiUnauthorizedResponse({ description: '未认证' })
  @ApiForbiddenResponse({ description: '无权限' })
  @ApiNotFoundResponse({ description: '未找到更新请求' })
  @ApiBadRequestResponse({ description: '状态非 pending 或参数错误' })
  async processUpdateRequest(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
    @Body() processUpdateRequestDto: ProcessUpdateRequestDto,
  ) {
    const request = await this.updateRequestService.processUpdateRequest(
      new Types.ObjectId(id),
      processUpdateRequestDto,
      req,
    )
    return {
      data: request,
    }
  }
}
