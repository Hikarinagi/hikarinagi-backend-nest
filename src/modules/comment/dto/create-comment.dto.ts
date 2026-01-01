import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsMongoId, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'

const FROM_VALUES = [
  'Galgame',
  'LightNovel',
  'LightNovelVolume',
  'Post',
  'Article',
  'Person',
  'Character',
  'Producer',
] as const

export class CreateCommentDto {
  @ApiProperty({ description: '评论内容', maxLength: 2000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string

  @ApiProperty({ enum: FROM_VALUES, description: '来源类型' })
  @IsIn(FROM_VALUES as unknown as string[])
  from: (typeof FROM_VALUES)[number]

  @ApiProperty({ description: '来源ID' })
  @IsMongoId()
  fromId: string

  @ApiPropertyOptional({ description: '父评论ID' })
  @IsOptional()
  @IsMongoId()
  parentId?: string

  @ApiPropertyOptional({ description: '回复的评论ID' })
  @IsOptional()
  @IsMongoId()
  replyToCommentId?: string
}
