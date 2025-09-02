import { Controller, Get, Header, Inject, Param, ParseIntPipe, Res } from '@nestjs/common'
import { SitemapService } from '../services/sitemap.service'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Cache } from 'cache-manager'
import { Response } from 'express'
import { SitemapType } from '../enums/SitemapType.enum'

@Controller()
export class SitemapController {
  constructor(
    private readonly sitemapService: SitemapService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  async getSitemapIndex(@Res() res: Response): Promise<void> {
    const cacheKey = 'sitemap:index'
    const cached = await this.cacheManager.get<string>(cacheKey)
    if (cached) {
      res.type('application/xml; charset=utf-8').send(cached)
      return
    }

    const xml = await this.sitemapService.generateSitemapIndex()
    await this.cacheManager.set(cacheKey, xml, 60 * 60 * 1000)
    res.type('application/xml; charset=utf-8').send(xml)
    return
  }

  @Get('sitemap-:type-:page.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  async getSectionSitemap(
    @Param('type') type: SitemapType,
    @Param('page', ParseIntPipe) page: number,
    @Res() res: Response,
  ): Promise<void> {
    if (
      ![
        SitemapType.Galgame,
        SitemapType.LightNovel,
        SitemapType.LightNovelVolume,
        SitemapType.Person,
        SitemapType.Character,
        SitemapType.Producer,
        SitemapType.Post,
        SitemapType.Article,
      ].includes(type)
    ) {
      res
        .type('application/xml; charset=utf-8')
        .send(
          '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
        )
      return
    }

    const cacheKey = `sitemap:${type}:${page}`
    const cached = await this.cacheManager.get<string>(cacheKey)
    if (cached) {
      res.type('application/xml; charset=utf-8').send(cached)
      return
    }

    const xml = await this.sitemapService.generateSectionSitemap(type, { page })
    await this.cacheManager.set(cacheKey, xml, 60 * 60 * 1000)
    res.type('application/xml; charset=utf-8').send(xml)
    return
  }
}
