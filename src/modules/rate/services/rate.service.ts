import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { Rate, RateDocument } from '../schemas/rate.schema'
import { RequestWithUser } from '../../auth/interfaces/request-with-user.interface'
import { HikariUserGroup } from '../../auth/enums/hikari-user-group.enum'
import { CreateRateDto } from '../dto/create-rate.dto'
import { UpdateRateDto } from '../dto/update-rate.dto'
import { GetRatesQueryDto } from '../dto/get-rates.dto'
import { RateInteraction, RateInteractionDocument } from '../schemas/rate-interaction.schema'
import { GetAllRatesQueryDto } from '../dto/get-all-rates.dto'
import { Article, ArticleDocument } from '../../content/schemas/article.schema'
import { GetReviewsQueryDto } from '../dto/get-reviews.dto'
import { User, UserDocument } from '../../user/schemas/user.schema'
import { UserStatus } from '../../user/enums/UserStatus.enum'

@Injectable()
export class RateService {
  constructor(
    @InjectModel(Rate.name) private readonly rateModel: Model<RateDocument>,
    @InjectModel(RateInteraction.name)
    private readonly rateInteractionModel: Model<RateInteractionDocument>,
    @InjectModel(Article.name) private readonly articleModel: Model<ArticleDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async createRate(body: CreateRateDto, req: RequestWithUser): Promise<Rate> {
    if (body.rate < 1 || body.rate > 10) {
      throw new BadRequestException('the rate must be between 1 and 10')
    }

    const user = await this.userModel.findById(req.user._id).select('status')
    if (!user) {
      throw new NotFoundException('user not found')
    }
    if (user.status === UserStatus.BANNED) {
      throw new ForbiddenException('you are banned from creating rates')
    }

    const existingRate = await this.rateModel.findOne({
      user: new Types.ObjectId(String(req.user._id)),
      from: body.from,
      fromId: new Types.ObjectId(String(body.fromId)),
      isDeleted: false,
    })

    if (existingRate) {
      throw new ConflictException('you have already rated this item')
    }

    const created = await this.rateModel.create({
      rate: body.rate,
      rateContent: body.rateContent ?? '',
      status: body.status ?? 'going',
      timeToFinish: body.timeToFinish ?? 0,
      timeToFinishUnit: body.timeToFinishUnit ?? 'day',
      user: new Types.ObjectId(String(req.user._id)),
      from: body.from,
      fromId: new Types.ObjectId(String(body.fromId)),
      isSpoiler: body.isSpoiler ?? false,
    })
    return created
  }

  async updateRate(id: string, body: UpdateRateDto, req: RequestWithUser): Promise<any> {
    const rateDoc = await this.rateModel.findOne({
      _id: new Types.ObjectId(String(id)),
      isDeleted: false,
    })

    if (!rateDoc) {
      throw new NotFoundException('rate not found')
    }

    const isAuthor = rateDoc.user.toString() === String(req.user._id)
    const isAdmin =
      req.user.hikariUserGroup === HikariUserGroup.ADMIN ||
      req.user.hikariUserGroup === HikariUserGroup.SUPER_ADMIN

    if (!isAuthor && !isAdmin) {
      throw new ForbiddenException('you are not allowed to update this rate')
    }

    if (isAuthor) {
      if (body.rate !== undefined && (body.rate < 1 || body.rate > 10)) {
        throw new BadRequestException('the rate must be between 1 and 10')
      }
      if (body.rate !== undefined) rateDoc.rate = body.rate
      if (body.rateContent !== undefined) rateDoc.rateContent = body.rateContent
      if (body.status !== undefined) rateDoc.status = body.status
      if (body.timeToFinish !== undefined) rateDoc.timeToFinish = body.timeToFinish
      if (body.timeToFinishUnit !== undefined) rateDoc.timeToFinishUnit = body.timeToFinishUnit
      if (body.isSpoiler !== undefined) rateDoc.isSpoiler = body.isSpoiler
    } else if (isAdmin) {
      if (body.isSpoiler !== undefined) rateDoc.isSpoiler = body.isSpoiler
    }

    await rateDoc.save()

    return rateDoc.toObject()
  }

  async getRates(query: GetRatesQueryDto) {
    const page = Number(query.page || 1)
    const limit = Number(query.limit || 10)
    if (page < 1 || limit < 1 || limit > 100) {
      throw new BadRequestException('invalid pagination parameters')
    }

    if (!query.from && !query.fromId) {
      throw new BadRequestException('missing required parameters')
    }

    const filter: any = { isDeleted: false }
    if (query.from) filter.from = query.from
    if (query.fromId) filter.fromId = new Types.ObjectId(String(query.fromId))

    const [rates, total] = await Promise.all([
      this.rateModel
        .find(filter)
        .select('-__v')
        .populate('user', 'name userId avatar')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.rateModel.countDocuments(filter),
    ])

    const totalPages = Math.ceil(total / limit)

    let ratesWithInteraction = rates
    let myRateInfo: any = {
      isRated: false,
      rate: 0,
      rateContent: '',
      isSpoiler: false,
    }

    const [avgRateAgg, scoreDistributionAgg] = await Promise.all([
      this.rateModel.aggregate([
        { $match: filter },
        { $group: { _id: null, avg: { $avg: '$rate' } } },
      ]),
      this.rateModel.aggregate([
        { $match: filter },
        { $group: { _id: '$rate', count: { $sum: 1 } } },
      ]),
    ])
    const avgRate =
      avgRateAgg && avgRateAgg.length > 0 && avgRateAgg[0].avg !== undefined
        ? Number(avgRateAgg[0].avg.toFixed(1))
        : 0

    const scoreBuckets = [
      { min: 9, max: 10, count: 0 },
      { min: 7, max: 8, count: 0 },
      { min: 5, max: 6, count: 0 },
      { min: 3, max: 4, count: 0 },
      { min: 1, max: 2, count: 0 },
    ]
    scoreDistributionAgg.forEach(entry => {
      const rateVal = Number(entry._id)
      if (Number.isNaN(rateVal)) return
      const target = scoreBuckets.find(bucket => rateVal >= bucket.min && rateVal <= bucket.max)
      if (target) {
        target.count += entry.count ?? 0
      }
    })
    const scoreDistribution = { total, buckets: scoreBuckets }

    if (query.userId) {
      const rateIds = rates.map(r => r._id)
      const [interactions, userRate] = await Promise.all([
        this.rateInteractionModel
          .find({ user: new Types.ObjectId(String(query.userId)), rate: { $in: rateIds } })
          .lean(),
        this.rateModel.findOne({
          user: new Types.ObjectId(String(query.userId)),
          from: query.from,
          fromId: query.fromId ? new Types.ObjectId(String(query.fromId)) : undefined,
          isDeleted: false,
        }),
      ])

      const interactionMap: Record<string, string> = {}
      interactions.forEach(interaction => {
        if (interaction.rate) {
          interactionMap[String(interaction.rate)] = interaction.type
        }
      })

      ratesWithInteraction = rates.map(r => {
        const rateObj: any = { ...r }
        if (interactionMap[String(r._id)]) {
          rateObj.userInteraction = interactionMap[String(r._id)] || null
        }
        return rateObj
      })

      if (userRate) {
        myRateInfo = {
          _id: userRate._id,
          isRated: true,
          rate: userRate.rate,
          rateContent: userRate.rateContent,
          status: userRate.status,
          timeToFinish: userRate.timeToFinish,
          timeToFinishUnit: userRate.timeToFinishUnit,
          isSpoiler: userRate.isSpoiler,
        }
      }
    }

    const countQuery: any = {
      from: query.from,
      fromId: query.fromId ? new Types.ObjectId(String(query.fromId)) : undefined,
      isDeleted: false,
    }
    const going = await this.rateModel.countDocuments({ ...countQuery, status: 'going' })
    const completed = await this.rateModel
      .find({ ...countQuery, status: 'completed' })
      .select('timeToFinish timeToFinishUnit')
      .lean()
    const onhold = await this.rateModel.countDocuments({ ...countQuery, status: 'onhold' })
    const dropped = await this.rateModel.countDocuments({ ...countQuery, status: 'dropped' })
    const plan = await this.rateModel.countDocuments({ ...countQuery, status: 'plan' })

    const totalTimeToFinish = completed.reduce((acc, r) => {
      const timeInHours = this.formatTimeToHours(
        this.formatTimeToSeconds(r.timeToFinish || 0, r.timeToFinishUnit || 'day'),
      )
      return acc + timeInHours
    }, 0)
    const avgTime =
      completed.length > 0 ? Math.round((totalTimeToFinish / completed.length) * 10) / 10 : 0

    const count = {
      total,
      going,
      completed: completed.length,
      onhold,
      dropped,
      plan,
      avgTime,
    }

    return {
      list: ratesWithInteraction,
      myRate: myRateInfo,
      avgRate,
      scoreDistribution,
      count,
      pagination: { page, totalPages, limit, total },
    }
  }

  private formatTimeToSeconds(value: number, unit: string) {
    if (!value) return 0
    if (unit === 'day') return value * 24 * 3600
    if (unit === 'hour') return value * 3600
    if (unit === 'minute') return value * 60
    return 0
  }

  private formatTimeToHours(seconds: number) {
    return Math.round((seconds / 3600) * 10) / 10
  }

  async getAllRates(query: GetAllRatesQueryDto, req: RequestWithUser) {
    const page = Number(query.page || 1)
    const limit = Number(query.limit || 10)
    if (page < 1 || limit < 1 || limit > 100) {
      throw new BadRequestException('invalid pagination parameters')
    }

    const userId = query.userId
      ? new Types.ObjectId(String(query.userId))
      : new Types.ObjectId(String(req.user._id))
    if (!userId) {
      throw new BadRequestException('userId is required')
    }

    const filter: any = { user: userId, isDeleted: false, isSpoiler: { $ne: true } }
    if (query.from) filter.from = query.from

    const skip = (page - 1) * limit
    const rates = await this.rateModel
      .find(filter)
      .select('-__v')
      .populate('user', 'name userId avatar -_id')
      .populate('fromId', 'galId novelId originTitle transTitle name name_cn cover -_id')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
    const total = await this.rateModel.countDocuments(filter)

    const ratesMapped = rates.map(r => {
      return {
        ...r,
        fromInfo: r.fromId,
        fromId: undefined,
      }
    })

    const totalPages = Math.ceil(total / limit)
    const pagination = { page, totalPages, limit, total }

    return { rates: ratesMapped, pagination }
  }

  async deleteRate(rateId: string, req: RequestWithUser): Promise<void> {
    const rate = await this.rateModel.findById(rateId)
    if (!rate || rate.isDeleted) {
      throw new NotFoundException('rate not found')
    }

    if (
      rate.user.toString() !== req.user._id.toString() &&
      req.user.hikariUserGroup !== HikariUserGroup.ADMIN &&
      req.user.hikariUserGroup !== HikariUserGroup.SUPER_ADMIN
    ) {
      throw new ForbiddenException('you are not allowed to delete this rate')
    }

    rate.isDeleted = true
    await rate.save()
  }

  async getReviews(query: GetReviewsQueryDto) {
    const page = Number(query.page || 1)
    const limit = Number(query.limit || 10)

    if (page < 1 || limit < 1 || limit > 100) {
      throw new BadRequestException('invalid pagination parameters')
    }

    if (!query.fromId) {
      throw new BadRequestException('missing required parameters')
    }

    const filter = {
      isReview: true,
      status: 'published',
      'relatedWorks.workId': new Types.ObjectId(String(query.fromId)),
    }

    const [reviews, total] = await Promise.all([
      this.articleModel
        .find(filter)
        .select('title content id -_id')
        .populate('creator.userId', 'name userId avatar -_id')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.articleModel.countDocuments(filter),
    ])

    const totalPages = Math.ceil(total / limit)

    const processedReviews = reviews.map(review => ({
      ...review,
      creator: review.creator.userId,
    }))

    return {
      list: processedReviews,
      pagination: {
        page,
        totalPages,
        limit,
        total,
      },
    }
  }
}
