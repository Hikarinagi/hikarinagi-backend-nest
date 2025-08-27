import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'
import { EntityType } from '../dto/create-update-request.dto'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export type UpdateRequestDocument = UpdateRequest & Document

@Schema({ _id: false })
export class UpdateRequestChanges {
  @ApiProperty({ type: Object })
  @Prop({
    type: Object,
    required: true,
  })
  previous: object

  @ApiProperty({ type: Object })
  @Prop({
    type: Object,
    required: true,
  })
  updated: object

  @ApiPropertyOptional({ type: [String] })
  @Prop({
    type: [String],
    required: false,
    default: [],
  })
  changedFields: string[]
}

@Schema({
  timestamps: true,
  versionKey: false,
})
export class UpdateRequest {
  @ApiProperty({
    enum: ['Galgame', 'LightNovel', 'LightNovelVolume', 'Producer', 'Person', 'Character'],
  })
  @Prop({
    type: String,
    enum: ['Galgame', 'LightNovel', 'LightNovelVolume', 'Producer', 'Person', 'Character'],
    required: true,
  })
  entityType: EntityType

  @ApiProperty({ type: String, description: '实体ID(ObjectId)' })
  @Prop({
    type: Types.ObjectId,
    required: true,
    refPath: 'entityType',
  })
  entityId: Types.ObjectId

  @ApiProperty({ maxLength: 100 })
  @Prop({
    type: String,
    required: true,
    maxlength: 100,
  })
  title: string

  @ApiProperty({ maxLength: 2000 })
  @Prop({
    type: String,
    required: true,
    maxlength: 2000,
  })
  description: string

  @ApiProperty({ enum: ['pending', 'merged', 'rejected'], default: 'pending' })
  @Prop({
    type: String,
    enum: ['pending', 'merged', 'rejected'],
    default: 'pending',
  })
  status: string

  @ApiProperty({ type: String, description: '提交者ID(ObjectId)' })
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  })
  requestedBy: Types.ObjectId

  @ApiPropertyOptional({ type: String, description: '处理者ID(ObjectId)' })
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    default: null,
  })
  processedBy: Types.ObjectId

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @Prop({
    type: Date,
    default: null,
  })
  processedAt: Date

  @ApiPropertyOptional({ type: String })
  @Prop({
    type: String,
    default: null,
  })
  rejectionReason: string

  @ApiProperty({ type: UpdateRequestChanges })
  @Prop({ type: UpdateRequestChanges })
  changes: UpdateRequestChanges
}

export const UpdateRequestSchema = SchemaFactory.createForClass(UpdateRequest)

// 创建索引
UpdateRequestSchema.index({ entityType: 1, entityId: 1 })
UpdateRequestSchema.index({ status: 1 })
UpdateRequestSchema.index({ requestedBy: 1 })
UpdateRequestSchema.index({ createdAt: -1 })
