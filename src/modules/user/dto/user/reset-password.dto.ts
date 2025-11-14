import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsString, MinLength, IsUUID } from 'class-validator'

export class ResetPasswordDto {
  @ApiProperty({ description: '邮箱' })
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email: string

  @ApiProperty({ description: '验证码 UUID' })
  @IsUUID(4, { message: '需要提供有效的UUID' })
  uuid: string

  @ApiProperty({ description: '邮箱验证码', example: '123456' })
  @IsString({ message: '验证码不能为空' })
  verificationCode: string

  @ApiProperty({ description: '新密码' })
  @IsString({ message: '密码不能为空' })
  @MinLength(6, { message: '密码长度不能少于6位' })
  newPassword: string
}
