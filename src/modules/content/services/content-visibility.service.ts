import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Article, ArticleDocument } from '../schemas/article.schema'
import { Post, PostDocument } from '../schemas/post.schema'
import { SetContentVisibilityDto } from '../dto/set-content-visibility.dto'

@Injectable()
export class ContentVisibilityService {
  constructor(
    @InjectModel(Article.name) private readonly articleModel: Model<ArticleDocument>,
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
  ) {}

  async setPrivate(dto: SetContentVisibilityDto) {
    if (dto.type === 'Article') {
      const updated = await this.articleModel
        .findOneAndUpdate({ id: dto.id }, { visible: 'private' }, { new: true })
        .lean()

      if (!updated) {
        throw new NotFoundException('Article not found')
      }

      return updated
    }

    const updated = await this.postModel
      .findOneAndUpdate({ id: dto.id }, { visible: 'private' }, { new: true })
      .lean()

    if (!updated) {
      throw new NotFoundException('Post not found')
    }

    return updated
  }
}
