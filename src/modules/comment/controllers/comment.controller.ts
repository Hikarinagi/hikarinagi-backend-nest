import { Controller, Post, Param, UseGuards, Get, Query } from '@nestjs/common'
import { CommentService } from '../services/comment.service'
import { Roles } from '../../auth/decorators/roles.decorator'
import { HikariUserGroup } from '../../auth/enums/hikari-user-group.enum'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { GetCommentListQueryDto } from '../dto/get-comment-list.dto'
import { ApiExtraModels, ApiTags } from '@nestjs/swagger'
import { ApiOkResponsePaginated } from '../../../common/swagger/response.decorators'
import { Comment } from '../schemas/comment.schema'

@ApiTags('Comment')
@ApiExtraModels(Comment)
@Controller('comment')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post(':id/pin')
  @Roles(HikariUserGroup.USER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async pinComment(@Param('id') id: string) {
    const comment = await this.commentService.pinComment(id)
    return {
      data: comment,
    }
  }

  @Get('list')
  @ApiOkResponsePaginated(Comment, { description: '评论列表（分页）' })
  async getCommentList(@Query() query: GetCommentListQueryDto) {
    const result = await this.commentService.getCommentList(query)
    return { data: result }
  }
}
