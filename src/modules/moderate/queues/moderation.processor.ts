import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq'
import { Job, Queue } from 'bullmq'
import { Injectable, Logger } from '@nestjs/common'
import {
  LLM_MODERATION_JOB,
  LLM_MODERATION_MODEL,
  MODERATION_QUEUE,
  OMNI_MODERATION_JOB,
  BLOCK_THRESHOLD_SCORE,
  REVIEW_THRESHOLD_SCORE,
} from '../constants/moderation.constants'
import { OpenaiService } from '../../llms/openai/services/openai.service'
import { InjectModel } from '@nestjs/mongoose'
import { Comment, CommentDocument, CommentStatus } from '../../comment/schemas/comment.schema'
import { Model, Types } from 'mongoose'
import { ModerationEvent, ModerationEventDocument } from '../schemas/moderation-event.schema'
import { ModerationDecision } from '../enums/decisions.enum'
import { ModerateCategory, ModerateCategoryKey } from '../enums/categories.enum'
import type { Moderation } from 'openai/resources/moderations'
import { z } from 'zod'
import { zodTextFormat } from 'openai/helpers/zod'
import { SystemMessageService } from '../../message/services/system-message.service'
import { SystemMessageType as DtoSystemMessageType } from '../../message/dto/send-system-message.dto'

interface ModerationJobPayload {
  commentId: string
}

@Processor(MODERATION_QUEUE)
@Injectable()
export class ModerationProcessor extends WorkerHost {
  private readonly logger = new Logger(ModerationProcessor.name)

  constructor(
    private readonly openaiService: OpenaiService,
    @InjectModel(Comment.name) private readonly commentModel: Model<CommentDocument>,
    @InjectModel(ModerationEvent.name)
    private readonly moderationEventModel: Model<ModerationEventDocument>,
    private readonly systemMessageService: SystemMessageService,
    @InjectQueue(MODERATION_QUEUE) private readonly moderationQueue: Queue,
  ) {
    super()
  }

  async process(job: Job<ModerationJobPayload>): Promise<void> {
    if (job.name === OMNI_MODERATION_JOB) {
      await this.processOmniModeration(job.data)
      return
    }
    if (job.name === LLM_MODERATION_JOB) {
      await this.processLlmModeration(job.data)
      return
    }
    this.logger.warn(`未知审核任务类型: ${job.name}`)
  }

  private async processOmniModeration(payload: ModerationJobPayload) {
    const { commentId } = payload
    const comment = await this.commentModel.findById(commentId).lean()
    if (!comment) {
      this.logger.warn(`comment ${commentId} not found, skip`)
      return
    }

    const { results } = await this.openaiService.moderate(
      'omni-moderation-latest',
      this.htmlToPureText(comment.content),
    )
    const moderation = results[0]

    const topCategory = this.getTopCategory(moderation)
    const maxScore = this.getMaxScore(moderation)
    const shouldBlock = maxScore >= BLOCK_THRESHOLD_SCORE
    const needsLlmReview = !shouldBlock && maxScore >= REVIEW_THRESHOLD_SCORE
    const isApproved = maxScore < REVIEW_THRESHOLD_SCORE

    const decision = shouldBlock
      ? ModerationDecision.BLOCK
      : needsLlmReview
        ? ModerationDecision.REVIEW
        : ModerationDecision.ALLOW

    await this.moderationEventModel.create({
      commentId: new Types.ObjectId(commentId),
      auditBy: 1,
      model: 'omni-moderation-latest',
      decision,
      topCategory,
      categoriesJson: moderation.categories as unknown as Record<string, boolean>,
      maxScore,
      scoresJson: moderation.category_scores as unknown as Record<string, number>,
    })

    if (isApproved) {
      await this.commentModel.findByIdAndUpdate(commentId, {
        status: CommentStatus.APPROVED,
        isDeleted: false,
      })
    }

    if (shouldBlock) {
      await this.commentModel.findByIdAndUpdate(commentId, {
        status: CommentStatus.BLOCKED,
        isDeleted: true,
      })
      await this.sendBlockedSystemMessage(
        comment.userId as Types.ObjectId,
        topCategory,
        '评论因违反内容安全规则被拦截',
      )
    }

    if (needsLlmReview) {
      await this.moderationQueue.add(LLM_MODERATION_JOB, { commentId })
    }
  }

