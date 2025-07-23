import {
  IsString,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsObject,
  IsBoolean,
  IsIn,
} from 'class-validator'
import { Type } from 'class-transformer'

enum VolumeType {
  MAIN = 'main',
  EXTRA = 'extra',
}

enum VolumePriceCurrency {
  CNY = 'CNY',
  USD = 'USD',
  JPY = 'JPY',
}

class VolumePrice {
  @IsNumber()
  @IsNotEmpty()
  price: number

  @IsEnum(VolumePriceCurrency)
  @IsNotEmpty()
  currency: VolumePriceCurrency
}

export class CreateLightNovelVolumeDto {
  @IsNumber()
  @IsOptional()
  bangumiBookId?: number

  @IsNumber()
  @IsNotEmpty()
  novelId: number

  @IsString()
  @IsNotEmpty()
  name: string

  @IsString()
  @IsOptional()
  name_cn?: string

  @IsString()
  @IsNotEmpty()
  summary: string

  @IsString()
  @IsOptional()
  summary_cn: string

  @IsString()
  @IsNotEmpty()
  cover: string

  @IsString()
  @IsOptional()
  volumeNumber?: string

  @IsEnum(VolumeType)
  @IsNotEmpty()
  volumeType: VolumeType

  @IsString()
  @IsNotEmpty()
  isbn: string

  @IsNumber()
  @IsOptional()
  pages?: number

  @IsObject()
  @IsOptional()
  @Type(() => VolumePrice)
  price?: VolumePrice

  @IsString()
  @IsNotEmpty()
  publicationDate: string

  @IsBoolean()
  @IsNotEmpty()
  nsfw: boolean

  @IsBoolean()
  @IsNotEmpty()
  locked: boolean

  @IsIn(['draft', 'published'])
  @IsOptional()
  status?: 'draft' | 'published'
}
