import {
  IsEnum,
  IsNotEmpty,
  IsString,
  Length,
  IsOptional,
  ValidateBy,
  ValidationArguments,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

enum Action {
  MERGE = 'merge',
  REJECT = 'reject',
}

export class ProcessUpdateRequestDto {
  @ApiProperty({ enum: Action, description: '操作类型：合并/拒绝' })
  @IsNotEmpty()
  @IsEnum(Action)
  action: Action

  @ApiPropertyOptional({ maxLength: 100, description: '拒绝理由（当 action=reject 时必填）' })
  @IsString()
  @Length(1, 100)
  @IsOptional()
  @ValidateBy({
    name: 'rejectionReason',
    validator: {
      validate: (value, args: ValidationArguments) => {
        if (args.object['action'] === Action.REJECT) {
          return value !== undefined && value !== null && value.trim() !== ''
        }
        return true
      },
      defaultMessage: () => 'Rejection reason is required',
    },
  })
  rejectionReason?: string
}
