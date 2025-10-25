import { IsMongoId, IsNumber, IsOptional, Min, Max } from 'class-validator'
import { Transform, Type } from 'class-transformer'

export class GetReviewsQueryDto {
  @IsMongoId()
  @Transform(({ value }) => (value === '' ? undefined : value))
  fromId: string

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
