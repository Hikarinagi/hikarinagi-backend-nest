import {
  IsOptional,
  IsString,
  IsArray,
  IsNumber,
  IsBoolean,
  ValidateNested,
  IsIn,
  IsObject,
  ValidateIf,
  IsDefined,
  ArrayNotEmpty,
  IsNotEmpty,
  IsUrl,
} from 'class-validator'
import { Type } from 'class-transformer'

export class ProducerLabelDto {
  @IsString()
  key: string

  @IsString()
  value: string
}

export class ProducerDto {
  @IsOptional()
  @IsString()
  _id?: string

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

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ProducerLabelDto)
  labels?: ProducerLabelDto[]
}

export class CreateGalgameProducerDto {
  @ValidateNested()
  @Type(() => ProducerDto)
  producer: ProducerDto

  @IsOptional()
  @IsString()
  note?: string
}

export class TagDto {
  @IsOptional()
  @IsString()
  _id?: string

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

export class CreateGalgameTagDto {
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
  _id?: string

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

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PersonLabelDto)
  labels?: PersonLabelDto[]

  @IsOptional()
  @IsArray()
  works?: any[]

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

export class CreateGalgameStaffDto {
  @ValidateNested()
  @Type(() => PersonDto)
  person: PersonDto

  @IsString()
  role: string
}

export class ActorDto {
  @IsOptional()
  @IsString()
  _id?: string

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

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PersonLabelDto)
  labels?: PersonLabelDto[]
}

export class ActDto {
  @IsOptional()
  @IsObject()
  person?: ActorDto

  @IsOptional()
  @IsObject()
  work?: any
}

export class CharacterLabelDto {
  @IsString()
  key: string

  @IsString()
  value: string
}

export class CharacterDto {
  @IsOptional()
  @IsString()
  _id?: string

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

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CharacterLabelDto)
  labels?: CharacterLabelDto[]

  @IsOptional()
  @IsArray()
  relations?: any[]

  @IsOptional()
  @IsString()
  status?: string

  @IsOptional()
  creator?: any

  @IsOptional()
  @IsArray()
  act?: ActDto[]

  @IsOptional()
  @IsString()
  createdAt?: string

  @IsOptional()
  @IsString()
  updatedAt?: string
}

export class CreateGalgameCharacterDto {
  @ValidateNested()
  @Type(() => CharacterDto)
  character: CharacterDto

  @IsString()
  role: string
}

export class CreateGalgamePriceDto {
  @IsString()
  @IsOptional()
  version?: string

  @IsNumber()
  @Type(() => Number)
  amount: number

  @IsString()
  currency: string
}

export class CreateGalgameDto {
  @IsOptional()
  @IsNumber()
  bangumiGameId?: number

  @IsOptional()
  @IsNumber()
  vndbId?: number

  @IsString()
  cover: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[]

  @IsOptional()
  @IsString()
  transTitle?: string

  @IsArray()
  @IsString({ each: true })
  originTitle: string[]

  @IsNotEmpty()
  @IsString()
  originIntro?: string

  @IsOptional()
  @IsString()
  transIntro?: string

  @IsString()
  @ValidateIf(o => o.releaseDateTBD !== true)
  @IsDefined()
  releaseDate?: string

  @IsOptional()
  @IsBoolean()
  releaseDateTBD?: boolean

  @IsOptional()
  @IsString()
  releaseDateTBDNote?: string

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateGalgameProducerDto)
  producers: CreateGalgameProducerDto[]

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateGalgameTagDto)
  tags: CreateGalgameTagDto[]

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGalgameStaffDto)
  staffs: CreateGalgameStaffDto[]

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateGalgameCharacterDto)
  characters: CreateGalgameCharacterDto[]

  @IsOptional()
  @IsString()
  advType?: string

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => CreateGalgamePriceDto)
  price?: CreateGalgamePriceDto[]

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  platform?: string[]

  @IsUrl()
  @IsString()
  @IsOptional()
  homepage?: string

  @IsOptional()
  @IsBoolean()
  nsfw?: boolean

  @IsOptional()
  @IsBoolean()
  locked?: boolean

  @IsOptional()
  @IsIn(['pending', 'published', 'rejected', 'deleted', 'draft'])
  status?: string
}
