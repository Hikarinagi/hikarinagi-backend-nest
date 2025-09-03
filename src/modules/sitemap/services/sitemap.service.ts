import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Galgame, GalgameDocument } from '../../galgame/schemas/galgame.schema'
import { LightNovel, LightNovelDocument } from '../../novel/schemas/light-novel.schema'
import {
  LightNovelVolume,
  LightNovelVolumeDocument,
} from '../../novel/schemas/light-novel-volume.schema'
import { Person, PersonDocument } from '../../entities/schemas/person.schema'
import { Character, CharacterDocument } from '../../entities/schemas/character.schema'
import { Producer, ProducerDocument } from '../../entities/schemas/producer.schema'
import { Post, PostDocument } from '../../content/schemas/post.schema'
import { Article, ArticleDocument } from '../../content/schemas/article.schema'
import { SitemapType } from '../enums/SitemapType.enum'
import { SiteItem } from '../types/SiteItem'
import { IndexItem } from '../types/IndexItem'
import { DocItem } from '../types/DocItem'
import { SitemapOptionsDto } from '../dto/SitemapOptions.dto'
import { HikariConfigService } from '../../../common/config/configs'
import { ApiExcludeController } from '@nestjs/swagger'

@Injectable()
@ApiExcludeController()
export class SitemapService {
  constructor(
    @InjectModel(Galgame.name) private readonly galgameModel: Model<GalgameDocument>,
    @InjectModel(LightNovel.name) private readonly lightNovelModel: Model<LightNovelDocument>,
    @InjectModel(LightNovelVolume.name)
    private readonly lightNovelVolumeModel: Model<LightNovelVolumeDocument>,
    @InjectModel(Person.name) private readonly personModel: Model<PersonDocument>,
    @InjectModel(Character.name) private readonly characterModel: Model<CharacterDocument>,
    @InjectModel(Producer.name) private readonly producerModel: Model<ProducerDocument>,
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    @InjectModel(Article.name) private readonly articleModel: Model<ArticleDocument>,
    private readonly configService: HikariConfigService,
  ) {}

  private getSiteBaseUrl(): string {
    return this.configService.get('siteBaseUrl')
  }

  async getLatestUrls(count: number): Promise<string[]> {
    const urls: string[] = []
    const promise: Promise<SiteItem[]>[] = []
    for (const type of Object.values(SitemapType)) {
      promise.push(this.getBaseInfos(type, { page: 1, pageSize: count }))
    }
    const items: SiteItem[][] = await Promise.all(promise)
    items.forEach(item => {
      item.forEach(i => {
        urls.push(i.url)
      })
    })
    return urls
  }

