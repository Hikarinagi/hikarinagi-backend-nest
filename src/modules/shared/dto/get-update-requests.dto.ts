import { IsNotEmpty, IsNumber, IsOptional, IsEnum, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'

enum Status {
  PENDING = 'pending',
  MERGED = 'merged',
  REJECTED = 'rejected',
  ALL = '',
}
enum EntityType {
  Galgame = 'Galgame',
  LightNovel = 'LightNovel',
  LightNovelVolume = 'LightNovelVolume',
  Producer = 'Producer',
  Person = 'Person',
  Character = 'Character',
  All = '',
}

export class GetUpdateRequestsDto {
  @ApiPropertyOptional({ enum: EntityType, description: '实体类型过滤' })
  @IsEnum(EntityType)
  @IsOptional()
  entityType?: EntityType

  @ApiPropertyOptional({ enum: Status, description: '状态过滤' })
  @IsEnum(Status)
  @IsOptional()
  status?: Status

  @ApiPropertyOptional({ minimum: 1, description: '页码，从1开始', example: 1 })
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @IsNotEmpty()
  page: number = 1

  @ApiPropertyOptional({ minimum: 10, description: '每页数量', example: 10 })
  @IsNumber()
  @Type(() => Number)
  @Min(10)
  @IsNotEmpty()
  limit: number = 10
}
