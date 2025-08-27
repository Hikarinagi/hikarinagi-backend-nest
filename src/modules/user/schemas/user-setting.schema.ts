import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import mongoose from 'mongoose'
import { Document } from 'mongoose'
import { UserSettingToObjectOptions } from '../../../types/mongoose-extensions'
import { ApiProperty } from '@nestjs/swagger'

export type UserSettingDocument = UserSetting & Document

@Schema({
  timestamps: true,
  toJSON: {
    transform: (_, ret, options: UserSettingToObjectOptions) => {
      if (options.notInclude_id) {
        delete ret._id
      }
      delete ret.__v
      delete ret.user
      delete ret.createdAt
      delete ret.updatedAt
      return ret
    },
  },
})
export class UserSetting {
  @ApiProperty({ description: '用户ID' })
  @Prop({ required: true, ref: 'User' })
  user: mongoose.Types.ObjectId

  @ApiProperty({ description: '是否显示 NSFW 内容', default: false })
  @Prop({ default: false })
  showNSFWContent: boolean
}

export const UserSettingSchema = SchemaFactory.createForClass(UserSetting)
