import { Controller, Req, Body, Param, Put, UseGuards } from '@nestjs/common'
import { LightNovelManagementService } from '../services/lightnovel-management.service'
import { UpdateLightNovelDto } from '../dto/lightnovel/update-lightnovel.dto'
import { RequestWithUser } from '../../auth/interfaces/request-with-user.interface'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { Roles } from '../../auth/decorators/roles.decorator'
import { HikariUserGroup } from '../../auth/enums/hikari-user-group.enum'

@Controller('creator-center/lightnovel')
@UseGuards(JwtAuthGuard)
@Roles(HikariUserGroup.CREATOR)
export class LightNovelManagementController {
  constructor(private readonly lightNovelManagementService: LightNovelManagementService) {}

  @Put(':novelId')
  async updateLightNovel(
    @Param('novelId') novelId: string,
    @Body() data: UpdateLightNovelDto,
    @Req() req: RequestWithUser,
  ) {
    const lightNovel = await this.lightNovelManagementService.updateLightNovel(novelId, data, req)
    return {
      data: lightNovel,
    }
  }
}
