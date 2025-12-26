import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Rate, RateSchema } from './schemas/rate.schema'
import { RateInteraction, RateInteractionSchema } from './schemas/rate-interaction.schema'
import { Article, ArticleSchema } from '../content/schemas/article.schema'
import { User, UserSchema } from '../user/schemas/user.schema'
import { RateService } from './services/rate.service'
import { RateController } from './controllers/rate.controller'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Rate.name, schema: RateSchema },
      { name: RateInteraction.name, schema: RateInteractionSchema },
      { name: Article.name, schema: ArticleSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [RateService],
  controllers: [RateController],
  exports: [RateService],
})
export class RateModule {}
