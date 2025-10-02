import { Controller, Delete, HttpCode, HttpStatus, Param, Req, UseGuards } from '@nestjs/common'
import { RateService } from '../services/rate.service'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { RequestWithUser } from '../../auth/interfaces/request-with-user.interface'
import { Roles } from '../../auth/decorators/roles.decorator'
import { HikariUserGroup } from '../../auth/enums/hikari-user-group.enum'
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'

@ApiTags('Rate')
@ApiBearerAuth()
@Controller('rate')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RateController {
  constructor(private readonly rateService: RateService) {}

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(HikariUserGroup.USER)
  @ApiOperation({ summary: '删除评分' })
  @ApiParam({ name: 'id', description: '评分ID', required: true })
  @ApiNoContentResponse({ description: '删除成功' })
  @ApiUnauthorizedResponse({ description: '未认证或令牌无效' })
  @ApiForbiddenResponse({ description: '无权限删除此评分' })
  @ApiNotFoundResponse({ description: '评分不存在' })
  async delete(@Param('id') id: string, @Req() req: RequestWithUser) {
    await this.rateService.deleteRate(id, req)
  }
}
