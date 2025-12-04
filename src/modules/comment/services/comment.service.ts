import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { Comment, CommentDocument } from '../schemas/comment.schema'
import {
  CommentInteraction,
  CommentInteractionDocument,
} from '../schemas/comment-interaction.schema'
import { GetCommentListQueryDto } from '../dto/get-comment-list.dto'

@Injectable()
export class CommentService {
  constructor(
    @InjectModel(Comment.name) private commentModel: Model<CommentDocument>,
    @InjectModel(CommentInteraction.name)
    private interactionModel: Model<CommentInteractionDocument>,
  ) {}

  async pinComment(id: string): Promise<Comment> {
    const comment = await this.commentModel.findById(id)

    if (!comment) {
      throw new NotFoundException('评论不存在')
    }

    if (comment.parentId || comment.replyToCommentId) {
      throw new BadRequestException('不能置顶回复')
    }

    comment.isPinned = !comment.isPinned
    await comment.save()
    return comment
  }

  async getCommentList(query: GetCommentListQueryDto) {
    const { from, fromId, page, limit, userId, sort = 'hot', parentId } = query

    const skip = (page - 1) * limit

    const filter: any = {
      from,
      fromId: new Types.ObjectId(String(fromId)),
      isDeleted: false,
      parentId: parentId ? new Types.ObjectId(String(parentId)) : null,
    }

    const sortOption =
      sort === 'hot'
        ? ({ isPinned: -1, like: -1, createdAt: -1 } as const)
        : ({ isPinned: -1, createdAt: -1 } as const)

    const comments = await this.commentModel
      .find(filter)
      .select('-__v')
      .populate({ path: 'userId', select: 'userId name avatar' })
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit))
      .lean()

    let formattedComments: any[] = comments.map(comment => {
      const formatted = {
        ...comment,
        userInfo: {
          userId: (comment.userId as any)?.userId,
          name: (comment.userId as any)?.name,
          avatar: (comment.userId as any)?.avatar,
        },
        replies: [] as any[],
      }
      delete (formatted as any).userId
      return formatted
    })

    if (parentId) {
      const replyToIds = comments.filter(c => c.replyToCommentId).map(c => c.replyToCommentId)

      const repliedComments = replyToIds.length
        ? await this.commentModel
            .find({ _id: { $in: replyToIds }, isDeleted: false })
            .populate({ path: 'userId', select: 'userId name avatar' })
            .lean()
        : []

      const repliedUserInfoMap = new Map<string, any>()
      repliedComments.forEach(rc => {
        repliedUserInfoMap.set(String(rc._id), {
          userId: (rc.userId as any)?.userId,
          name: (rc.userId as any)?.name,
          avatar: (rc.userId as any)?.avatar,
        })
      })

      const parentComment = await this.commentModel
        .findById(new Types.ObjectId(String(parentId)))
        .populate({ path: 'userId', select: 'userId name avatar' })
        .lean()

      const parentUserInfo = parentComment
        ? {
            userId: (parentComment.userId as any)?.userId,
            name: (parentComment.userId as any)?.name,
            avatar: (parentComment.userId as any)?.avatar,
          }
        : null

      formattedComments = formattedComments.map(comment => {
        if (comment.replyToCommentId) {
          const replyToIdStr = String(comment.replyToCommentId)
          const repliedUserInfo = repliedUserInfoMap.get(replyToIdStr)
          if (repliedUserInfo) {
            comment.repliedUserInfo = repliedUserInfo
          } else if (replyToIdStr === String(parentId) && parentUserInfo) {
            comment.repliedUserInfo = parentUserInfo
          }
        } else if (parentUserInfo) {
          comment.repliedUserInfo = parentUserInfo
        }
        return comment
      })
    }

    if (!parentId) {
      const parentIds = comments.map(c => c._id)

      const childComments = parentIds.length
        ? await this.commentModel
            .find({
              from,
              fromId: new Types.ObjectId(String(fromId)),
              parentId: { $in: parentIds },
              isDeleted: false,
            })
            .select('-__v')
            .populate({ path: 'userId', select: 'userId name avatar' })
            .sort(sortOption)
            .lean()
        : []

      const commentUserInfoMap = new Map<string, any>()
      formattedComments.forEach(pc => {
        commentUserInfoMap.set(String(pc._id), pc.userInfo)
      })
      childComments.forEach(cc => {
        commentUserInfoMap.set(String(cc._id), {
          userId: (cc.userId as any)?.userId,
          name: (cc.userId as any)?.name,
          avatar: (cc.userId as any)?.avatar,
        })
      })

      const childMap = new Map<string, any[]>()
      childComments.forEach(child => {
        const pid = String(child.parentId)
        if (!childMap.has(pid)) childMap.set(pid, [])
        childMap.get(pid)!.push(child)
      })

      formattedComments = formattedComments.map(comment => {
        const cid = String(comment._id)
        const children = childMap.get(cid) || []

        const formattedChildren = children.slice(0, 3).map(child => {
          const fc: any = {
            ...child,
            userInfo: {
              userId: (child.userId as any)?.userId,
              name: (child.userId as any)?.name,
              avatar: (child.userId as any)?.avatar,
            },
          }
          if (child.replyToCommentId) {
            const replyToIdStr = String(child.replyToCommentId)
            const repliedUserInfo = commentUserInfoMap.get(replyToIdStr)
            if (repliedUserInfo) fc.repliedUserInfo = repliedUserInfo
          } else {
            fc.repliedUserInfo = comment.userInfo
          }
          delete fc.userId
          return fc
        })

        return {
          ...comment,
          replies: formattedChildren,
          replyCount: children.length,
        }
      })
    }

    if (userId) {
      const allIds: Types.ObjectId[] = []
      formattedComments.forEach(c => {
        allIds.push(new Types.ObjectId(String(c._id)))
        if (c.replies && c.replies.length > 0) {
          c.replies.forEach(r => allIds.push(new Types.ObjectId(String(r._id))))
        }
      })

      const interactions = allIds.length
        ? await this.interactionModel
            .find({ userId: new Types.ObjectId(String(userId)), commentId: { $in: allIds } })
            .lean()
        : []

      const interactionMap = new Map<string, string>()
      interactions.forEach(i => interactionMap.set(String(i.commentId), i.type))

      formattedComments = formattedComments.map(c => {
        const updated: any = { ...c, userInteraction: interactionMap.get(String(c._id)) || null }
        if (updated.replies && updated.replies.length > 0) {
          updated.replies = updated.replies.map((r: any) => ({
            ...r,
            userInteraction: interactionMap.get(String(r._id)) || null,
          }))
        }
        return updated
      })
    }

    const total = await this.commentModel.countDocuments({
      from,
      fromId: new Types.ObjectId(String(fromId)),
      isDeleted: false,
      parentId: parentId ? new Types.ObjectId(String(parentId)) : null,
    })

    return {
      items: formattedComments,
      meta: {
        totalItems: total,
        itemCount: formattedComments.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    }
  }
}
