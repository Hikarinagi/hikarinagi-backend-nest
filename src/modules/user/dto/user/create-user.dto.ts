import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  Matches,
  IsUUID,
  MaxLength,
} from 'class-validator'

export class CreateUserDto {
  @IsNotEmpty({ message: '验证码不能为空' })
  @IsString({ message: '验证码必须是字符串' })
  code: string

  @IsNotEmpty({ message: 'uuid不能为空' })
  @IsUUID(4, { message: '需要提供有效的uuid' })
  uuid: string

  @IsNotEmpty({ message: '用户名不能为空' })
  @IsString({ message: '用户名必须是字符串' })
  @MinLength(3, { message: '用户名长度不能少于3个字符' })
  @MaxLength(20, { message: '用户名长度不能超过20个字符' })
  name: string

  @IsNotEmpty({ message: '邮箱不能为空' })
  @IsEmail({}, { message: '请提供有效的邮箱地址' })
  email: string

  @IsNotEmpty({ message: '密码不能为空' })
  @IsString({ message: '密码必须是字符串' })
  @MinLength(8, { message: '密码长度不能少于8个字符' })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: '密码必须包含至少一个大写字母、一个小写字母和一个数字或特殊字符',
  })
  password: string
}
