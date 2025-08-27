import {
  IsNotEmpty,
  IsString,
  IsArray,
  IsMongoId,
  IsEnum,
  IsObject,
  IsOptional,
} from 'class-validator'
import { Types } from 'mongoose'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export enum EntityType {
  Galgame = 'Galgame',
  LightNovel = 'LightNovel',
  LightNovelVolume = 'LightNovelVolume',
  Producer = 'Producer',
  Person = 'Person',
  Character = 'Character',
  Tag = 'Tag',
}

class UpdateRequestChanges {
  @ApiPropertyOptional({ type: Object, description: '变更前数据, 可为空' })
  @IsNotEmpty()
  @IsObject()
  @IsOptional()
  previous?: object | null

  @ApiProperty({ type: Object, description: '变更后的数据' })
  @IsNotEmpty()
  @IsObject()
  updated: object

  @ApiPropertyOptional({ type: [String], description: '变更的字段列表' })
  @IsOptional()
  @IsArray()
  changedFields?: string[]
}

export class CreateUpdateRequestDto {
  @ApiProperty({ enum: EntityType, description: '实体类型' })
  @IsNotEmpty()
  @IsEnum(EntityType)
  @IsNotEmpty()
  entityType: EntityType

  @ApiProperty({ type: String, description: '实体ID(ObjectId)' })
  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  @IsNotEmpty()
  entityId: Types.ObjectId

  @ApiProperty({ description: '标题' })
  @IsString()
  @IsNotEmpty()
  title: string

  @ApiProperty({ description: '描述' })
  @IsString()
  @IsNotEmpty()
  description: string

  @ApiProperty({ type: String, description: '提交用户ID(ObjectId)' })
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  requestedBy: Types.ObjectId

  @ApiProperty({ description: '变更详情', type: UpdateRequestChanges })
  @IsObject()
  @IsNotEmpty()
  changes: UpdateRequestChanges
}
