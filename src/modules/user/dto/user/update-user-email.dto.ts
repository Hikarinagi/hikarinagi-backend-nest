import { IsString, IsEmail, IsUUID, IsNotEmpty } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class UpdateUserEmailDto {
  @ApiProperty({ description: '新邮箱' })
  @IsEmail()
  @IsNotEmpty()
  email: string

  @ApiProperty({ description: '邮箱验证码' })
  @IsString()
  @IsNotEmpty()
  code: string

  @ApiProperty({ description: '验证码会话uuid' })
  @IsUUID()
  @IsNotEmpty()
  uuid: string
}
