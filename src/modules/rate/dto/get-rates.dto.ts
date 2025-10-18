import { IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator'
import { Type } from 'class-transformer'

export class GetRatesQueryDto {
  @IsOptional()
  @IsEnum(['Galgame', 'LightNovel'])
  from?: string

  @IsOptional()
  @IsString()
  @IsMongoId()
  fromId?: string

  @IsOptional()
  @IsString()
  @IsMongoId()
  userId?: string

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  page?: number

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number
}
