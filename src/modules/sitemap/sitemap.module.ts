import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { SitemapController } from './controllers/sitemap.controller'
import { SitemapService } from './services/sitemap.service'
import { Galgame, GalgameSchema } from '../galgame/schemas/galgame.schema'
import { LightNovel, LightNovelSchema } from '../novel/schemas/light-novel.schema'
import {
  LightNovelVolume,
  LightNovelVolumeSchema,
} from '../novel/schemas/light-novel-volume.schema'
import { Person, PersonSchema } from '../entities/schemas/person.schema'
import { Character, CharacterSchema } from '../entities/schemas/character.schema'
import { Producer, ProducerSchema } from '../entities/schemas/producer.schema'
import { Post, PostSchema } from '../content/schemas/post.schema'
import { Article, ArticleSchema } from '../content/schemas/article.schema'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Galgame.name, schema: GalgameSchema },
      { name: LightNovel.name, schema: LightNovelSchema },
      { name: LightNovelVolume.name, schema: LightNovelVolumeSchema },
      { name: Person.name, schema: PersonSchema },
      { name: Character.name, schema: CharacterSchema },
      { name: Producer.name, schema: ProducerSchema },
      { name: Post.name, schema: PostSchema },
      { name: Article.name, schema: ArticleSchema },
    ]),
  ],
  controllers: [SitemapController],
  providers: [SitemapService],
  exports: [SitemapService],
})
export class SitemapModule {}
