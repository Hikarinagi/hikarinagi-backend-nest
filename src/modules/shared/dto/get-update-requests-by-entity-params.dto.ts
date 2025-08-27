import { IsMongoId, IsNotEmpty, IsString } from 'class-validator'
import { Types } from 'mongoose'
import { ApiProperty } from '@nestjs/swagger'

export enum EntityType {
  GALGAME = 'Galgame',
  LIGHT_NOVEL = 'LightNovel',
  LIGHT_NOVEL_VOLUME = 'LightNovelVolume',
  CHARACTER = 'Character',
  PERSON = 'Person',
  PRODUCER = 'Producer',
}

export class GetUpdateRequestsByEntityParamsDto {
  @ApiProperty({ enum: EntityType, description: '实体类型' })
  @IsString()
  @IsNotEmpty()
  entityType: EntityType

  @ApiProperty({ type: String, description: '实体ID(ObjectId)' })
  @IsNotEmpty()
  @IsMongoId()
  entityId: Types.ObjectId
}
