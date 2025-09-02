import { Type } from 'class-transformer'
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  IsArray,
  IsBoolean,
  IsEnum,
  IsMongoId,
  ValidateNested,
  IsNumber,
  IsObject,
  ValidateIf,
} from 'class-validator'
import { Types } from 'mongoose'
import { DownloadInfo } from '../../../galgame/schemas/galgame.schema'

enum GalgameStatus {
  PENDING = 'pending',
  PUBLISHED = 'published',
  REJECTED = 'rejected',
  DELETED = 'deleted',
  DRAFT = 'draft',
}

class ProducerDto {
  @IsString()
  @IsMongoId()
  @IsNotEmpty()
  _id: Types.ObjectId

  @IsString()
  @IsNotEmpty()
  name: string

  @IsString()
  @IsOptional()
  note?: string

  @IsString()
  @IsOptional()
  logo?: string
}

class StaffDto {
  @IsString()
  @IsMongoId()
  @IsNotEmpty()
  _id: Types.ObjectId

  @IsString()
  @IsNotEmpty()
  name: string

  @IsString()
  @IsNotEmpty()
  role: string

  @IsString()
  @IsOptional()
  image?: string
}

class WorkActDto {
  @IsString()
  @IsNotEmpty()
  @IsMongoId()
  workId: string

  @IsString()
  @IsNotEmpty()
  workType: string
}

class ActDto {
  @IsOptional()
  person?: any

  @ValidateNested()
  @Type(() => WorkActDto)
  @IsOptional()
  work?: WorkActDto
}

class CharacterDto {
  @IsString()
  @IsMongoId()
  @IsNotEmpty()
  _id: Types.ObjectId

  @IsString()
  @IsNotEmpty()
  name: string

  @IsString()
  @IsNotEmpty()
  role: string

  @IsString()
  @IsOptional()
  image?: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActDto)
  @IsOptional()
  act?: ActDto[]
}

class TagDto {
  @IsString()
  @IsMongoId()
  _id: Types.ObjectId

  @IsString()
  @IsNotEmpty()
  name: string

  @IsNumber()
  @IsOptional()
  likes?: number
}

class CreatorDto {
  @IsString()
  @IsMongoId()
  @IsNotEmpty()
  _id: Types.ObjectId

  @IsString()
  avatar?: string

  @IsString()
  @IsNotEmpty()
  name: string

  @IsString()
  @IsNotEmpty()
  userId: string
}

class PriceDto {
  @IsString()
  @IsOptional()
  version?: string

  @IsNumber()
  @Type(() => Number)
  @IsNotEmpty()
  amount: number

  @IsString()
  @IsNotEmpty()
  currency: string
}

export class UpdateGalgameDto {
  @IsString()
  @IsNotEmpty()
  galId: string

  @IsNumber()
  @IsOptional()
  vndbId?: number

  @IsNumber()
  @IsOptional()
  bangumiGameId?: number

  @IsString()
  @IsUrl()
  @IsNotEmpty()
  cover: string

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  images: string[]

  @IsNumber()
  @IsNotEmpty()
  headCover: number = 0

  @IsString()
  @IsOptional()
  transTitle?: string

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  originTitle: string[]

  @IsString()
  @IsNotEmpty()
  originIntro: string

  @IsString()
  @IsOptional()
  transIntro?: string

  @IsBoolean()
  @IsNotEmpty()
  releaseDateTBD: boolean

  @IsString()
  @IsNotEmpty()
  releaseDate: string

  @IsString()
  @IsOptional()
  releaseDateTBDNote?: string

  @IsBoolean()
  @IsNotEmpty()
  nsfw: boolean

  @IsBoolean()
  @IsNotEmpty()
  locked: boolean

  @IsEnum(GalgameStatus)
  @IsNotEmpty()
  status: GalgameStatus

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProducerDto)
  @IsNotEmpty()
  producers: ProducerDto[]

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StaffDto)
  @IsNotEmpty()
  staffs: StaffDto[]

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CharacterDto)
  @IsNotEmpty()
  characters: CharacterDto[]

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TagDto)
  @IsNotEmpty()
  tags: TagDto[]

  @IsString()
  @IsOptional()
  advType?: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceDto)
  @IsOptional()
  price?: PriceDto[]

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  platform?: string[]

  @ValidateIf(o => o.homepage !== '' && o.homepage !== undefined && o.homepage !== null)
  @IsUrl()
  @IsOptional()
  homepage?: string

  @IsObject()
  @IsOptional()
  creator?: CreatorDto

  @IsString()
  @IsOptional()
  updatedAt?: string

  @IsString()
  @IsOptional()
  createdAt?: string

  @IsObject()
  @IsOptional()
  downloadInfo?: DownloadInfo
}
