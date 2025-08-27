import { IsNotEmpty, IsMongoId, IsEnum, IsObject, ValidateNested } from 'class-validator'
import { Types } from 'mongoose'
import { EntityType } from './create-update-request.dto'
import { Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'

export class MergeUpdateRequestDto {
  @ApiProperty({ enum: EntityType, description: '条目类型' })
  @IsNotEmpty()
  @IsEnum(EntityType)
  itemType: EntityType

  @ApiProperty({ type: String, description: '条目ID(ObjectId)' })
  @IsNotEmpty()
  @IsMongoId()
  itemId: Types.ObjectId

  @ApiProperty({ type: Object, description: '需要合并的变更数据' })
  @IsObject()
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => Object)
  mergeData: Record<string, any>

  @ApiProperty({ type: String, description: '处理人ID(ObjectId)' })
  @IsNotEmpty()
  @IsMongoId()
  processedBy: Types.ObjectId

  @ApiProperty({ type: String, description: '提交人ID(ObjectId)' })
  @IsNotEmpty()
  @IsMongoId()
  requestedBy: Types.ObjectId
}
