import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { CheckInRecord, CheckInRecordDocument } from '../../schemas/check-in/check-in-record.schema'
import { HikariPointService } from '../hikari-point.service'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Cache } from 'cache-manager'
import { UserCheckInDto } from '../../dto/check-in/user-check-in.dto'
import { HikariPointRecordReason } from '../../types/hikari-point/HikariPointRecordReason'
import { User, UserDocument } from '../../schemas/user.schema'
import { MakeUpCheckInDto } from '../../dto/check-in/make-up-check-in.dto'

@Injectable()
export class UserCheckInService {
  private readonly MAX_MAKE_UP_CHECK_IN_TIMES = 3
  private readonly MAKE_UP_CHECK_IN_COST_STEP = 30

  constructor(
    @InjectModel(CheckInRecord.name)
    private checkInRecordModel: Model<CheckInRecordDocument>,
    private hikariPointService: HikariPointService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) {}

  async checkIn(dto: UserCheckInDto) {
    const { userId, isMakeUp } = dto

    const user = await this.userModel.findById(userId)
    if (!user) {
      throw new NotFoundException('User not found')
    }

    const isCheckIn = await this.checkIsCheckIn(userId)
    if (isCheckIn) {
      throw new BadRequestException('You have already checked in today')
    }

    const points = this.hikariPointService.generateRandomPoints(10, 1)

    await this.updateUserCheckInStreak(userId)

    const checkInRecord = new this.checkInRecordModel({
      userId,
      date: this.getDayStart(),
      points,
      isMakeUp,
      streakAfter: user.checkInStreak,
    })
    await checkInRecord.save()

    await this.hikariPointService.add({
      userId,
      amount: points,
      reason: HikariPointRecordReason.CHECK_IN_ADD,
    })

    const key = this.getCheckInKey(userId)
    const ttlRemaining = this.getTtlRemaining()
    await this.cacheManager.set(key, true, ttlRemaining)

    return {
      points,
    }
  }

  async checkIsCheckIn(userId: Types.ObjectId) {
    const key = this.getCheckInKey(userId)
    const cached = await this.cacheManager.get<boolean>(key)
    if (cached) return true

    const today = this.getDayStart()
    const exists = await this.checkInRecordModel.exists({ userId, date: today })
    if (exists) {
      await this.cacheManager.set(key, true, this.getTtlRemaining())
      return true
    }

    return false
  }

  async getCheckInStreak(userId: Types.ObjectId) {
    const user = await this.userModel.findById(userId)
    if (!user) {
      throw new NotFoundException('User not found')
    }

    return user.checkInStreak || 0
  }

  async getCheckInRecord(userId: Types.ObjectId) {
    const { monthStart, monthEnd } = this.getMonthStartAndEnd()

    const records = await this.checkInRecordModel.find({
      userId,
      date: { $gte: monthStart, $lte: monthEnd },
    })

    return records
  }

  async makeUpCheckIn(userId: Types.ObjectId, dto: MakeUpCheckInDto) {
    const { date } = dto
    const targetDayStart = this.getDayStart(new Date(date))

    const now = new Date()
    if (targetDayStart.getTime() > now.getTime()) {
      throw new BadRequestException('You can only make up check-ins from the previous day')
    }

    const user = await this.userModel.findById(userId)
    if (!user) {
      throw new NotFoundException('User not found')
    }

    const exists = await this.checkInRecordModel.exists({
      userId,
      date: targetDayStart,
    })

    if (exists) {
      throw new BadRequestException('You have already checked in today')
    }

    const { monthStart, monthEnd } = this.getMonthStartAndEnd()

    const existsMakeUpCheckInTimes = await this.checkInRecordModel.countDocuments({
      userId,
      date: { $gte: monthStart, $lte: monthEnd },
      isMakeUp: true,
    })

    if (existsMakeUpCheckInTimes >= this.MAX_MAKE_UP_CHECK_IN_TIMES) {
      throw new BadRequestException(
        `You have already made up ${this.MAX_MAKE_UP_CHECK_IN_TIMES} times this month`,
      )
    }
    const makeUpCost = this.MAKE_UP_CHECK_IN_COST_STEP * (existsMakeUpCheckInTimes + 1)

    if (user.hikariPoint < makeUpCost) {
      throw new BadRequestException('You do not have enough points')
    }

    const checkInRecord = new this.checkInRecordModel({
      userId,
      date: targetDayStart,
      points: 0,
      isMakeUp: true,
    })
    await checkInRecord.save()

    await this.reCalculateCheckInStreak(userId)

    await this.hikariPointService.subtract({
      userId,
      amount: makeUpCost,
      reason: HikariPointRecordReason.CHECK_IN_MAKE_UP_SUBTRACT,
    })

    return {
      points: makeUpCost,
    }
  }

  private async reCalculateCheckInStreak(userId: Types.ObjectId) {
    const user = await this.userModel.findById(userId)
    if (!user) {
      throw new NotFoundException('User not found')
    }

    const records = await this.checkInRecordModel.find({ userId }).sort({ date: 1 })

    let streak = records.length ? 1 : 0
    let pre: Date
    let now: Date
    for (const record of records) {
      if (!pre) {
        pre = record.date
        continue
      }
      now = record.date
      if (pre.getTime() + 24 * 60 * 60 * 1000 === now.getTime()) {
        streak++
      } else {
        streak = 0
      }
      pre = now
    }

    user.checkInStreak = streak
    if (streak > (user.longestCheckInStreak || 0)) {
      user.longestCheckInStreak = streak
    }
    await user.save()
  }

  private async updateUserCheckInStreak(userId: Types.ObjectId) {
    const user = await this.userModel.findById(userId)
    if (!user) {
      throw new NotFoundException('User not found')
    }

    const now = new Date()
    const isYesterdayCheckIn =
      user.lastCheckInAt &&
      new Date(user.lastCheckInAt).toDateString() ===
        new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toDateString()

    const newStreak = isYesterdayCheckIn ? (user.checkInStreak || 0) + 1 : 1
    const longestStreak = Math.max(user.longestCheckInStreak, newStreak)

    user.checkInStreak = newStreak
    user.longestCheckInStreak = longestStreak
    user.lastCheckInAt = now
    await user.save()
  }

  private getFormattedDate(date: Date) {
    return date.toISOString().split('T')[0] // yyyy-mm-dd
  }

  private getDayStart(date = new Date()) {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d
  }

  private getMonthStartAndEnd() {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return { monthStart, monthEnd }
  }

  private getTtlRemaining() {
    const now = new Date()
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    return Math.floor(tomorrow.getTime() - now.getTime())
  }

  private getCheckInKey(userId: Types.ObjectId) {
    const today = this.getFormattedDate(new Date())
    return `check_in:${userId.toString()}:${today}`
  }
}
