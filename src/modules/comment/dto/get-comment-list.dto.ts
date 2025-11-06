import { IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator'
import { Type } from 'class-transformer'

export class GetCommentListQueryDto {
  @IsString()
  @IsEnum([
    'Galgame',
    'LightNovel',
    'LightNovelVolume',
    'Post',
    'Article',
    'Person',
    'Character',
    'Producer',
  ])
  from: string

  @IsString()
  @IsMongoId()
  fromId: string

  @IsOptional()
  @IsString()
  @IsMongoId()
  userId?: string

  @IsOptional()
  @IsString()
  @IsEnum(['hot', 'time'])
  sort?: 'hot' | 'time'

  @IsOptional()
  @IsString()
  @IsMongoId()
  parentId?: string

  @IsNumber()
  @Type(() => Number)
  @Min(1)
  page: number

  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit: number
}
