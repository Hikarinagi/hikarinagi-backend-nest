import { IsNumber, IsOptional, IsPositive } from 'class-validator'

export class SitemapOptionsDto {
  @IsNumber()
  @IsOptional()
  @IsPositive()
  page?: number

  @IsNumber()
  @IsOptional()
  @IsPositive()
  pageSize?: number
}
