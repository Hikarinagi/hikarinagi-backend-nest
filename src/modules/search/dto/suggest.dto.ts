import { IsNotEmpty, IsString, IsOptional, IsNumber, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'

export class SuggestDto {
  @IsString()
  @IsNotEmpty()
  prefix: string

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(50)
  limit?: number = 10
}
