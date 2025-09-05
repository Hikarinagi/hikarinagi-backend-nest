import { IsOptional, IsNumber, Min, Max, IsIn } from 'class-validator'
import { Type } from 'class-transformer'
import { TREND_WINDOWS } from '../constants/analytics'

export class TrendingDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(50)
  limit?: number = 10

  @IsOptional()
  @IsIn(TREND_WINDOWS as unknown as string[])
  window?: (typeof TREND_WINDOWS)[number]
}
