import { Module } from '@nestjs/common'
import { GalgameService } from './services/galgame.service'
import { GalgameController } from './controllers/galgame.controller'
import { Galgame, GalgameSchema } from './schemas/galgame.schema'
import { MongooseModule } from '@nestjs/mongoose'
import { GalgameLinks, GalgameLinksSchema } from './schemas/galgame-links.schema'
import { Article, ArticleSchema } from '../content/schemas/article.schema'
import { Post, PostSchema } from '../content/schemas/post.schema'
import { EditHistoryService } from '../../common/services/edit-history.service'
import { GalgameHistory, GalgameHistorySchema } from './schemas/galgame-history.schema'
import {
  LightNovelHistory,
  LightNovelHistorySchema,
} from '../novel/schemas/light-novel-history.schema'
import {
  LightNovelVolumeHistory,
  LightNovelVolumeHistorySchema,
} from '../novel/schemas/light-novel-volume-history.schema'
import {
  SharedEntityHistory,
  SharedEntityHistorySchema,
} from '../entities/schemas/shared-entity-history.schema'
import { Producer, ProducerSchema } from '../entities/schemas/producer.schema'
import { Person, PersonSchema } from '../entities/schemas/person.schema'
import { Character, CharacterSchema } from '../entities/schemas/character.schema'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Galgame.name, schema: GalgameSchema }]),
    MongooseModule.forFeature([{ name: GalgameLinks.name, schema: GalgameLinksSchema }]),
    MongooseModule.forFeature([{ name: Article.name, schema: ArticleSchema }]),
    MongooseModule.forFeature([{ name: Post.name, schema: PostSchema }]),
    MongooseModule.forFeature([{ name: GalgameHistory.name, schema: GalgameHistorySchema }]),
    MongooseModule.forFeature([{ name: LightNovelHistory.name, schema: LightNovelHistorySchema }]),
    MongooseModule.forFeature([
      { name: LightNovelVolumeHistory.name, schema: LightNovelVolumeHistorySchema },
    ]),
    MongooseModule.forFeature([
      { name: SharedEntityHistory.name, schema: SharedEntityHistorySchema },
    ]),
    MongooseModule.forFeature([{ name: Producer.name, schema: ProducerSchema }]),
    MongooseModule.forFeature([{ name: Person.name, schema: PersonSchema }]),
    MongooseModule.forFeature([{ name: Character.name, schema: CharacterSchema }]),
  ],
  controllers: [GalgameController],
  providers: [GalgameService, EditHistoryService],
})
export class GalgameModule {}
