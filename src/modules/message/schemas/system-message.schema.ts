import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'
import { SystemMessageType } from '../enums/SystemMessageType.enum'
import { SystemMessageInteractionType } from '../enums/SystemMessageInteractionType.enum'

export type SystemMessageDocument = SystemMessage & Document

@Schema({
  timestamps: false,
  versionKey: false,
})
export class SystemMessage {
  @Prop({
    type: Number,
    required: true,
    unique: true,
  })
  id: number

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  })
  targetUser: Types.ObjectId

  @Prop({
    type: String,
    enum: SystemMessageType,
    required: true,
  })
  type: SystemMessageType

  @Prop({
    type: String,
    enum: SystemMessageInteractionType,
    default: null,
  })
  interactionType: SystemMessageInteractionType

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    default: null,
  })
  interactUser: Types.ObjectId

  @Prop({
    type: String,
    required: true,
  })
  title: string

  @Prop({
    type: String,
    required: true,
  })
  content: string

  @Prop({
    type: String,
    default: null,
  })
  link: string

  @Prop({
    type: String,
    default: null,
  })
  linkText: string

  @Prop({
    type: Date,
    default: Date.now,
  })
  sentAt: Date

  @Prop({
    type: Boolean,
    default: false,
  })
  isRead: boolean

  @Prop({
    type: Date,
    default: null,
  })
  readAt: Date
}

export const SystemMessageSchema = SchemaFactory.createForClass(SystemMessage)
