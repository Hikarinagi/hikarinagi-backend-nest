import { IsIn, IsNumber } from 'class-validator'
import { Type } from 'class-transformer'

export class SetContentVisibilityDto {
  @IsIn(['Article', 'Post'])
  type: 'Article' | 'Post'

  @Type(() => Number)
  @IsNumber()
  id: number
}
