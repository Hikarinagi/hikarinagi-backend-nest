import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Req,
  Body,
  UseGuards,
  Inject,
} from '@nestjs/common'
import { Roles } from '../../auth/decorators/roles.decorator'
import { GalgameService } from '../services/galgame.service'
import { GalgameLinsService } from '../services/galgame-links.service'
import { GetGalgameListDto } from '../dto/get-galgame-list.dto'
import { RequestWithUser } from '../../auth/interfaces/request-with-user.interface'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { HikariUserGroup } from '../../auth/enums/hikari-user-group.enum'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { DownloadAuthDto } from '../dto/download-auth.dto'
import { DisableNSFWFilter } from '../../auth/decorators/disable-nsfw-filter.decorator'
import { CreateGalgameDto } from '../dto/create-galgame.dto'
import { UpdateGalgameCoverAndImagesDto } from '../dto/update-galgame.dto'
import { GetGalgameMonthlyReleasesDto } from '../dto/get-galgame-monthly-releases.dto'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Cache } from 'cache-manager'
import { ApiExtraModels, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ApiOkResponseStandard } from '../../../common/swagger/response.decorators'
import { Galgame } from '../schemas/galgame.schema'
import { CheckDuplicateDto } from '../dto/check-duplicate.dto'

@ApiTags('Galgame')
@ApiExtraModels(Galgame)
@Controller('galgame')
export class GalgameController {
  constructor(
    private readonly galgameService: GalgameService,
    private readonly galgameLinsService: GalgameLinsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @Get('list')
  async getGalgameList(@Query() query: GetGalgameListDto, @Req() req: RequestWithUser) {
    const cacheKey = `galgame-list-${JSON.stringify(query)}`
    const cachedData = await this.cacheManager.get(cacheKey)
    if (cachedData) {
      return {
        data: cachedData,
        cached: true,
      }
    }
    const result = await this.galgameService.getGalgameList(req, query)
    await this.cacheManager.set(cacheKey, result, 60 * 60 * 24 * 1000)
    return {
      data: result,
    }
  }

  @Get('monthly-releases')
  async getGalgameMonthlyReleases(@Query() query: GetGalgameMonthlyReleasesDto) {
    const result = await this.galgameService.getGalgameMonthlyReleases(query)
    return {
      data: result,
    }
  }

  @Get('random')
  @ApiOperation({ summary: '随机获取一个 Galgame' })
  @ApiOkResponseStandard({ type: 'number' }, { description: '随机返回单个 Galgame 的 galId' })
  async getRandomGalgame(@Req() req: RequestWithUser) {
    const galgame = await this.galgameService.getRandomGalgame(req)
    return {
      data: galgame,
    }
  }

  @Get(':id')
  async findById(
    @Param('id') id: string,
    @Query('preview') preview: boolean = false,
    @Req() req: RequestWithUser,
  ): Promise<{ data: any }> {
    const galgame = await this.galgameService.findById(id, preview, req)
    return {
      data: galgame,
    }
  }

  @Get(':id/download-info')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(HikariUserGroup.USER)
  async getDownloadInfo(@Param('id') id: string) {
    const downloadInfo = await this.galgameService.getDownloadInfo(id)
    return {
      data: downloadInfo,
    }
  }

  @Post('download-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(HikariUserGroup.USER)
  async getDownloadAuthInfo(@Body() body: DownloadAuthDto, @Req() req: RequestWithUser) {
    const downloadAuthInfo = await this.galgameService.getDownloadAuthInfo(
      body.id,
      body.timestamp,
      req,
    )
    return {
      data: downloadAuthInfo,
    }
  }

  @Get(':id/links')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(HikariUserGroup.USER)
  async getGameLinks(@Param('id') id: string) {
    const links = await this.galgameLinsService.getLinks(id)
    return {
      data: links,
    }
  }

  @Get(':id/related')
  @DisableNSFWFilter()
  async getRelatedGalgames(@Param('id') id: string, @Req() req: RequestWithUser) {
    const relatedGalgames = await this.galgameService.getRelatedGalgames(id, req)
    return {
      data: relatedGalgames,
    }
  }

  @Get('bangumi/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(HikariUserGroup.CREATOR)
  async fetchBangumiData(@Param('id') id: string) {
    const bangumiData = await this.galgameService.fetchGameDataFromBangumi(id)
    return {
      data: bangumiData,
    }
  }

  @Post('create')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(HikariUserGroup.CREATOR)
  async createGalgame(@Body() body: CreateGalgameDto, @Req() req: RequestWithUser) {
    const galgame = await this.galgameService.createGalgame(body, req)
    return {
      data: galgame,
    }
  }

  @Post('check-duplicate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(HikariUserGroup.CREATOR)
  @ApiOperation({ summary: '检查 Galgame 是否重复，及外部ID有效性与匹配情况' })
  @ApiOkResponseStandard({
    type: 'object',
    properties: {
      isDuplicate: { type: 'boolean' },
      name: { type: 'string', nullable: true },
      message: { type: 'string' },
    },
  })
  async checkDuplicate(@Body() body: CheckDuplicateDto) {
    const result = await this.galgameService.checkDuplicate({
      bangumiId: body.bangumiId,
      vndbId: body.vndbId,
      skipMatchCheck: body.skipMatchCheck,
    })
    return {
      data: result,
    }
  }

  @Put(':id/update-cover-and-images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(HikariUserGroup.CREATOR)
  async updateGalgameCoverAndImages(
    @Param('id') id: string,
    @Body() body: UpdateGalgameCoverAndImagesDto,
    @Req() req: RequestWithUser,
  ) {
    const galgame = await this.galgameService.updateGalgameCoverAndImages(id, body, req)
    return {
      data: galgame,
    }
  }
}
