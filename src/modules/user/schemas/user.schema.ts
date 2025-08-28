import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'
import * as bcrypt from 'bcrypt'
import mongoose from 'mongoose'
import { v4 as uuidv4 } from 'uuid'
import { UserToObjectOptions } from '../../../types/mongoose-extensions'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { UserStatus } from '../enums/UserStatus.enum'
import { HikariUserGroup } from '../../auth/enums/hikari-user-group.enum'

export type UserDocument = User &
  Document & {
    comparePassword(password: string): Promise<boolean>
  }

@Schema({
  timestamps: true,
  toJSON: {
    transform: (_, ret, options: UserToObjectOptions) => {
      if (!options.includeEmail) {
        delete ret.email
      }
      if (options.includeStatus) {
        ret.followersCount = ret.followers.length
        ret.followingCount = ret.following.length
      }
      if (options.notInclude_id) {
        delete ret._id
      }
      delete ret.password
      delete ret.isVerified
      delete ret.createdAt
      delete ret.updatedAt
      delete ret.hikariRefreshToken
      delete ret.followers
      delete ret.following
      delete ret.__v
      delete ret.uuid
      return ret
    },
  },
})
export class User {
  @ApiProperty({ description: '用户ID（业务自增）' })
  @Prop({
    required: function () {
      return this.isVerified
    },
    unique: true,
  })
  userId: string

  @ApiProperty({ description: 'uuid' })
  @Prop({
    required: function () {
      return this.userId
    },
    unique: true,
  })
  uuid: string

  @ApiProperty({ description: '用户名' })
  @Prop({
    required: function () {
      return this.name
    },
    unique: true,
  })
  name: string

  @ApiProperty({ description: '邮箱' })
  @Prop({ required: true, unique: true })
  email: string

  @Prop({
    required: function () {
      return this.password
    },
  })
  password: string

  @ApiProperty({ description: '是否已验证' })
  @Prop({ default: false })
  isVerified: boolean

  @ApiPropertyOptional({ description: '头像' })
  @Prop()
  avatar?: string

  @ApiPropertyOptional({ description: '简介' })
  @Prop()
  bio?: string

  @ApiPropertyOptional({ description: '签名' })
  @Prop()
  signature?: string

  @ApiPropertyOptional({ description: '封面' })
  @Prop()
  headCover?: string

  @ApiProperty({ description: 'Hikari 积分' })
  @Prop({ default: 0, type: Number })
  hikariPoint: number

  @ApiProperty({ description: '连续签到天数' })
  @Prop({ type: Number, default: 0 })
  checkInStreak: number

  @ApiProperty({ description: '历史最长连续签到天数' })
  @Prop({ type: Number, default: 0 })
  longestCheckInStreak: number

  @ApiPropertyOptional({ type: String, format: 'date-time', description: '上次签到时间' })
  @Prop({ type: Date, default: null })
  lastCheckInAt: Date | null

  @ApiProperty({ description: '用户组' })
  @Prop({ required: true, default: HikariUserGroup.USER })
  hikariUserGroup: HikariUserGroup

  @ApiPropertyOptional({ description: '刷新令牌列表' })
  @Prop({ default: [] })
  hikariRefreshToken?: {
    token: string
    deviceInfo: string
    createdAt: Date
    expiresAt: Date
  }[]

  @ApiPropertyOptional({ type: [String], description: '粉丝ID列表' })
  @Prop({ default: [], ref: 'User' })
  followers?: mongoose.Types.ObjectId[]

  @ApiPropertyOptional({ type: [String], description: '关注ID列表' })
  @Prop({ default: [], ref: 'User' })
  following?: mongoose.Types.ObjectId[]

  @ApiPropertyOptional({ type: String, description: '用户设置ID' })
  @Prop({ ref: 'UserSetting' })
  setting: mongoose.Types.ObjectId

  @ApiProperty({ enum: UserStatus, default: UserStatus.ACTIVE, description: '状态' })
  @Prop({ default: UserStatus.ACTIVE, enum: UserStatus })
  status: UserStatus
}

export const UserSchema = SchemaFactory.createForClass(User)

UserSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.password)
}

UserSchema.pre('validate', function () {
  if (!this.uuid) this.uuid = uuidv4()
  if (!this.hikariPoint) this.hikariPoint = 0
})

UserSchema.pre('save', async function () {
  // 如果refresh token 过期，则删除
  if (this.hikariRefreshToken) {
    this.hikariRefreshToken = this.hikariRefreshToken.filter(token => token.expiresAt > new Date())
  }

  // 仅在密码被修改时执行哈希
  if (!this.isModified('password')) return
  const salt = await bcrypt.genSalt(10)
  this.password = await bcrypt.hash(this.password, salt)
})
