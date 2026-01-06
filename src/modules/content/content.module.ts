import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Article, ArticleSchema } from './schemas/article.schema'
import { Post, PostSchema } from './schemas/post.schema'
import { ContentVisibilityController } from './controllers/content-visibility.controller'
import { ContentVisibilityService } from './services/content-visibility.service'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Article.name, schema: ArticleSchema },
      { name: Post.name, schema: PostSchema },
    ]),
  ],
  controllers: [ContentVisibilityController],
  providers: [ContentVisibilityService],
})
export class ContentModule {}
