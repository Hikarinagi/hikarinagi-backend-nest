import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'

export enum EntityType {
  Person = 'Person',
  Producer = 'Producer',
  Character = 'Character',
  Tag = 'Tag',
}

export class GetEntityListDto {
  @IsString()
  @IsOptional()
  keyword?: string

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 50
}
