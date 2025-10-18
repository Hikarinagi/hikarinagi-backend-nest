import { IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator'
import { Type } from 'class-transformer'

export class GetAllRatesQueryDto {
  @IsOptional()
  @IsString()
  @IsMongoId()
  userId?: string

  @IsOptional()
  @IsEnum(['Galgame', 'LightNovel'])
  from?: string

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
