import { IsNotEmpty, IsString } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class LoginUserDto {
  @ApiProperty({ description: '用户名或邮箱' })
  @IsNotEmpty({ message: '用户名/邮箱不能为空' })
  @IsString({ message: '用户名/邮箱必须是字符串' })
  identifier: string

  @ApiProperty({ description: '密码' })
  @IsNotEmpty({ message: '密码不能为空' })
  @IsString({ message: '密码必须是字符串' })
  password: string
}
