import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
  IsBoolean,
  IsMongoId,
} from 'class-validator'

export class UpdateRateDto {
  @IsOptional()
  @IsEnum(['Galgame', 'LightNovel'])
  from?: string

  @IsOptional()
  @IsString()
  @IsMongoId()
  fromId?: string

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  rate?: number

  @IsOptional()
  @IsString()
  @MaxLength(200)
  rateContent?: string

  @IsOptional()
  @IsEnum(['going', 'completed', 'onhold', 'dropped', 'plan'])
  status?: string

  @IsOptional()
  @IsNumber()
  timeToFinish?: number

  @IsOptional()
  @IsEnum(['day', 'hour', 'minute'])
  timeToFinishUnit?: string

  @IsOptional()
  @IsBoolean()
  isSpoiler?: boolean
}