  private async processLlmModeration(payload: ModerationJobPayload) {
    const { commentId } = payload
    const comment = await this.commentModel
      .findById(commentId)
      .populate({ path: 'parentId', select: 'content' })
      .populate({ path: 'replyToCommentId', select: 'content' })
      .lean()
    if (!comment) {
      this.logger.warn(`comment ${commentId} not found, skip`)
      return
    }

    const moderationEvent = z.object({
      decision: z.enum([ModerationDecision.ALLOW, ModerationDecision.BLOCK]),
      reason: z.string().max(2550),
      evidence: z.string().max(1000),
      top_category: z.nativeEnum(ModerateCategoryKey),
      categories_json: z.object({}).catchall(z.boolean()),
    })

    const repliedComment = (comment as any).replyToCommentId || (comment as any).parentId
    const parentComment = repliedComment ? this.htmlToPureText(repliedComment.content) : null
    const context = [
      `From: ${comment.from} (${String(comment.fromId)})`,
      parentComment ? `Replying to: "${parentComment}"` : null,
      `Comment: "${this.htmlToPureText(comment.content)}"`,
    ]
      .filter(Boolean)
      .join('\n')

    const categories = Object.values(ModerateCategory)
    const input = [
      {
        role: 'system' as const,
        content: `You are a content moderation system for a game review platform. Analyze the given comment in context and return a moderation decision.
                  Context matters: Gaming slang, hyperbolic expressions (e.g., "I'm dying" meaning frustration), and game-related discussions are generally acceptable.
                  Available categories (use these exact values for top_category and as keys in categories_json):
                  ${categories.map(c => `- ${c}`).join('\n')}
                  For categories_json, set each category to true if the content violates that category, false otherwise.
                  For top_category, select the most relevant violation category (or "harassment" if none apply).
                  If the content is acceptable, set decision to "ALLOW". If it violates policies, set decision to "BLOCK".`,
      },
      {
        role: 'user' as const,
        content: context,
      },
    ]
    const { output_parsed } = await this.openaiService.parseResponse({
      model: LLM_MODERATION_MODEL,
      input,
      text: { format: zodTextFormat(moderationEvent, 'moderationEvent') },
      reasoning: { effort: 'medium' },
    })

    if (!output_parsed) {
      this.logger.warn(`moderation event for comment ${commentId} not found, skip`)
      return
    }

    const isApproved = output_parsed.decision === ModerationDecision.ALLOW

    await this.moderationEventModel.create({
      commentId: new Types.ObjectId(commentId),
      auditBy: 2,
      model: LLM_MODERATION_MODEL,
      decision: output_parsed.decision,
      reason: output_parsed.reason,
      evidence: output_parsed.evidence,
      topCategory: output_parsed.top_category,
      categoriesJson: output_parsed.categories_json,
    })

    if (isApproved) {
      await this.commentModel.findByIdAndUpdate(commentId, {
        status: CommentStatus.APPROVED,
        isDeleted: false,
      })
    } else {
      await this.commentModel.findByIdAndUpdate(commentId, {
        status: CommentStatus.BLOCKED,
        isDeleted: true,
      })
      await this.sendBlockedSystemMessage(
        comment.userId as Types.ObjectId,
        output_parsed.top_category,
        output_parsed.reason,
        output_parsed.evidence,
      )
    }
  }

  private htmlToPureText(html: string | null | undefined): string {
    if (!html) return ''
    return html
      .replace(/<\s*br\s*\/?\s*>/gi, ' ')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private getMaxScore(moderation: Moderation): number {
    return Object.values(moderation.category_scores).reduce((max, score) => Math.max(max, score), 0)
  }

  private getTopCategory(moderation: Moderation): ModerateCategoryKey {
    const scores = moderation.category_scores
    let topCategory: keyof Moderation['categories'] = 'harassment'
    let maxScore = -1

    for (const [category, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score
        topCategory = category as keyof Moderation['categories']
      }
    }

    const categoryToEnumKey: Record<keyof Moderation['categories'], ModerateCategoryKey> = {
      harassment: ModerateCategoryKey.HARASSMENT,
      'harassment/threatening': ModerateCategoryKey.HARASSMENT_THREATENING,
      sexual: ModerateCategoryKey.SEXUAL,
      hate: ModerateCategoryKey.HATE,
      'hate/threatening': ModerateCategoryKey.HATE_THREATENING,
      illicit: ModerateCategoryKey.ILLICIT,
      'illicit/violent': ModerateCategoryKey.ILLICIT_VIOLENT,
      'self-harm/intent': ModerateCategoryKey.SELF_HARM_INTENT,
      'self-harm/instructions': ModerateCategoryKey.SELF_HARM_INSTRUCTIONS,
      'self-harm': ModerateCategoryKey.SELF_HARM,
      'sexual/minors': ModerateCategoryKey.SEXUAL_MINORS,
      violence: ModerateCategoryKey.VIOLENCE,
      'violence/graphic': ModerateCategoryKey.VIOLENCE_GRAPHIC,
    }

    return categoryToEnumKey[topCategory]
  }

  private async sendBlockedSystemMessage(
    targetUser: Types.ObjectId,
    topCategory: ModerateCategoryKey,
    reason?: string,
    evidence?: string,
  ) {
    try {
      await this.systemMessageService.sendSystemMessage({
        targetUser,
        type: DtoSystemMessageType.SYSTEM,
        title: '评论审核未通过',
        content:
          reason ||
          `评论被判定存在违规内容（${topCategory}）${evidence ? `，依据：${evidence}` : ''}`,
      })
    } catch (error) {
      this.logger.error('发送系统消息失败', error)
    }
  }
}
