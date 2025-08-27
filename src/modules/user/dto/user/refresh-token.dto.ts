import { IsNotEmpty, IsString } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class RefreshTokenDto {
  @ApiProperty({ description: '刷新令牌' })
  @IsNotEmpty({ message: 'refreshToken不能为空' })
  @IsString({ message: 'refreshToken必须是字符串' })
  refreshToken: string
}
