import { Body, Controller, Get, Post, Inject, Param, Query, Req, UseGuards } from '@nestjs/common'
import { LightNovelService } from '../services/lightnovel.service'
import { GetLightNovelListDto } from '../dto/get-lightnovel-list.dto'
import { RequestWithUser } from '../../../modules/auth/interfaces/request-with-user.interface'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Cache } from 'cache-manager'
import { ApiExtraModels, ApiOperation, ApiTags, getSchemaPath } from '@nestjs/swagger'
import { ApiOkResponseStandard } from '../../../common/swagger/response.decorators'
import { LightNovel } from '../schemas/light-novel.schema'
import { CreateLightNovelDto } from '../dto/create-lightnovel.dto'
import { Roles } from '../../../modules/auth/decorators/roles.decorator'
import { HikariUserGroup } from '../../../modules/auth/enums/hikari-user-group.enum'
import { RolesGuard } from '../../../modules/auth/guards/roles.guard'
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard'

@ApiTags('LightNovel')
@ApiExtraModels(LightNovel)
@Controller('lightnovel')
export class LightNovelController {
  constructor(
    private readonly lightNovelService: LightNovelService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @Get('list')
  async getLightNovelList(@Req() req: RequestWithUser, @Query() query: GetLightNovelListDto) {
    const cacheKey = `lightnovel-list-${JSON.stringify(query)}`
    const cachedData = await this.cacheManager.get(cacheKey)
    if (cachedData) {
      return {
        data: cachedData,
        cached: true,
      }
    }
    const novels = await this.lightNovelService.getLightNovelList(req, query)
    await this.cacheManager.set(cacheKey, novels, 60 * 60 * 24 * 1000)
    return {
      data: novels,
    }
  }

  @Get('random')
  @ApiOperation({ summary: '随机获取一个轻小说' })
  @ApiOkResponseStandard({ $ref: getSchemaPath(LightNovel) }, { description: '随机返回单个轻小说' })
  async getRandomLightNovel(@Req() req: RequestWithUser) {
    const lightNovel = await this.lightNovelService.getRandomLightNovel(req)
    return {
      data: lightNovel,
    }
  }

  @Get(':id')
  async findById(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
    @Query('preview') preview: boolean = false,
  ) {
    const novel = await this.lightNovelService.findById(id, req, preview)
    return {
      data: novel,
    }
  }

  @Post('create')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(HikariUserGroup.CREATOR)
  async createLightNovel(
    @Req() req: RequestWithUser,
    @Body() createLightNovelDto: CreateLightNovelDto,
  ) {
    const novel = await this.lightNovelService.createLightNovel(createLightNovelDto, req)
    return {
      data: novel,
    }
  }
}
