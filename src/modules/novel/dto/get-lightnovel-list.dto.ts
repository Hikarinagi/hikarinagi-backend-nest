import {
  IsOptional,
  IsNumber,
  IsArray,
  IsEnum,
  Min,
  Max,
  IsNotEmpty,
  IsMongoId,
} from 'class-validator'
import { Type } from 'class-transformer'
import { Types } from 'mongoose'
import { ToArray, ToNumberArray } from '../../../common/decorators/transform.decorators'

enum SortField {
  PUBLICATION_DATE = 'publicationDate',
  VIEWS = 'views',
  RATE = 'rate',
  RATE_COUNT = 'rateCount',
  NOVEL_ID = 'novelId',
}

enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class GetLightNovelListDto {
  @IsNotEmpty({ message: 'page is required' })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page: number

  @IsNotEmpty({ message: 'limit is required' })
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit: number

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @ToNumberArray()
  year?: number[]

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Min(1, { each: true })
  @Max(12, { each: true })
  @ToNumberArray()
  month?: number[]

  @IsOptional()
  @IsEnum(SortField)
  sortField?: SortField

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  @ToArray()
  tagsField?: Types.ObjectId[]

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  @ToArray()
  bunkoField?: Types.ObjectId[]
}
