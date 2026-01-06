import { Body, Controller, Post, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { Roles } from '../../auth/decorators/roles.decorator'
import { HikariUserGroup } from '../../auth/enums/hikari-user-group.enum'
import { ContentVisibilityService } from '../services/content-visibility.service'
import { SetContentVisibilityDto } from '../dto/set-content-visibility.dto'

@Controller('content')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(HikariUserGroup.ADMIN)
export class ContentVisibilityController {
  constructor(private readonly contentVisibilityService: ContentVisibilityService) {}

  @Post('visibility/private')
  async setVisibilityPrivate(@Body() dto: SetContentVisibilityDto) {
    const data = await this.contentVisibilityService.setPrivate(dto)
    return { data }
  }
}
