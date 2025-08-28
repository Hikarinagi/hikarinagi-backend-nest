import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'
import { ApiProperty } from '@nestjs/swagger'

export type CheckInRecordDocument = CheckInRecord & Document

@Schema({
  timestamps: true,
  toJSON: {
    transform: (_, ret) => {
      delete ret._id
      delete ret.__v
      delete ret.userId
      delete ret.createdAt
      delete ret.updatedAt
    },
  },
})
export class CheckInRecord {
  @Prop({ required: true, ref: 'User' })
  userId: Types.ObjectId

  @ApiProperty({ description: '签到日期', type: String, format: 'date-time' })
  @Prop({ required: true, type: Date })
  date: Date

  @ApiProperty({ description: '是否为补签' })
  @Prop({ type: Boolean, default: false })
  isMakeUp: boolean

  @ApiProperty({ description: '本次签到获得积分' })
  @Prop({ type: Number, default: 0 })
  points: number

  @ApiProperty({ description: '签到后连续天数' })
  @Prop({ type: Number, default: 0 })
  streakAfter: number
}

export const CheckInRecordSchema = SchemaFactory.createForClass(CheckInRecord)
CheckInRecordSchema.index({ userId: 1, date: 1 }, { unique: true })
CheckInRecordSchema.index({ userId: 1, date: 1, isMakeUp: 1 })
