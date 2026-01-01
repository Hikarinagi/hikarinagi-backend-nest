import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export enum CommentStatus {
  APPROVED = 1,
  PENDING = 2,
  BLOCKED = 3,
}

export type CommentDocument = Comment & Document

@Schema({
  timestamps: false,
  versionKey: false,
})
export class Comment {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  })
  userId: Types.ObjectId

  @Prop({
    type: String,
    required: true,
    trim: true,
    maxlength: 2000,
  })
  content: string

  @Prop({
    type: String,
    enum: [
      'Galgame',
      'LightNovel',
      'LightNovelVolume',
      'Post',
      'Article',
      'Person',
      'Character',
      'Producer',
    ],
    required: true,
    index: true,
  })
  from: string

  @Prop({
    type: Types.ObjectId,
    required: true,
    refPath: 'from',
    index: true,
  })
  fromId: Types.ObjectId

  @Prop({
    type: Number,
    default: 0,
    min: 0,
  })
  like: number

  @Prop({
    type: Number,
    default: 0,
    min: 0,
  })
  dislike: number

  @Prop({
    type: Boolean,
    default: false,
    index: true,
  })
  isDeleted: boolean

  @Prop({
    type: Number,
    enum: CommentStatus,
    default: CommentStatus.APPROVED,
    index: true,
  })
  status: CommentStatus

  @Prop({
    type: Boolean,
    default: false,
    index: true,
  })
  isPinned: boolean

  @Prop({
    type: Types.ObjectId,
    ref: 'Comment',
    default: null,
    index: true,
  })
  parentId: Types.ObjectId

  @Prop({
    type: Types.ObjectId,
    ref: 'Comment',
    default: null,
    index: true,
  })
  replyToCommentId: Types.ObjectId

  @Prop({
    type: Date,
    default: Date.now,
  })
  createdAt: Date
}

export const CommentSchema = SchemaFactory.createForClass(Comment)
