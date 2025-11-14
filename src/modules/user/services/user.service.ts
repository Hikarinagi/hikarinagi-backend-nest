import {
  Injectable,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  Inject,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import * as mongoose from 'mongoose'
import { JwtService } from '@nestjs/jwt'
import { User, UserDocument } from '../schemas/user.schema'
import { UserSetting, UserSettingDocument } from '../schemas/user-setting.schema'
import {
  VerificationForSignupDto,
  CreateUserDto,
  LoginUserDto,
  RefreshTokenDto,
  ResetPasswordDto,
} from '../dto/user'
import { HikariConfigService } from '../../../common/config/configs'
import { VerificationService } from '../../email/services/verification.service'
import { CounterService } from '../../shared/services/counter.service'
import { RequestWithUser } from '../../auth/interfaces/request-with-user.interface'
import { UpdateUserEmailDto } from '../dto/user/update-user-email.dto'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Cache } from 'cache-manager'
import { UserStatusDto } from '../dto/response/user-status.dto'
import { SystemMessage, SystemMessageDocument } from '../../message/schemas/system-message.schema'
import { SystemMessageType } from '../../message/dto/send-system-message.dto'
import { UserCheckInService } from './check-in/user-check-in.service'
import { UserUnreadSummaryDto } from '../dto/response/user-unread-summary.dto'
import { PaginatedResult } from '../../../common/interfaces/paginated-result.interface'

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(UserSetting.name) private userSettingModel: Model<UserSettingDocument>,
    @InjectModel(SystemMessage.name) private systemMessageModel: Model<SystemMessageDocument>,
    private jwtService: JwtService,
    private configService: HikariConfigService,
    private verificationService: VerificationService,
    private counterService: CounterService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private userCheckInService: UserCheckInService,
  ) {}
  async sendVerificationEmailForSignUp(verificationForSignupDto: VerificationForSignupDto) {
    if (!this.configService.get('allowRegister')) {
      throw new ForbiddenException('注册已关闭')
    }

    const existingName = await this.userModel.findOne({
      name: verificationForSignupDto.name,
      isVerified: true,
    })
    if (existingName) {
      throw new ConflictException('用户名已被使用')
    }
    const existingEmail = await this.userModel.findOne({
      email: verificationForSignupDto.email,
      isVerified: true,
    })
    if (existingEmail) {
      throw new ConflictException('邮箱已被注册')
    }
    const exsitedUnVerifiedUser = await this.userModel.findOne({
      email: verificationForSignupDto.email,
      isVerified: false,
    })
    if (!exsitedUnVerifiedUser) {
      await this.userModel.create({
        email: verificationForSignupDto.email,
        isVerified: false,
      })
    }

    const result = await this.verificationService.requestVerificationCode(
      verificationForSignupDto.email,
      'register',
    )
    return {
      uuid: result.uuid,
      email: verificationForSignupDto.email,
      type: 'register',
    }
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<void> {
    const { email, uuid, verificationCode, newPassword } = resetPasswordDto

    const user = await this.userModel.findOne({ email, isVerified: true })
    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    const { verified, message } = await this.verificationService.verifyCode({
      email,
      code: verificationCode,
      uuid,
    })

    if (!verified) {
      throw new ForbiddenException(message || '验证码无效或已过期')
    }

    user.password = newPassword
    user.hikariRefreshToken = []
    await user.save()

    const content = `你的密码已重置<br><br>重置时间: ${new Date().toLocaleString()}<br>如非本人操作，请立即联系管理员`

    const id = await this.counterService.getNextSequence('systemMessageId')

    await this.systemMessageModel.create({
      id,
      targetUser: user._id,
      type: SystemMessageType.NOTIFICATION,
      title: '密码已重置',
      content,
    })
  }

  async create(createUserDto: CreateUserDto): Promise<UserDocument> {
    if (!this.configService.get('allowRegister')) {
      throw new ForbiddenException('注册已关闭')
    }

    const existingName = await this.userModel.findOne({
      name: createUserDto.name,
      isVerified: true,
    })
    if (existingName) {
      throw new ConflictException('用户名已被使用')
    }
    const existingEmail = await this.userModel.findOne({
      email: createUserDto.email,
      isVerified: true,
    })
    if (existingEmail) {
      throw new ConflictException('邮箱已被注册')
    }

    const result = await this.verificationService.verifyCode({
      email: createUserDto.email,
      code: createUserDto.code,
      uuid: createUserDto.uuid,
    })
    if (!result.verified) {
      throw new ForbiddenException(result.message)
    }

    const existingUnVerifiedUser = await this.userModel.findOne({
      email: createUserDto.email,
      isVerified: false,
    })
    if (!existingUnVerifiedUser) {
      const userId = (await this.counterService.getNextSequence('userId')).toString()
      const createdUser = new this.userModel({
        ...createUserDto,
        // uuid交给pre validate生成
        uuid: '',
        userId,
        isVerified: true,
      })
      const savedUser = await createdUser.save()
      const userSetting = new this.userSettingModel({
        user: savedUser._id,
      })
      const savedUserSetting = await userSetting.save()
      savedUser.setting = savedUserSetting._id as mongoose.Types.ObjectId
      return savedUser.toJSON({ includeEmail: true, includeStatus: false, notInclude_id: true })
    } else {
      existingUnVerifiedUser.password = createUserDto.password
      existingUnVerifiedUser.name = createUserDto.name
      existingUnVerifiedUser.userId = (
        await this.counterService.getNextSequence('userId')
      ).toString()
      existingUnVerifiedUser.isVerified = true
      await existingUnVerifiedUser.save()
      return existingUnVerifiedUser.toJSON({
        includeEmail: true,
        includeStatus: false,
        notInclude_id: true,
      })
    }
  }

  async login(
    loginUserDto: LoginUserDto,
    userAgent?: string,
  ): Promise<{
    hikariAccessToken: string
    hikariRefreshToken: string
    user: { name: string; userId: string }
  }> {
    const { identifier, password } = loginUserDto

    const user = await this.userModel.findOne({
      $or: [{ name: identifier }, { email: identifier }],
      isVerified: true,
    })

    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    const userSetting = await this.userSettingModel.findOne({ user: user._id })

    const isPasswordValid = await user.comparePassword(password)
    if (!isPasswordValid) {
      throw new UnauthorizedException('密码错误')
    }

    const hikari_access_token_payload = {
      _id: user._id,
      userId: user.userId,
      name: user.name,
      email: user.email,
      hikariUserGroup: user.hikariUserGroup,
      hikariPoint: user.hikariPoint,
      userSetting,
    }
    const hikari_access_token = this.jwtService.sign(hikari_access_token_payload, {
      expiresIn: this.configService.get('jwt.hikariAccessTokenExpiresIn'),
      secret: this.configService.get('jwt.secret'),
    })

    const hikari_refresh_token_payload = {
      userId: user.userId,
    }
    const hikari_refresh_token = this.jwtService.sign(hikari_refresh_token_payload, {
      expiresIn: this.configService.get('jwt.hikariRefreshTokenExpiresIn'),
      secret: this.configService.get('jwt.refreshSecret'),
    })

    // 保存 refresh token
    user.hikariRefreshToken.push({
      token: hikari_refresh_token,
      deviceInfo: userAgent || 'Unknown',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })
    await user.save()

    return {
      hikariAccessToken: hikari_access_token,
      hikariRefreshToken: hikari_refresh_token,
      user: {
        name: user.name,
        userId: user.userId,
      },
    }
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<{
    hikariAccessToken: string
  }> {
    let decoded = null
    try {
      decoded = this.jwtService.verify(refreshTokenDto.refreshToken, {
        secret: this.configService.get('jwt.refreshSecret'),
      })
    } catch {
      throw new UnauthorizedException('无效的 refreshToken')
    }
    const user = await this.userModel.findOne({ userId: decoded.userId })
    if (!user) {
      throw new UnauthorizedException('用户不存在')
    }

    const tokenIndex = user.hikariRefreshToken.findIndex(
      token => token.token === refreshTokenDto.refreshToken,
    )
    if (tokenIndex === -1) {
      throw new UnauthorizedException('无效的 refreshToken')
    }
    const userSetting = await this.userSettingModel.findOne({ user: user._id })

    const hikariAccessTokenPayload = {
      _id: user._id,
      userId: user.userId,
      name: user.name,
      email: user.email,
      hikariUserGroup: user.hikariUserGroup,
      hikariPoint: user.hikariPoint,
      userSetting,
    }
    const hikariAccessToken = this.jwtService.sign(hikariAccessTokenPayload, {
      expiresIn: this.configService.get('jwt.hikariAccessTokenExpiresIn'),
      secret: this.configService.get('jwt.secret'),
    })

    return {
      hikariAccessToken,
    }
  }

  async logout(hikariRefreshToken: string, userId: string): Promise<void> {
    const user = await this.userModel.findOne({ userId })
    if (!user) {
      throw new UnauthorizedException('用户不存在')
    }

    const tokenIndex = user.hikariRefreshToken.findIndex(
      token => token.token === hikariRefreshToken,
    )
    if (tokenIndex === -1) {
      throw new UnauthorizedException('无效的 refreshToken')
    }

    user.hikariRefreshToken.splice(tokenIndex, 1)
    await user.save()
  }

  async getProfile(userId: string): Promise<UserDocument & { userSetting: UserSettingDocument }> {
    const user = await this.userModel.findById(userId)
    if (!user) {
      throw new NotFoundException('User not found')
    }

    let userSetting = await this.userSettingModel.findOne({ user: user._id })
    if (!userSetting) {
      const createdUserSetting = await this.userSettingModel.create({ user: user._id })
      user.setting = createdUserSetting._id as mongoose.Types.ObjectId
      await user.save()
      userSetting = createdUserSetting
    }

    return {
      ...user.toJSON({
        includeEmail: true,
        includeStatus: true,
        notInclude_id: false,
      }),
      userSetting: userSetting.toJSON({ notInclude_id: true }),
    } as unknown as UserDocument & { userSetting: UserSettingDocument }
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id)
    if (!user) {
      throw new NotFoundException('用户不存在')
    }
    return user
  }

  async findByUsername(username: string): Promise<UserDocument> {
    const user = await this.userModel.findOne({ name: username })
    if (!user) {
      throw new NotFoundException('用户不存在')
    }
    return user.toJSON({ includeEmail: true, includeStatus: true, notInclude_id: true })
  }

  async findByEmail(email: string): Promise<UserDocument> {
    const user = await this.userModel.findOne({ email })
    if (!user) {
      throw new NotFoundException('用户不存在')
    }
    return user
  }

  async requestUpdateEmail(req: RequestWithUser): Promise<{
    uuid: string
  }> {
    const { uuid } = await this.verificationService.requestVerificationCode(
      req.user.email,
      'request-email-change',
      req,
    )
    return {
      uuid,
    }
  }

  async updateEmail(req: RequestWithUser, updateUserEmailDto: UpdateUserEmailDto): Promise<void> {
    const result = await this.verificationService.verifyCode({
      email: updateUserEmailDto.email,
      code: updateUserEmailDto.code,
      uuid: updateUserEmailDto.uuid,
    })
    if (!result.verified) {
      throw new ForbiddenException(result.message)
    }

    const key = `isChangingEmail:${req.user._id}`
    const isChangingEmail = await this.cacheManager.get(key)
    if (!isChangingEmail) {
      throw new ForbiddenException('现有邮箱验证已过期或未验证')
    }

    const existingEmail = await this.userModel.findOne({
      email: updateUserEmailDto.email,
    })
    if (existingEmail) {
      throw new ConflictException('邮箱已被使用')
    }

    const user = await this.userModel.findOne({ userId: req.user.userId })
    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    await this.cacheManager.del(key)
    user.email = updateUserEmailDto.email
    await user.save()
  }

  async getUserStatus(req: RequestWithUser): Promise<UserStatusDto> {
    const user = await this.userModel.findById(req.user._id)
    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    const isCheckIn = await this.userCheckInService.checkIsCheckIn(user._id as Types.ObjectId)
    const statusInfo: UserStatusDto = {
      hikariPoint: user.hikariPoint,
      isCheckIn,
      checkInStreak: user.checkInStreak,
      longestCheckInStreak: user.longestCheckInStreak,
      hikariUserGroup: user.hikariUserGroup,
      status: user.status,
    }
    return statusInfo
  }

  async getUnreadMessageSummary(req: RequestWithUser): Promise<UserUnreadSummaryDto> {
    const user = await this.userModel.findById(req.user._id)
    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    const unreadCount = await this.systemMessageModel.countDocuments({
      targetUser: user._id,
      isRead: false,
    })
    const unreadMessages = await this.systemMessageModel
      .find({
        targetUser: user._id,
        isRead: false,
      })
      .select('id type interactionType title sentAt -_id')

    return {
      unreadCount,
      unreadMessages,
    }
  }

  async deleteUnverifiedUser(): Promise<number> {
    const count = await this.userModel.countDocuments({ isVerified: false, name: null })
    await this.userModel.deleteMany({ isVerified: false, name: null })
    return count
  }

  async getFollowingList(
    userId: string,
    page = 1,
    limit = 10,
  ): Promise<PaginatedResult<UserDocument>> {
    const user = await this.userModel.findOne({ userId })
    if (!user) {
      throw new NotFoundException('user not found')
    }

    const skip = (page - 1) * limit
    const totalItems = user.following.length
    const followingIds = user.following.slice(skip, skip + limit)

    const items = await this.userModel
      .find({ _id: { $in: followingIds } })
      .select('userId name avatar bio signature -_id')
      .exec()

    const totalPages = Math.ceil(totalItems / limit)

    return {
      items,
      meta: {
        totalItems,
        itemCount: items.length,
        itemsPerPage: limit,
        totalPages,
        currentPage: page,
      },
    }
  }

  async getFollowerList(
    userId: string,
    page = 1,
    limit = 10,
  ): Promise<PaginatedResult<UserDocument>> {
    const user = await this.userModel.findOne({ userId })
    if (!user) {
      throw new NotFoundException('user not found')
    }

    const skip = (page - 1) * limit
    const totalItems = user.followers.length
    const followerIds = user.followers.slice(skip, skip + limit)
    const items = await this.userModel
      .find({ _id: { $in: followerIds } })
      .select('userId name avatar bio signature -_id')
      .exec()

    const totalPages = Math.ceil(totalItems / limit)

    return {
      items,
      meta: {
        totalItems,
        itemCount: items.length,
        itemsPerPage: limit,
        totalPages,
        currentPage: page,
      },
    }
  }
}
