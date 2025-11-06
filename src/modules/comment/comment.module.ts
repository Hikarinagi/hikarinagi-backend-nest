import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Comment, CommentSchema } from './schemas/comment.schema'
import { CommentInteraction, CommentInteractionSchema } from './schemas/comment-interaction.schema'
import { CommentController } from './controllers/comment.controller'
import { CommentService } from './services/comment.service'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Comment.name, schema: CommentSchema },
      { name: CommentInteraction.name, schema: CommentInteractionSchema },
    ]),
  ],
  controllers: [CommentController],
  providers: [CommentService],
})
export class CommentModule {}