  async getBaseInfos(type: SitemapType, options: SitemapOptionsDto = {}): Promise<SiteItem[]> {
    const page = Math.max(1, options.page || 1)
    const pageSize = Math.min(Math.max(1, options.pageSize || 5000), 50000)
    const base = this.getSiteBaseUrl()
    const queryCommon = { status: 'published' }
    const skip = (page - 1) * pageSize

    const buildUrl = (t: SitemapType, item: DocItem): string => {
      if (t === SitemapType.Galgame) return `${base}/galgame/${item.galId}`
      if (t === SitemapType.LightNovel) return `${base}/lightnovel/${item.novelId}`
      if (t === SitemapType.LightNovelVolume) return `${base}/lightnovel/volumes/${item.volumeId}`
      if (t === SitemapType.Person) return `${base}/person/${item.id}`
      if (t === SitemapType.Character) return `${base}/character/${item.id}`
      if (t === SitemapType.Producer) return `${base}/producer/${item.id}`
      if (t === SitemapType.Post) return `${base}/community/post/${item.id}`
      if (t === SitemapType.Article) return `${base}/community/article/${item.slug || item.id}`
      return base
    }

    let items: SiteItem[] = []
    let docs: DocItem[] = []
    if (type === SitemapType.Galgame) {
      docs = (await this.galgameModel
        .find(queryCommon)
        .select('galId updatedAt createdAt')
        .sort({ updatedAt: -1, _id: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean()) as unknown as DocItem[]
      items = docs.map(d => ({
        url: buildUrl(SitemapType.Galgame, d),
        lastmod: d.updatedAt?.toISOString?.() || d.createdAt?.toISOString?.(),
      }))
    } else if (type === SitemapType.LightNovel) {
      docs = (await this.lightNovelModel
        .find(queryCommon)
        .select('novelId updatedAt createdAt')
        .sort({ updatedAt: -1, _id: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean()) as unknown as DocItem[]
      items = docs.map(d => ({
        url: buildUrl(SitemapType.LightNovel, d),
        lastmod: d.updatedAt?.toISOString?.() || d.createdAt?.toISOString?.(),
      }))
    } else if (type === SitemapType.LightNovelVolume) {
      docs = (await this.lightNovelVolumeModel
        .find(queryCommon)
        .select('volumeId updatedAt createdAt')
        .sort({ updatedAt: -1, _id: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean()) as unknown as DocItem[]
      items = docs.map(d => ({
        url: buildUrl(SitemapType.LightNovelVolume, d),
        lastmod: d.updatedAt?.toISOString?.() || d.createdAt?.toISOString?.(),
      }))
    } else if (type === SitemapType.Person) {
      docs = (await this.personModel
        .find(queryCommon)
        .select('id updatedAt createdAt')
        .sort({ updatedAt: -1, _id: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean()) as unknown as DocItem[]
      items = docs.map(d => ({
        url: buildUrl(SitemapType.Person, d),
        lastmod: d.updatedAt?.toISOString?.() || d.createdAt?.toISOString?.(),
      }))
    } else if (type === SitemapType.Character) {
      docs = (await this.characterModel
        .find(queryCommon)
        .select('id updatedAt createdAt')
        .sort({ updatedAt: -1, _id: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean()) as unknown as DocItem[]
      items = docs.map(d => ({
        url: buildUrl(SitemapType.Character, d),
        lastmod: d.updatedAt?.toISOString?.() || d.createdAt?.toISOString?.(),
      }))
    } else if (type === SitemapType.Producer) {
      docs = (await this.producerModel
        .find(queryCommon)
        .select('id updatedAt createdAt')
        .sort({ updatedAt: -1, _id: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean()) as unknown as DocItem[]
      items = docs.map(d => ({
        url: buildUrl(SitemapType.Producer, d),
        lastmod: d.updatedAt?.toISOString?.() || d.createdAt?.toISOString?.(),
      }))
    } else if (type === SitemapType.Post) {
      docs = (await this.postModel
        .find({ status: 'published', visible: 'public' })
        .select('id updatedAt createdAt')
        .sort({ updatedAt: -1, _id: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean()) as unknown as DocItem[]
      items = docs.map(d => ({
        url: buildUrl(SitemapType.Post, d),
        lastmod: d.updatedAt?.toISOString?.() || d.createdAt?.toISOString?.(),
      }))
    } else if (type === SitemapType.Article) {
      docs = (await this.articleModel
        .find({ status: 'published', visible: 'public' })
        .select('id slug updatedAt createdAt')
        .sort({ updatedAt: -1, _id: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean()) as unknown as DocItem[]
      items = docs.map(d => ({
        url: buildUrl(SitemapType.Article, d),
        lastmod: d.updatedAt?.toISOString?.() || d.createdAt?.toISOString?.(),
      }))
    }

    return items
  }

  async generateSitemapIndex(): Promise<string> {
    const base = this.getSiteBaseUrl()
    const pageSize = 5000

    const [
      galCount,
      novelCount,
      volumeCount,
      personCount,
      characterCount,
      producerCount,
      postCount,
      articleCount,
    ] = await Promise.all([
      this.galgameModel.countDocuments({ status: 'published' }),
      this.lightNovelModel.countDocuments({ status: 'published' }),
      this.lightNovelVolumeModel.countDocuments({ status: 'published' }),
      this.personModel.countDocuments({ status: 'published' }),
      this.characterModel.countDocuments({ status: 'published' }),
      this.producerModel.countDocuments({ status: 'published' }),
      this.postModel.countDocuments({ status: 'published', visible: 'public' }),
      this.articleModel.countDocuments({ status: 'published', visible: 'public' }),
    ])

    const sections: IndexItem[] = [
      { type: SitemapType.Galgame, count: galCount },
      { type: SitemapType.LightNovel, count: novelCount },
      { type: SitemapType.LightNovelVolume, count: volumeCount },
      { type: SitemapType.Person, count: personCount },
      { type: SitemapType.Character, count: characterCount },
      { type: SitemapType.Producer, count: producerCount },
      { type: SitemapType.Post, count: postCount },
      { type: SitemapType.Article, count: articleCount },
    ]

    const now = new Date().toISOString()

    const entries: string[] = []
    for (const s of sections) {
      const totalPages = Math.max(1, Math.ceil(s.count / pageSize))
      for (let p = 1; p <= totalPages; p++) {
        entries.push(
          `<sitemap><loc>${base}/sitemap-${s.type}-${p}.xml</loc><lastmod>${now}</lastmod></sitemap>`,
        )
      }
    }

    return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join(
      '\n',
    )}\n</sitemapindex>`
  }

  async generateSectionSitemap(
    type: SitemapType,
    options: SitemapOptionsDto = {},
  ): Promise<string> {
    const changefreq = 'weekly'
    const priority =
      type === SitemapType.Galgame ||
      type === SitemapType.LightNovel ||
      type === SitemapType.LightNovelVolume
        ? '1.0'
        : '0.8'

    const items = await this.getBaseInfos(type, options)
    const urls = items
      .map(
        i =>
          `<url><loc>${i.url}</loc>${
            i.lastmod ? `<lastmod>${i.lastmod}</lastmod>` : ''
          }<changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`,
      )
      .join('\n')

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`
  }
}
