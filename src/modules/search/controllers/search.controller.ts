import { Controller, Get, Inject, Query } from '@nestjs/common'
import { SearchService } from '../services/search.service'
import { SearchDto } from '../dto/search.dto'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Cache } from 'cache-manager'
import { TrendingDto } from '../dto/trending.dto'
import { SuggestDto } from '../dto/suggest.dto'
import { SearchAnalyticsService } from '../services/search-analytics.service'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { SEARCH_ANALYTICS_QUEUE } from '../constants/analytics'

@Controller('search')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly analyticsService: SearchAnalyticsService,
    @InjectQueue(SEARCH_ANALYTICS_QUEUE) private readonly analyticsQueue: Queue,
  ) {}

  @Get()
  async search(@Query() searchDto: SearchDto) {
    const { keyword, type, page, limit, relative_match } = searchDto
    const cacheKey = `${keyword}-${type}-${page}-${limit}-${relative_match}`
    const cachedResult = await this.cacheManager.get(cacheKey)
    if (cachedResult) {
      return {
        data: cachedResult,
        cached: true,
      }
    }

    const result = await this.searchService.search(searchDto)

    await this.analyticsQueue.add('record_search', {
      keyword,
      type,
      resultCount: Array.isArray(result?.items) ? result.items.length : undefined,
    })
    await this.cacheManager.set(cacheKey, result, 60 * 60 * 1000)
    return {
      data: result,
    }
  }

  @Get('trending')
  async trending(@Query() query: TrendingDto) {
    const { limit, window } = query
    const list = await this.analyticsService.getTrending(
      limit,
      window ? ([window as any] as any) : undefined,
    )
    return { data: list }
  }

  @Get('suggest')
  async suggest(@Query() query: SuggestDto) {
    const { limit, prefix } = query
    const items = await this.analyticsService.getSuggest(prefix, limit)
    return { data: items }
  }
}
