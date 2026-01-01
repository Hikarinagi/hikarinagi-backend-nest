import { Controller, Post, Param, UseGuards, Get, Query, Body, Req } from '@nestjs/common'
import { CommentService } from '../services/comment.service'
import { Roles } from '../../auth/decorators/roles.decorator'
import { HikariUserGroup } from '../../auth/enums/hikari-user-group.enum'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { GetCommentListQueryDto } from '../dto/get-comment-list.dto'
import { ApiExtraModels, ApiTags } from '@nestjs/swagger'
import { ApiOkResponsePaginated } from '../../../common/swagger/response.decorators'
import { Comment } from '../schemas/comment.schema'
import { CreateCommentDto } from '../dto/create-comment.dto'
import { RequestWithUser } from '../../auth/interfaces/request-with-user.interface'

@ApiTags('Comment')
@ApiExtraModels(Comment)
@Controller('comment')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post()
  @Roles(HikariUserGroup.USER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async addComment(@Body() dto: CreateCommentDto, @Req() req: RequestWithUser) {
    const comment = await this.commentService.addComment(dto, req)
    return { data: comment }
  }

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
  async getCommentList(@Query() query: GetCommentListQueryDto, @Req() req: RequestWithUser) {
    const currentUserId = req.user?._id
    const result = await this.commentService.getCommentList(query, currentUserId)
    return { data: result }
  }
}
