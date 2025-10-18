import {
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
} from 'class-validator'

export class CreateRateDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(10)
  rate: number

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

  @IsNotEmpty()
  @IsEnum(['Galgame', 'LightNovel'])
  from: string

  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  fromId: string

  @IsOptional()
  @IsBoolean()
  isSpoiler?: boolean
}
