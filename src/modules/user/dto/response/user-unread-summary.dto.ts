import { ApiProperty } from '@nestjs/swagger'
import { SystemMessageType } from '../../../message/enums/SystemMessageType.enum'
import { SystemMessageInteractionType } from '../../../message/enums/SystemMessageInteractionType.enum'

export class UnreadMessageDto {
  @ApiProperty({ description: '消息ID' })
  id: number

  @ApiProperty({ description: '消息类型', enum: SystemMessageType })
  type: SystemMessageType

  @ApiProperty({ description: '消息交互类型', enum: SystemMessageInteractionType })
  interactionType: SystemMessageInteractionType

  @ApiProperty({ description: '消息标题' })
  title: string

  @ApiProperty({ description: '消息发送时间' })
  sentAt: Date
}

export class UserUnreadSummaryDto {
  @ApiProperty({ description: '未读消息数量' })
  unreadCount: number

  @ApiProperty({ description: '未读消息列表', type: [UnreadMessageDto] })
  unreadMessages: UnreadMessageDto[]
}
