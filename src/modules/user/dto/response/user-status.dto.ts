import { ApiProperty } from '@nestjs/swagger'
import { UserStatus } from '../../enums/UserStatus.enum'
import { HikariUserGroup } from '../../../auth/enums/hikari-user-group.enum'

export class UserStatusDto {
  @ApiProperty({ description: '用户积分' })
  hikariPoint: number

  @ApiProperty({ description: '是否签到' })
  isCheckIn: boolean

  @ApiProperty({ description: '连续签到天数' })
  checkInStreak: number

  @ApiProperty({ description: '最长连续签到天数' })
  longestCheckInStreak: number

  @ApiProperty({ enum: HikariUserGroup, description: '用户组' })
  hikariUserGroup: HikariUserGroup

  @ApiProperty({ enum: UserStatus, description: '用户状态' })
  status: UserStatus
}
