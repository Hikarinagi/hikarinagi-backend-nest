import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'
import { ModerationDecision } from '../enums/decisions.enum'
import { ModerateCategoryKey } from '../enums/categories.enum'

export type ModerationEventDocument = ModerationEvent & Document

@Schema({
  versionKey: false,
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
})
export class ModerationEvent {
  @Prop({ type: Number, default: 1 })
  auditBy: number

  @Prop({ type: String, required: true, default: 'omni-moderation-latest' })
  model: string

  @Prop({
    type: String,
    enum: ModerationDecision,
    default: ModerationDecision.REVIEW,
  })
  decision: ModerationDecision

  @Prop({
    type: String,
    enum: ModerateCategoryKey,
    required: true,
  })
  topCategory: ModerateCategoryKey

  @Prop({ type: Object, required: true })
  categoriesJson: Record<string, boolean>

  @Prop({ type: Number, default: null })
  maxScore?: number

  @Prop({ type: Object, default: null })
  scoresJson?: Record<string, number>

  @Prop({ type: String, default: null })
  reason?: string

  @Prop({ type: String, default: null })
  evidence?: string

  @Prop({ type: Types.ObjectId, ref: 'Comment', required: true, index: true })
  commentId: Types.ObjectId

  @Prop({ type: Date })
  createdAt: Date

  @Prop({ type: Date })
  updatedAt: Date
}

export const ModerationEventSchema = SchemaFactory.createForClass(ModerationEvent)

ModerationEventSchema.index({ commentId: 1, createdAt: 1 })
