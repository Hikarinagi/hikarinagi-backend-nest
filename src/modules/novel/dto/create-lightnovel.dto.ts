import {
  IsString,
  IsNumber,
  IsMongoId,
  ValidateNested,
  IsArray,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsObject,
  ArrayNotEmpty,
} from 'class-validator'
import { Type } from 'class-transformer'
import { Types } from 'mongoose'

export class ProducerLabelDto {
  @IsString()
  key: string

  @IsString()
  value: string
}

export class ProducerDto {
  @IsOptional()
  @IsMongoId()
  _id?: Types.ObjectId

  @IsOptional()
  @IsNumber()
  id?: number

  @IsString()
  name: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[]

  @IsOptional()
  @IsString()
  intro?: string

  @IsOptional()
  @IsString()
  transIntro?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  type?: string[]

  @IsOptional()
  @IsString()
  country?: string

  @IsOptional()
  @IsString()
  established?: string

  @IsOptional()
  @IsString()
  logo?: string

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProducerLabelDto)
  labels?: ProducerLabelDto[]
}

export class CreateLightNovelPublisherDto {
  @ValidateNested()
  @Type(() => ProducerDto)
  publisher: ProducerDto

  @IsString()
  @IsOptional()
  note?: string
}

export class TagDto {
  @IsOptional()
  @IsString()
  _id?: Types.ObjectId

  @IsOptional()
  @IsNumber()
  id?: number

  @IsString()
  name: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[]

  @IsOptional()
  @IsString()
  description?: string
}

export class CreateLightNovelTagDto {
  @ValidateNested()
  @Type(() => TagDto)
  tag: TagDto

  @IsOptional()
  @IsNumber()
  likes?: number
}

export class PersonLabelDto {
  @IsString()
  key: string

  @IsString()
  value: string
}

export class PersonDto {
  @IsOptional()
  @IsString()
  _id?: Types.ObjectId

  @IsOptional()
  @IsNumber()
  id?: number

  @IsString()
  name: string

  @IsOptional()
  @IsString()
  transName?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[]

  @IsOptional()
  @IsString()
  intro?: string

  @IsOptional()
  @IsString()
  transIntro?: string

  @IsOptional()
  @IsString()
  image?: string

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PersonLabelDto)
  labels?: PersonLabelDto[]

  @IsOptional()
  @IsString()
  status?: string

  @IsOptional()
  creator?: any

  @IsOptional()
  @IsString()
  createdAt?: string

  @IsOptional()
  @IsString()
  updatedAt?: string
}

export class CreateLightNovelIllustratorDto {
  @ValidateNested()
  @IsOptional()
  @Type(() => PersonDto)
  illustrator?: PersonDto

  @IsString()
  @IsOptional()
  note?: string
}

export class CharacterLabelDto {
  @IsString()
  key: string

  @IsString()
  value: string
}

export class CharacterDto {
  @IsOptional()
  @IsMongoId()
  _id?: Types.ObjectId

  @IsOptional()
  @IsNumber()
  id?: number

  @IsString()
  name: string

  @IsOptional()
  @IsString()
  transName?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[]

  @IsOptional()
  @IsString()
  intro?: string

  @IsOptional()
  @IsString()
  transIntro?: string

  @IsOptional()
  @IsString()
  image?: string

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CharacterLabelDto)
  labels?: CharacterLabelDto[]

  @IsOptional()
  @IsString()
  status?: string

  @IsOptional()
  creator?: any

  @IsOptional()
  @IsString()
  createdAt?: string

  @IsOptional()
  @IsString()
  updatedAt?: string
}

export class CreateLightNovelCharacterDto {
  @ValidateNested()
  @IsOptional()
  @Type(() => CharacterDto)
  character?: CharacterDto

  @IsString()
  @IsOptional()
  role?: string
}

enum NovelStatus {
  SERIALIZING = 'SERIALIZING',
  FINISHED = 'FINISHED',
  PAUSED = 'PAUSED',
  ABANDONED = 'ABANDONED',
}

export class CreateLightNovelDto {
  @IsNumber()
  @IsOptional()
  bangumiBookId?: number

  @IsString()
  name: string

  @IsString()
  @IsOptional()
  name_cn?: string

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  otherNames?: string[]

  @IsString()
  cover: string

  @IsString()
  @IsEnum(NovelStatus)
  novelStatus: NovelStatus

  @IsBoolean()
  nsfw: boolean

  @IsString()
  summary: string

  @IsString()
  @IsOptional()
  summary_cn?: string

  @IsObject()
  @Type(() => PersonDto)
  author: PersonDto

  @IsObject()
  @Type(() => ProducerDto)
  bunko: ProducerDto

  @IsArray()
  @ArrayNotEmpty()
  @Type(() => CreateLightNovelPublisherDto)
  publishers: CreateLightNovelPublisherDto[]

  @IsArray()
  @IsOptional()
  @Type(() => CreateLightNovelIllustratorDto)
  illustrators?: CreateLightNovelIllustratorDto[]

  @IsArray()
  @ArrayNotEmpty()
  @Type(() => CreateLightNovelTagDto)
  tags: CreateLightNovelTagDto[]

  @IsArray()
  @Type(() => CreateLightNovelCharacterDto)
  @IsOptional()
  characters?: CreateLightNovelCharacterDto[]

  @IsBoolean()
  @IsOptional()
  locked?: boolean
}
