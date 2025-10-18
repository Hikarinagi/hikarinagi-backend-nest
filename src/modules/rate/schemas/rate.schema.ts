import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type RateDocument = Rate & Document

@Schema({
  timestamps: true,
  versionKey: false,
})
export class Rate {
  @Prop({
    type: Number,
    required: true,
  })
  rate: number

  @Prop({
    type: String,
    default: '',
    maxlength: 200,
  })
  rateContent: string

  @Prop({
    type: String,
    enum: ['going', 'completed', 'onhold', 'dropped', 'plan'],
    default: 'going',
    required: true,
  })
  status: string

  @Prop({
    type: Number,
    default: 0,
  })
  timeToFinish: number

  @Prop({
    type: String,
    enum: ['day', 'hour', 'minute'],
    default: 'day',
  })
  timeToFinishUnit: string

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  })
  user: Types.ObjectId

  @Prop({
    type: String,
    enum: ['Galgame', 'LightNovel'],
    required: true,
  })
  from: string

  @Prop({
    type: Types.ObjectId,
    required: true,
    refPath: 'from',
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
  })
  isSpoiler: boolean

  @Prop({
    type: Boolean,
    default: false,
  })
  isDeleted: boolean
}

export const RateSchema = SchemaFactory.createForClass(Rate)
