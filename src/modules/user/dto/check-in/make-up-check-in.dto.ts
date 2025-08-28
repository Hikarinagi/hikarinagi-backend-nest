import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString } from 'class-validator'

export class MakeUpCheckInDto {
  @ApiProperty({ description: '补签日期', example: '2025-08-28' })
  @IsNotEmpty()
  @IsString()
  date: string
}
