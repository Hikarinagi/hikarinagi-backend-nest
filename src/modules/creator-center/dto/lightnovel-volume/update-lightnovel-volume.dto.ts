import { Transform, Type } from 'class-transformer'
import { Types } from 'mongoose'
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  ValidateNested,
  IsObject,
  IsEnum,
  IsNumber,
  IsMongoId,
} from 'class-validator'

enum VolumeType {
  MAIN = 'main',
  EXTRA = 'extra',
  SHORT_STORY = 'short_story',
}

enum Status {
  PUBLISHED = 'published',
  DRAFT = 'draft',
  DELETED = 'deleted',
}

class PriceDto {
  @IsNumber()
  @IsNotEmpty()
  amount: number

  @IsString()
  @IsNotEmpty()
  currency: string
}

class CreatorDto {
  @IsMongoId()
  @IsOptional()
  _id?: Types.ObjectId

  @IsString()
  @IsOptional()
  avatar?: string

  @IsString()
  @IsNotEmpty()
  name: string

  @IsString()
  @IsNotEmpty()
  userId: string
}

export class UpdateLightNovelVolumeDto {
  @IsEnum(VolumeType)
  @IsOptional()
  volumeType?: VolumeType

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @IsOptional()
  volumeNumber?: number

  @IsNumber()
  @IsOptional()
  bangumiBookId?: number

  @IsNumber()
  @IsOptional()
  novelId?: number

  @IsNumber()
  @IsOptional()
  volumeId?: number

  @IsMongoId()
  @IsOptional()
  seriesId?: Types.ObjectId

  @IsString()
  @IsOptional()
  volumeExtraName?: string

  @IsString()
  @IsOptional()
  name?: string

  @IsString()
  @IsOptional()
  name_cn?: string

  @IsString()
  @IsOptional()
  cover?: string

  @IsString()
  @IsOptional()
  isbn?: string

  @IsObject()
  @ValidateNested()
  @Type(() => PriceDto)
  @IsOptional()
  price?: PriceDto

  @IsString()
  @IsOptional()
  publicationDate?: string

  @IsNumber()
  @IsOptional()
  pages?: number

  @IsString()
  @IsOptional()
  summary?: string

  @IsString()
  @IsOptional()
  relation?: string

  @IsString()
  @IsOptional()
  summary_cn?: string

  @IsEnum(Status)
  @IsOptional()
  status?: Status

  @IsBoolean()
  @IsOptional()
  hasEpub?: boolean

  @IsString()
  @IsOptional()
  updatedAt?: string

  @IsString()
  @IsOptional()
  createdAt?: string

  @IsObject()
  @ValidateNested()
  @Type(() => CreatorDto)
  @IsOptional()
  creator?: CreatorDto
}
