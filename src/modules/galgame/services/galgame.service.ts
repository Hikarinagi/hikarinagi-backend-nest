import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  ConflictException,
} from '@nestjs/common'
import { InjectConnection, InjectModel } from '@nestjs/mongoose'
import { Connection, Model } from 'mongoose'
import { DownloadInfo, Galgame, GalgameDocument } from '../schemas/galgame.schema'
import { RequestWithUser } from '../../../modules/auth/interfaces/request-with-user.interface'
import { GetGalgameListDto } from '../dto/get-galgame-list.dto'
import { UpdateGalgameCoverAndImagesDto } from '../dto/update-galgame.dto'
import { PaginatedResult } from '../../../common/interfaces/paginated-result.interface'
import * as crypto from 'crypto'
import { HikariConfigService } from '../../../common/config/services/config.service'
import { Article, ArticleDocument } from '../../content/schemas/article.schema'
import { Post, PostDocument } from '../../content/schemas/post.schema'
import { EditHistoryService } from '../../../common/services/edit-history.service'
import { BangumiAuthService } from '../../../modules/bangumi/services/bangumi-auth.service'
import { HttpService } from '@nestjs/axios'
import { firstValueFrom } from 'rxjs'
import { CreateGalgameDto } from '../dto/create-galgame.dto'
import { Tag, TagDocument } from '../../entities/schemas/tag.schema'
import { Producer, ProducerDocument } from '../../entities/schemas/producer.schema'
import { Person, PersonDocument } from '../../entities/schemas/person.schema'
import { Character, CharacterDocument } from '../../entities/schemas/character.schema'
import { CounterService } from '../../shared/services/counter.service'
import { Types } from 'mongoose'
import { GetGalgameMonthlyReleasesDto } from '../dto/get-galgame-monthly-releases.dto'
import { SystemMessageService } from '../../message/services/system-message.service'
import { EmailService } from '../../email/services/email.service'
import { User, UserDocument } from '../../user/schemas/user.schema'
import { SystemMessageType } from '../../message/dto/send-system-message.dto'
import { HikariUserGroup } from '../../auth/enums/hikari-user-group.enum'

@Injectable()
export class GalgameService {
  constructor(
    @InjectModel(Galgame.name) private galgameModel: Model<GalgameDocument>,
    @InjectModel(Article.name) private articleModel: Model<ArticleDocument>,
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @InjectModel(Tag.name) private tagModel: Model<TagDocument>,
    @InjectModel(Producer.name) private producerModel: Model<ProducerDocument>,
    @InjectModel(Person.name) private personModel: Model<PersonDocument>,
    @InjectModel(Character.name) private characterModel: Model<CharacterDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly hikariConfigService: HikariConfigService,
    private readonly editHistoryService: EditHistoryService,
    private readonly bangumiAuthService: BangumiAuthService,
    private readonly httpService: HttpService,
    private readonly counterService: CounterService,
    private readonly systemMessageService: SystemMessageService,
    private readonly emailService: EmailService,
  ) {}

  async findById(id: string, preview: boolean = false, req: RequestWithUser) {
    if (isNaN(Number(id))) {
      throw new BadRequestException('id must be a number')
    }

    const query: any = {
      galId: id,
      status: 'published',
    }
    if (
      [HikariUserGroup.ADMIN, HikariUserGroup.SUPER_ADMIN].includes(req.user?.hikariUserGroup) &&
      preview
    ) {
      delete query.status
    }

    const galgame = await this.galgameModel
      .findOneAndUpdate(
        query,
        { $inc: { views: 1 } },
        {
          timestamps: false,
        },
      )
      .populate('creator.userId', 'name avatar userId -_id')
      .populate({
        path: 'producers.producer',
        select: 'id name aliases -_id',
      })
      .populate('tags.tag', 'name aliases -_id')
      .populate({
        path: 'staffs.person',
        select: 'id name transName -_id',
      })
      .populate({
        path: 'characters.character',
        select: 'id name transName intro transIntro image act -_id',
        populate: {
          path: 'act.person',
          select: 'id name transName note -_id',
        },
      })
    if (!galgame) {
      throw new NotFoundException('galgame not found')
    }

    const currentGalgameId = galgame._id

    if (galgame.characters && galgame.characters.length > 0) {
      galgame.characters.forEach(characterLink => {
        const character = characterLink.character as any
        if (character && character.act && character.act.length > 0) {
          character.act = character.act.filter(
            actItem =>
              actItem.work &&
              actItem.work.workId &&
              actItem.work.workId.toString() === currentGalgameId.toString(),
          )
        }
      })
    }

    const { contributors, createdBy, lastEditBy } = await this.editHistoryService.getContributors(
      'galgame',
      galgame.galId,
    )

    return {
      ...galgame.toJSON(),
      contributors,
      createdBy,
      lastEditBy,
    }
  }

  async getGalgameList(
    req: RequestWithUser,
    query: GetGalgameListDto,
  ): Promise<PaginatedResult<any>> {
    const { page, limit, year, month, sortField, sortOrder, tagsField } = query

    const matchStage: any = {
      status: 'published',
    }
    let nsfw = false
    const { user } = req
    if (user && user.userSetting) {
      nsfw = user.userSetting.showNSFWContent
    }
    if (!nsfw) {
      matchStage.nsfw = { $ne: true }
    }
    if (month && !year) {
      throw new BadRequestException('month must be used with year')
    }

    if (year?.length) {
      const dateRangeConditions = []

      if (month?.length) {
        // 验证月份范围（DTO层没有验证范围，这里补充业务验证）
        const validMonths = month.filter(m => m >= 1 && m <= 12)
        if (validMonths.length === 0) {
          throw new BadRequestException('month must be between 1 and 12')
        }

        // 为每个年月组合创建日期范围
        for (const yearNumber of year) {
          for (const monthNumber of validMonths) {
            const monthStr = monthNumber.toString().padStart(2, '0')
            const startDateStr = `${yearNumber}-${monthStr}-01`
            const lastDay = new Date(yearNumber, monthNumber, 0).getDate()
            const endDateStr = `${yearNumber}-${monthStr}-${lastDay.toString().padStart(2, '0')}`

            dateRangeConditions.push({
              $and: [
                { releaseDate: { $gte: startDateStr } },
                { releaseDate: { $lte: endDateStr } },
              ],
            })
          }
        }
      } else {
        // 只有年份，创建整年范围
        for (const yearNumber of year) {
          dateRangeConditions.push({
            $and: [
              { releaseDate: { $gte: `${yearNumber}-01-01` } },
              { releaseDate: { $lte: `${yearNumber}-12-31` } },
            ],
          })
        }
      }

      if (dateRangeConditions.length > 0) {
        matchStage.$or = dateRangeConditions
      }
    }

    // 处理标签
    const tagsMatch = {}
    if (tagsField) {
      if (Array.isArray(tagsField) && tagsField.length > 0) {
        const tagIds = tagsField.map(tag => new Types.ObjectId(String(tag)))
        tagsMatch['tags.tag'] = { $in: tagIds }
      } else if (typeof tagsField === 'string') {
        tagsMatch['tags.tag'] = new Types.ObjectId(tagsField as string)
      }
    }

    const sortStage: any = {}
    if (sortField) {
      if (sortField === 'releaseDate') {
        sortStage.releaseDate = sortOrder === 'asc' ? 1 : -1
      } else if (sortField === 'views') {
        sortStage.views = sortOrder === 'asc' ? 1 : -1
      } else if (sortField === 'rate') {
        sortStage.rate = sortOrder === 'asc' ? 1 : -1
      } else if (sortField === 'rateCount') {
        sortStage.rateCount = sortOrder === 'asc' ? 1 : -1
      }
    } else {
      sortStage.releaseDate = -1
    }

    const aggregationPipeline = [
      { $match: matchStage },
      ...(Object.keys(tagsMatch).length > 0 ? [{ $match: tagsMatch }] : []),
      // 关联评分数据
      {
        $lookup: {
          from: 'rates',
          let: { galgameId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$from', 'Galgame'] },
                    { $eq: ['$fromId', '$$galgameId'] },
                    { $eq: ['$isDeleted', false] },
                  ],
                },
              },
            },
          ],
          as: 'ratesData',
        },
      },
      // 计算评分统计
      {
        $addFields: {
          rate: {
            $cond: {
              if: { $gt: [{ $size: '$ratesData' }, 0] },
              then: { $avg: '$ratesData.rate' },
              else: null,
            },
          },
          rateCount: { $size: '$ratesData' },
        },
      },
      // 应用排序
      { $sort: sortStage },
      {
        $facet: {
          metadata: [{ $count: 'totalCount' }],
          galgames: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $lookup: {
                from: 'producers',
                localField: 'producers.producer',
                foreignField: '_id',
                as: 'producerDetails',
              },
            },
            {
              $lookup: {
                from: 'tags',
                localField: 'tags.tag',
                foreignField: '_id',
                as: 'tagDetails',
              },
            },
            {
              $project: {
                _id: 0,
                galId: 1,
                transTitle: 1,
                originTitle: 1,
                cover: 1,
                releaseDate: 1,
                views: 1,
                nsfw: 1,
                rate: 1,
                rateCount: 1,
                producers: {
                  $map: {
                    input: '$producerDetails',
                    as: 'producer',
                    in: {
                      producer: {
                        id: '$$producer.id',
                        name: '$$producer.name',
                        aliases: '$$producer.aliases',
                        logo: '$$producer.logo',
                      },
                    },
                  },
                },
                tags: {
                  $map: {
                    input: '$tagDetails',
                    as: 'tag',
                    in: '$$tag.name',
                  },
                },
              },
            },
          ],
        },
      },
    ]

    const result = await this.galgameModel.aggregate(aggregationPipeline)

    const totalCount = result[0].metadata[0]?.totalCount || 0
    const galgames = result[0].galgames
    const totalPages = Math.ceil(totalCount / limit)

    return {
      items: galgames,
      meta: {
        totalItems: totalCount,
        itemCount: galgames.length,
        itemsPerPage: limit,
        totalPages,
        currentPage: page,
      },
    }
  }

  async getGalgameMonthlyReleases(query: GetGalgameMonthlyReleasesDto) {
    const { year, month } = query

    const monthStr = month < 10 ? `0${month}` : `${month}`
    const startDateStr = `${year}-${monthStr}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDateStr = `${year}-${monthStr}-${lastDay}`

    const matchStage = {
      releaseDate: {
        $gte: startDateStr,
        $lte: endDateStr,
      },
      status: 'published',
    }

    const games = await this.galgameModel.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: 'rates',
          localField: '_id',
          foreignField: 'fromId',
          pipeline: [{ $match: { from: 'Galgame', isDeleted: false } }],
          as: 'rates',
        },
      },
      {
        $lookup: {
          from: 'producers',
          localField: 'producers.producer',
          foreignField: '_id',
          as: 'producerData',
        },
      },
      {
        $lookup: {
          from: 'tags',
          localField: 'tags.tag',
          foreignField: '_id',
          as: 'tagData',
        },
      },
      {
        $addFields: {
          avgRate: {
            $cond: {
              if: { $gt: [{ $size: '$rates' }, 0] },
              then: { $avg: '$rates.rate' },
              else: null,
            },
          },
          rateCount: { $size: '$rates' },
          producers: {
            $map: {
              input: '$producers',
              as: 'prod',
              in: {
                producer: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: '$producerData',
                        as: 'p',
                        cond: { $eq: ['$$p._id', '$$prod.producer'] },
                      },
                    },
                    0,
                  ],
                },
              },
            },
          },
          tags: {
            $map: {
              input: '$tags',
              as: 'tag',
              in: {
                tag: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: '$tagData',
                        as: 't',
                        cond: { $eq: ['$$t._id', '$$tag.tag'] },
                      },
                    },
                    0,
                  ],
                },
                likes: '$$tag.likes',
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          galId: 1,
          transTitle: 1,
          originTitle: 1,
          cover: 1,
          releaseDate: 1,
          nsfw: 1,
          avgRate: 1,
          rateCount: 1,
          'producers.producer.name': 1,
          'producers.producer.id': 1,
          'tags.tag.name': 1,
          'tags.likes': 1,
        },
      },
      { $sort: { releaseDate: 1 } },
    ])

    return games
  }

  async getDownloadInfo(id: string): Promise<DownloadInfo> {
    if (isNaN(Number(id))) {
      throw new BadRequestException('id must be a number')
    }
    const galgame = await this.galgameModel.findOneAndUpdate(
      {
        galId: id,
        status: 'published',
      },
      {
        $inc: {
          'downloadInfo.viewTimes': 1,
        },
      },
      {
        new: true,
        timestamps: false,
      },
    )
    if (!galgame) {
      throw new NotFoundException('galgame not found')
    }
    return galgame.toJSON({ onlyDownloadInfo: true }) as unknown as DownloadInfo
  }

  async getDownloadAuthInfo(id: number, timestamp: number, req: RequestWithUser) {
    const { user } = req
    const user_id = user._id

    const message = `${id}-${user_id}-${timestamp}`
    const secret = this.hikariConfigService.get('galDownload.downloadSignatureSecret')
    const signature = crypto.createHmac('sha256', secret).update(message).digest('hex')

    await this.galgameModel.updateOne(
      {
        galId: String(id),
      },
      { $inc: { 'downloadInfo.downloadTimes': 1 } },
    )

    return {
      signature,
    }
  }

  async getRelatedGalgames(id: string, req: RequestWithUser) {
    if (isNaN(Number(id))) {
      throw new BadRequestException('id must be a number')
    }

    const { user } = req
    let showNSFW: boolean
    if (user && user.userSetting) {
      showNSFW = user.userSetting.showNSFWContent
    } else showNSFW = false

    const nsfwFilter = showNSFW ? {} : { nsfw: false }

    const galgame = await this.galgameModel
      .findOne({ galId: String(id) })
      .where('status')
      .equals('published')
      .select('_id galId nsfw')
      .populate({
        path: 'producers.producer',
        select: 'name',
      })
      .populate({
        path: 'tags.tag',
        select: 'name',
      })
      .populate({
        path: 'characters.character',
        select: 'name',
      })
      .populate({
        path: 'staffs.person',
        select: 'name',
      })
      .lean()
    if (!galgame) {
      throw new NotFoundException('galgame not found')
    }

    const gal_id = galgame._id
    // const galProducers = galgame.producers.map(producer => producer.producer._id)
    const galTags = galgame.tags.map(tag => tag.tag._id)
    const galCharacters = galgame.characters.map(character => character.character._id)
    const galStaffs = galgame.staffs.map(staff => staff.person._id)
    // 获取相关gal

    const relatedGalgames = []

    // const relatedByProcucers = await Galgame.find({
    //   'producers.producer': { $in: galProducers },
    //   _id: { $ne: gal_id }
    // }).where('status').equals('published').select('galId cover transTitle originTitle')
    // relatedGalgames.push(...relatedByProcucers)
    // 至少有3个tag相同
    const relatedByTags = await this.galgameModel.aggregate([
      {
        $match: {
          _id: { $ne: gal_id },
          status: 'published',
          'tags.tag': { $in: galTags },
          ...nsfwFilter,
        },
      },
      {
        $project: {
          galId: 1,
          cover: 1,
          transTitle: 1,
          originTitle: 1,
          nsfw: 1,
          matchingTagsCount: {
            $size: {
              $filter: {
                input: '$tags',
                as: 'tag',
                cond: { $in: ['$$tag.tag', galTags] },
              },
            },
          },
        },
      },
      { $match: { matchingTagsCount: { $gte: 5 } } },
    ])
    relatedGalgames.push(...relatedByTags)
    // 至少有1个角色相同
    const relatedByCharacters = await this.galgameModel.aggregate([
      {
        $match: {
          _id: { $ne: gal_id },
          status: 'published',
          'characters.character': { $in: galCharacters },
          ...nsfwFilter,
        },
      },
      {
        $project: {
          galId: 1,
          cover: 1,
          transTitle: 1,
          originTitle: 1,
          nsfw: 1,
          matchingCharactersCount: {
            $size: {
              $filter: {
                input: '$characters',
                as: 'character',
                cond: { $in: ['$$character.character', galCharacters] },
              },
            },
          },
        },
      },
      { $match: { matchingCharactersCount: { $gte: 1 } } },
    ])
    relatedGalgames.push(...relatedByCharacters)
    // 至少有1个staff相同
    const relatedByStaffs = await this.galgameModel.aggregate([
      {
        $match: {
          _id: { $ne: gal_id },
          status: 'published',
          'staffs.person': { $in: galStaffs },
          ...nsfwFilter,
        },
      },
      {
        $project: {
          galId: 1,
          cover: 1,
          transTitle: 1,
          originTitle: 1,
          nsfw: 1,
          matchingStaffsCount: {
            $size: {
              $filter: {
                input: '$staffs',
                as: 'staff',
                cond: { $in: ['$$staff.person', galStaffs] },
              },
            },
          },
        },
      },
      { $match: { matchingStaffsCount: { $gte: 1 } } },
    ])
    relatedGalgames.push(...relatedByStaffs)

    const scoreMap = {
      matchingTagsCount: 1,
      matchingCharactersCount: 10,
      matchingStaffsCount: 5,
    }
    // 计算分数
    const scoredGalgames = relatedGalgames.map(galgame => {
      const score = Object.keys(scoreMap).reduce((total, key) => {
        return total + (galgame[key] || 0) * scoreMap[key]
      }, 0)
      return { ...galgame, score }
    })
    // 按照分数排序
    scoredGalgames.sort((a, b) => b.score - a.score)
    // 去重
    const uniqueGalgames = new Map()
    scoredGalgames.forEach(galgame => {
      if (!uniqueGalgames.has(galgame.galId)) {
        uniqueGalgames.set(galgame.galId, galgame)
      }
    })
    let filteredRelatedGalgames = Array.from(uniqueGalgames.values()).map(galgame => {
      return {
        galId: galgame.galId,
        cover: galgame.cover,
        transTitle: galgame.transTitle,
        originTitle: galgame.originTitle,
        nsfw: galgame.nsfw,
        score: galgame.score,
      }
    })
    // 过滤掉当前游戏, 保留12个
    filteredRelatedGalgames = filteredRelatedGalgames
      .filter(galgame => galgame.galId !== String(id))
      .slice(0, 32)

    // 获取相关的文章
    let relatedAriticles = []
    const directedRelatedArticles = await this.articleModel
      .find({ 'relatedWorks.workId': gal_id })
      .where('status')
      .equals('published')
      .where('visible')
      .equals('public')
      .where('isReview')
      .equals(false)
      .populate('creator.userId', 'name avatar userId -_id')
      .select('id title cover content createdAt updatedAt')
      .lean()

    relatedAriticles.push(...directedRelatedArticles)

    const targetWorkId = new Types.ObjectId(String(gal_id))
    const sectionRelatedArticles = await this.articleModel.aggregate([
      {
        $match: {
          status: 'published',
          visible: 'public',
          sections: { $exists: true, $ne: [] },
        },
      },
      {
        $lookup: {
          from: 'sections',
          localField: 'sections',
          foreignField: '_id',
          as: 'joinedSections',
        },
      },
      {
        $unwind: {
          path: '$joinedSections',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $match: {
          'joinedSections.relatedWork.workId': targetWorkId,
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'creator.userId',
          foreignField: '_id',
          as: 'creatorData',
        },
      },
      {
        $unwind: {
          path: '$creatorData',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          id: 1,
          title: 1,
          cover: 1,
          content: 1,
          creator: {
            userId: {
              userId: '$creatorData.userId',
              name: '$creatorData.name',
              avatar: '$creatorData.avatar',
            },
          },
          createdAt: 1,
          updatedAt: 1,
          sectionTitle: '$joinedSections.title',
        },
      },
    ])
    relatedAriticles.push(...sectionRelatedArticles)
    // 去重
    const uniqueArticles = new Map()
    relatedAriticles.forEach(article => {
      if (!uniqueArticles.has(article.id)) {
        uniqueArticles.set(article.id, article)
      }
    })
    relatedAriticles = Array.from(uniqueArticles.values()).map(article => {
      return {
        id: article.id,
        title: article.title,
        cover: article.cover,
        content: article.content.slice(0, 1000),
        creator: article.creator,
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
      }
    })

    if (relatedAriticles.length) {
      relatedAriticles = relatedAriticles.map(article => {
        article.creator = article.creator.userId
        return {
          id: article.id,
          title: article.title,
          cover: article.cover,
          content: article.content.slice(0, 1000),
          creator: article.creator,
          createdAt: article.createdAt,
          updatedAt: article.updatedAt,
        }
      })
    }

    return {
      relatedGalgames: filteredRelatedGalgames,
      relatedAriticles: relatedAriticles,
    }
  }

  async fetchGameDataFromBangumi(id: number | string) {
    const token = await this.bangumiAuthService.getValidAccessToken()
    if (!token) {
      throw new BadRequestException('Failed to get Bangumi token')
    }
    if (!id || isNaN(Number(id))) {
      throw new BadRequestException('id must be a number')
    }

    const baseUrl = 'https://api.bgm.tv/v0'
    const headers = {
      'User-Agent': 'trim21/bangumi-episode-ics',
      Authorization: 'Bearer ' + token,
    }

    const endpoints = {
      subject_info: `${baseUrl}/subjects/${id}`,
      characters: `${baseUrl}/subjects/${id}/characters`,
      persons: `${baseUrl}/subjects/${id}/persons`,
    }

    let [subjectInfo, characters, persons] = [null, null, null]
    try {
      ;[subjectInfo, characters, persons] = await Promise.all([
        firstValueFrom(this.httpService.get(endpoints.subject_info, { headers })),
        firstValueFrom(this.httpService.get(endpoints.characters, { headers })),
        firstValueFrom(this.httpService.get(endpoints.persons, { headers })),
      ])
    } catch (error) {
      if (error.response.status === 401 || error.response.status === 403) {
        const newToken = await this.bangumiAuthService.refreshAccessToken()
        if (!newToken) {
          throw new BadRequestException('Failed to refresh Bangumi token')
        }
        headers.Authorization = 'Bearer ' + newToken.access_token
        ;[subjectInfo, characters, persons] = await Promise.all([
          firstValueFrom(this.httpService.get(endpoints.subject_info, { headers })),
          firstValueFrom(this.httpService.get(endpoints.characters, { headers })),
          firstValueFrom(this.httpService.get(endpoints.persons, { headers })),
        ])
      } else {
        throw new InternalServerErrorException('Failed to fetch Bangumi data')
      }
    }

    if (subjectInfo.data?.platform !== '游戏') {
      throw new BadRequestException('The specified subject_id is not a game')
    }

    // 处理制作人员信息
    const personDetailsResults = await Promise.allSettled(
      persons.data.map(async person => {
        try {
          const personDetails = await firstValueFrom(
            this.httpService.get(`${baseUrl}/persons/${person.id}`, {
              headers,
            }),
          )
          const personData = personDetails.data

          // 从infobox中提取别名，并从labels中移除别名字段
          const aliasesData = personData.infobox?.find(item => item.key === '别名')
          const aliases = aliasesData?.value || []
          const labels =
            personData.infobox
              ?.filter(item => item.key !== '别名')
              ?.map(item => ({
                key: item.key,
                value: Array.isArray(item.value)
                  ? item.value.map(v => v.v || v).join('、')
                  : typeof item.value === 'object'
                    ? item.value.v || ''
                    : item.value || '',
              })) || []

          // 提取别名列表
          const extractedAliases = Array.isArray(aliases)
            ? aliases.map(alias => (typeof alias === 'string' ? alias : alias.v))
            : [aliases].filter(Boolean)

          return {
            person: {
              name: personData.name,
              transName: personData.infobox?.find(item => item.key === '简体中文名')?.value || '',
              aliases: extractedAliases,
              intro: personData.summary || '',
              transIntro: '',
              image: personData.images?.large || '',
              labels,
            },
            role: person.relation,
          }
        } catch (error) {
          console.error(`Error processing person ${person.id}:`, error)
          return null
        }
      }),
    )

    const validStaffs = personDetailsResults
      .filter(result => result.status === 'fulfilled' && result.value)
      .map((result: any) => result.value)

    // 从staff中获取制作商信息
    const developerStaffs = validStaffs.filter(
      staff => staff.role === '开发' || staff.role === '发行',
    )
    const producers = developerStaffs.map(developerStaff => ({
      producer: {
        name: developerStaff.person.name,
        aliases: developerStaff.person.aliases,
        intro: developerStaff.person.intro,
        transIntro: developerStaff.person.transIntro,
        type: ['galgame', '视觉小说'],
        country: '日本',
        established: developerStaff.person.labels.find(label => label.key === '设立')?.value || '',
        logo: developerStaff.person.image,
        labels: developerStaff.person.labels,
      },
    }))

    // 如果没有找到制作商，添加一个空的制作商对象
    if (producers.length === 0) {
      ;(producers as any).push({
        producer: {
          name: 'NOT FOUND',
          aliases: [],
          intro: '',
          transIntro: '',
          type: ['galgame', '视觉小说'],
          country: '日本',
          established: '',
          logo: '',
        },
      })
    }

    const filteredStaffs = validStaffs.filter(
      staff => staff.role !== '开发' && staff.role !== '发行',
    )
    // 根据角色ID获取所有角色详情
    const characterDetailsResults = await Promise.allSettled(
      characters.data.map(async chara => {
        try {
          const [characterDetails, actorDetails] = await Promise.all([
            firstValueFrom(this.httpService.get(`${baseUrl}/characters/${chara.id}`, { headers })),
            Promise.all(
              (chara.actors || []).map(actor =>
                firstValueFrom(
                  this.httpService.get(`${baseUrl}/persons/${actor.id}`, { headers }),
                ).catch(error => {
                  console.error(`Error fetching actor ${actor.id} details:`, error)
                  return null
                }),
              ),
            ),
          ])

          const charData = characterDetails.data

          // 处理角色的别名和labels
          const charAliasesData = charData.infobox?.find(item => item.key === '别名')
          const charAliases = charAliasesData?.value || []
          const charLabels =
            charData.infobox
              ?.filter(item => item.key !== '别名')
              ?.map(item => ({
                key: item.key,
                value: Array.isArray(item.value)
                  ? item.value.map(v => v.v || v).join('、')
                  : typeof item.value === 'object'
                    ? item.value.v || ''
                    : item.value || '',
              })) || []

          // 提取角色别名列表
          const extractedCharAliases = Array.isArray(charAliases)
            ? charAliases.map(alias => (typeof alias === 'string' ? alias : alias.v))
            : [charAliases].filter(Boolean)

          // 处理声优信息
          const act = chara.actors
            ?.map((actor, index) => {
              const actorData = actorDetails[index]?.data
              if (!actorData) return null

              // 处理声优的别名和labels
              const actorAliasesData = actorData.infobox?.find(item => item.key === '别名')
              const actorAliases = actorAliasesData?.value || []
              const actorLabels =
                actorData.infobox
                  ?.filter(item => item.key !== '别名')
                  ?.map(item => ({
                    key: item.key,
                    value: Array.isArray(item.value)
                      ? item.value.map(v => v.v || v).join('、')
                      : typeof item.value === 'object'
                        ? item.value.v || ''
                        : item.value || '',
                  })) || []

              // 提取声优别名列表
              const extractedActorAliases = Array.isArray(actorAliases)
                ? actorAliases.map(alias => (typeof alias === 'string' ? alias : alias.v))
                : [actorAliases].filter(Boolean)

              return {
                person: {
                  name: actor.name,
                  transName:
                    actorData.infobox?.find(item => item.key === '简体中文名')?.value || '',
                  aliases: extractedActorAliases,
                  intro: actorData.summary || '',
                  transIntro: '',
                  image: actorData.images?.large || '',
                  labels: actorLabels,
                },
              }
            })
            .filter(Boolean)

          return {
            character: {
              name: charData.name,
              transName: charData.infobox?.find(item => item.key === '简体中文名')?.value || '',
              aliases: extractedCharAliases,
              intro: charData.summary || '',
              transIntro: '',
              image: charData.images?.large || '',
              labels: charLabels,
              act: act || [],
              relations: [],
            },
            role: chara.relation,
          }
        } catch (error) {
          console.error(`Error processing character ${chara.id}:`, error)
          return null
        }
      }),
    )

    const validCharacters = characterDetailsResults
      .filter(result => result.status === 'fulfilled' && result.value)
      .map((result: any) => result.value)

    const priceRaw = subjectInfo.data.infobox.find(item => item.key === '售价') || null
    const priceInfo = Array.isArray(priceRaw?.value)
      ? (
          subjectInfo.data.infobox as Array<{
            key: string
            value: Array<{ k: string; v: string }>
          }>
        )
          .find(item => item.key === '售价')
          .value.map(item => {
            const version =
              item.k || item.v.match(/[（(]\s*([^（）()]+?)\s*[）)]/)?.[1]?.trim() || ''
            const amount =
              Number(
                item.v.match(/[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/)?.[0]?.replace(/,/g, '') ||
                  null,
              ) || null
            const currency = amount <= 30 ? 'USD' : amount <= 1000 ? 'CNY' : 'JPY'
            return {
              version,
              amount,
              currency,
            }
          })
      : priceRaw?.value
        ? (() => {
            const version =
              priceRaw?.value.match(/[（(]\s*([^（）()]+?)\s*[）)]/)?.[1]?.trim() || ''
            const amount = Number(
              priceRaw?.value
                .match(/[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/)?.[0]
                ?.replace(/,/g, '') || null,
            )
            const currency = amount <= 30 ? 'USD' : amount <= 1000 ? 'CNY' : 'JPY'
            return [
              {
                version,
                amount,
                currency,
              },
            ]
          })()
        : []

    const platformRaw =
      (subjectInfo.data.infobox as Array<{ key: string; value: any }>).find(
        item => item.key === '平台',
      ) || null
    const platformInfo = Array.isArray(platformRaw?.value)
      ? platformRaw?.value.map(item => item.v) || []
      : platformRaw?.value
        ? [platformRaw.value]
        : []

    const transformedData = {
      bangumiGameId: subjectInfo.data.id,
      cover: subjectInfo.data.images?.large || '',
      transTitle: subjectInfo.data.name_cn || '',
      originTitle: [
        subjectInfo.data.name,
        ...(() => {
          const aliasData = subjectInfo.data.infobox?.find(item => item.key === '别名')?.value
          if (!aliasData) return []
          if (Array.isArray(aliasData))
            return aliasData.map(alias => (typeof alias === 'object' ? alias.v : alias))
          return [typeof aliasData === 'object' ? aliasData.v : aliasData]
        })(),
      ].filter(Boolean),
      producers,
      releaseDate: (() => {
        const date = subjectInfo.data.date || null
        if (!date) return null
        // 检查日期格式是否为 yyyy-mm-dd
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/
        return dateRegex.test(date) ? date : null
      })(),
      releaseDateTBD: !subjectInfo.data.date,
      releaseDateTBDNote: '',
      tags:
        subjectInfo.data.tags?.map(tag => ({
          tag: {
            name: tag.name,
            aliases: [],
            description: '',
          },
          likes: 0,
        })) || [],
      originIntro: subjectInfo.data.summary || '',
      transIntro: '',
      staffs: filteredStaffs,
      characters: validCharacters,
      homepage:
        (subjectInfo.data.infobox as Array<{ key: string; value: string }>).find(item => {
          return item.key === 'website'
        })?.value || '',
      price: priceInfo,
      platform: platformInfo,
      advType:
        (subjectInfo.data.infobox as Array<{ key: string; value: string }>).find(
          item => item.key === '游戏类型',
        )?.value || '',
    }

    return transformedData
  }

  async createGalgame(galgame: CreateGalgameDto, req: RequestWithUser) {
    const session = await this.connection.startSession()
    try {
      session.startTransaction()
      const creator = {
        userId: new Types.ObjectId(req.user._id),
        name: req.user.name,
      }
      const existingGalgame = await this.galgameModel
        .findOne({ bangumiGameId: galgame.bangumiGameId })
        .session(session)
      if (existingGalgame) {
        throw new ConflictException(
          `Galgame with bangumiGameId ${galgame.bangumiGameId} already exists`,
        )
      }

      // 2. 创建/获取标签
      const tagIds = []
      if (galgame.tags && galgame.tags.length > 0) {
        for (const tagData of galgame.tags) {
          if (tagData.tag._id) {
            tagIds.push({
              tag: new Types.ObjectId(tagData.tag._id),
              likes: tagData.likes || 0,
            })
            continue
          }
          try {
            let tag
            const existingTag = await this.tagModel
              .findOne({
                $or: [{ name: tagData.tag.name }, { aliases: tagData.tag.name }],
              })
              .session(session)
            if (existingTag) {
              tag = existingTag
            } else {
              const id = await this.counterService.getNextSequence('tagId')
              const [newTag] = await this.tagModel.create(
                [
                  {
                    id,
                    name: tagData.tag.name,
                    aliases: tagData.tag.aliases || [],
                    description: tagData.tag.description,
                    creator,
                  },
                ],
                { session },
              )
              tag = newTag
            }
            tagIds.push({
              tag: tag._id,
              likes: tagData.likes || 0,
            })
          } catch (error) {
            console.error('Error processing tag:', error, tagData)
            throw error
          }
        }
      }

      // 3. 创建/获取制作商
      const producerIds = []
      if (galgame.producers && galgame.producers.length > 0) {
        const processedProducers = []
        for (const producerData of galgame.producers) {
          if (processedProducers.includes(producerData.producer.name)) {
            continue
          }
          if (producerData.producer._id) {
            producerIds.push({
              producer: new Types.ObjectId(producerData.producer._id),
              note: producerData.note || '',
            })
            continue
          }
          try {
            let prod
            const existingProducer = await this.producerModel
              .findOne({
                name: producerData.producer.name,
              })
              .session(session)
            if (existingProducer) {
              prod = existingProducer
            } else {
              const id = await this.counterService.getNextSequence('producerId')
              const [newProducer] = await this.producerModel.create(
                [
                  {
                    id,
                    creator,
                    ...producerData.producer,
                  },
                ],
                { session },
              )
              await this.editHistoryService.recordEditHistory({
                type: 'producer',
                actionType: 'create',
                entityId: new Types.ObjectId(newProducer._id as unknown as string),
                userId: new Types.ObjectId(creator.userId),
                userName: creator.name,
                changes: '创建了producer条目',
                previous: null,
                updated: newProducer.toObject(),
              })
              prod = newProducer
            }
            processedProducers.push(prod.name)
            producerIds.push({
              producer: prod._id,
              note: producerData.note || '',
            })
          } catch (error) {
            console.error('Error processing producer:', error, producerData)
            throw error
          }
        }
      }

      // 4. 处理staff
      const staffIds = []
      if (galgame.staffs && galgame.staffs.length > 0) {
        for (const staffData of galgame.staffs) {
          if (staffData.person._id) {
            staffIds.push({
              person: new Types.ObjectId(staffData.person._id),
              role: staffData.role || '',
            })
            continue
          }
          try {
            let person
            const processedLabels = (staffData.person.labels || []).map(label => ({
              key: label.key,
              value: label.value || '未知',
            }))

            const existingPerson = await this.personModel
              .findOne({
                name: staffData.person.name,
              })
              .session(session)
            const existingProducer = await this.producerModel
              .findOne({
                name: staffData.person.name,
              })
              .session(session)
            if (existingProducer) continue
            if (existingPerson) {
              person = existingPerson
            } else {
              const id = await this.counterService.getNextSequence('personId')
              const [newPerson] = await this.personModel.create(
                [
                  {
                    id,
                    creator,
                    ...staffData.person,
                    labels: processedLabels,
                  },
                ],
                { session },
              )
              await this.editHistoryService.recordEditHistory({
                type: 'person',
                actionType: 'create',
                entityId: new Types.ObjectId(newPerson._id as unknown as string),
                userId: creator.userId,
                userName: creator.name,
                changes: '创建了person条目',
                previous: null,
                updated: newPerson.toObject(),
              })
              person = newPerson
            }

            staffIds.push({
              person: person._id,
              role: staffData.role,
            })
          } catch (error) {
            console.error('Error processing staff:', error, staffData)
            throw error
          }
        }
      }

      // 5. 创建游戏 (不包含角色)
      const galId = await this.counterService.getNextSequence('galId')
      const initialGameData = {
        ...req.body,
        galId,
        creator,
        tags: tagIds,
        producers: producerIds,
        staffs: staffIds,
        characters: [], // 暂时为空
        homepage: galgame.homepage,
        price: galgame.price,
        platform: galgame.platform,
        advType: galgame.advType,
        createdAt: new Date(),
        status:
          req.user.hikariUserGroup === 'admin' || req.user.hikariUserGroup === 'superAdmin'
            ? 'published'
            : 'pending',
      }
      const [newGalgame] = await this.galgameModel.create([initialGameData], { session })

      // 6. 处理角色
      const characterLinks = []
      if (galgame.characters && galgame.characters.length > 0) {
        for (const characterData of galgame.characters) {
          if (characterData.character._id) {
            characterLinks.push({
              character: new Types.ObjectId(characterData.character._id),
              role: characterData.role || '主角',
            })
            continue
          }
          try {
            let character
            const processedCharacterLabels = (characterData.character.labels || []).map(label => ({
              key: label.key,
              value: label.value || '未知',
            }))

            const actorIds = []
            if (characterData.character.act) {
              for (const actData of characterData.character.act) {
                // 跳过无声优数据
                if (!actData || !actData.person || !actData.person.name) {
                  continue
                }

                let actor
                const processedActorLabels = (actData.person.labels || []).map(label => ({
                  key: label.key,
                  value: label.value || '未知',
                }))

                const existingActor = await this.personModel
                  .findOne({
                    name: actData.person.name,
                  })
                  .session(session)
                if (existingActor) {
                  actor = existingActor
                } else {
                  const id = await this.counterService.getNextSequence('personId')
                  const [newActor] = await this.personModel.create(
                    [
                      {
                        id,
                        creator,
                        ...actData.person,
                        labels: processedActorLabels,
                      },
                    ],
                    { session },
                  )
                  // 记录创建历史
                  await this.editHistoryService.recordEditHistory({
                    type: 'person',
                    actionType: 'create',
                    entityId: new Types.ObjectId(newActor._id as unknown as string),
                    userId: creator.userId,
                    userName: creator.name,
                    changes: '创建了person条目',
                    previous: null,
                    updated: newActor.toObject(),
                  })
                  actor = newActor
                }
                actorIds.push(actor._id)
              }
            }

            const existingCharacter = await this.characterModel
              .findOne({
                name: characterData.character.name,
              })
              .session(session)
            if (existingCharacter) {
              character = existingCharacter
              if (
                Array.isArray(characterData.character.act) &&
                characterData.character.act.length
              ) {
                const actsToAdd = []
                for (const actItem of characterData.character.act) {
                  if (!actItem || !actItem.person || !actItem.person._id) continue
                  actsToAdd.push({
                    person: actItem.person._id || null,
                    work: {
                      workId: newGalgame._id as Types.ObjectId,
                      workType: 'Galgame' as const,
                    },
                  })
                }
                if (actsToAdd.length) {
                  await this.characterModel.findByIdAndUpdate(
                    existingCharacter._id,
                    { $push: { act: { $each: actsToAdd } } },
                    { session },
                  )
                }
              }
            } else {
              const id = await this.counterService.getNextSequence('characterId')
              const actRecords = actorIds.map(actorId => ({
                person: actorId,
                work: { workId: newGalgame._id as Types.ObjectId, workType: 'Galgame' as const },
              }))

              const [newCharacter] = await this.characterModel.create(
                [
                  {
                    id,
                    creator,
                    ...characterData.character,
                    labels: processedCharacterLabels,
                    act: actRecords,
                  },
                ],
                { session },
              )
              // 记录创建历史
              await this.editHistoryService.recordEditHistory({
                type: 'character',
                actionType: 'create',
                entityId: new Types.ObjectId(newCharacter._id as unknown as string),
                userId: creator.userId,
                userName: creator.name,
                changes: '创建了character条目',
                previous: null,
                updated: newCharacter.toObject(),
              })
              character = newCharacter
            }

            characterLinks.push({
              character: character._id,
              role: characterData.role,
            })
          } catch (error) {
            console.error('Error processing character:', error, characterData)
            throw error
          }
        }
      }

      // 7. 更新游戏，加入角色信息
      newGalgame.characters = characterLinks
      await newGalgame.save({ session })

      if (newGalgame.status === 'pending') {
        const adminUsers = await this.userModel.find({
          hikariUserGroup: { $in: ['admin', 'superAdmin'] },
        })
        const adminUserIds = adminUsers.map(user => user._id)
        for (const adminUserId of adminUserIds) {
          await this.systemMessageService.sendSystemMessage({
            targetUser: new Types.ObjectId(adminUserId.toString()),
            title: '新游戏条目等待审核',
            content: `新游戏条目 ${newGalgame.transTitle || newGalgame.originTitle[0]} 等待审核`,
            type: SystemMessageType.SYSTEM,
            link: `/galgame/${newGalgame.galId}?preview=true`,
            linkText: '预览游戏条目',
          })
        }
      }

      // 8. 更新关联
      // 更新制作商关联
      const updatedProducerIds = new Set()
      for (const producerObj of producerIds) {
        if (updatedProducerIds.has(producerObj.producer.toString())) {
          continue
        }

        const producer = await this.producerModel.findById(producerObj.producer).session(session)
        const hasExistingWork = producer.works.some(
          work => work.workType === 'Galgame' && work.work.equals(newGalgame._id as Types.ObjectId),
        )

        if (!hasExistingWork) {
          await this.producerModel.findByIdAndUpdate(
            producerObj.producer,
            {
              $push: {
                works: {
                  workType: 'Galgame',
                  work: newGalgame._id,
                },
              },
            },
            { session },
          )
        }

        updatedProducerIds.add(producerObj.producer.toString())
      }
      // 更新人物关联
      const updatedPersonIds = new Set()
      for (const staff of staffIds) {
        if (updatedPersonIds.has(staff.person.toString())) {
          continue
        }
        const person = await this.personModel.findById(staff.person).session(session)
        const hasExistingWork = person.works.some(
          work => work.workType === 'Galgame' && work.work.equals(newGalgame._id as Types.ObjectId),
        )

        if (!hasExistingWork) {
          await this.personModel.findByIdAndUpdate(
            staff.person,
            {
              $push: {
                works: {
                  workType: 'Galgame',
                  work: newGalgame._id,
                },
              },
            },
            { session },
          )
        }
        updatedPersonIds.add(staff.person.toString())
      }
      // 更新角色关联
      const updatedCharacterIds = new Set()
      for (const char of characterLinks) {
        if (updatedCharacterIds.has(char.character.toString())) {
          continue
        }

        const character = await this.characterModel.findById(char.character).session(session)
        const hasExistingWork = character.act.some(
          actItem =>
            actItem.work?.workType === 'Galgame' &&
            actItem.work?.workId?.equals(newGalgame._id as Types.ObjectId),
        )

        if (!hasExistingWork) {
          await this.characterModel.findByIdAndUpdate(
            char.character,
            {
              $push: {
                act: {
                  work: { workId: newGalgame._id, workType: 'Galgame' },
                },
              },
            },
            { session },
          )
        }

        updatedCharacterIds.add(char.character.toString())
        // 更新角色声优关联
        if (character.act && character.act.length > 0) {
          for (const actItem of character.act) {
            const actorId = actItem.person
            if (!actorId) continue
            if (updatedPersonIds.has(actorId.toString())) {
              continue
            }
            const actor = await this.personModel.findById(actorId).session(session)
            const hasExistingActorWork = actor.works.some(
              work =>
                work.workType === 'Galgame' && work.work.equals(newGalgame._id as Types.ObjectId),
            )

            if (!hasExistingActorWork) {
              await this.personModel.findByIdAndUpdate(
                actorId,
                {
                  $push: {
                    works: {
                      workType: 'Galgame',
                      work: newGalgame._id,
                    },
                  },
                },
                { session },
              )
            }

            updatedPersonIds.add(actorId.toString())
          }
        }
      }

      // 9. 记录历史
      await this.editHistoryService.recordEditHistory({
        type: 'galgame',
        actionType: 'create',
        galId: galId.toString(),
        userId: new Types.ObjectId(req.user._id),
        userName: req.user.name,
        changes: '创建了游戏条目',
        previous: null,
        updated: newGalgame,
      })

      await session.commitTransaction()

      return {
        galId: newGalgame.galId,
      }
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      session.endSession()
    }
  }

  async updateGalgameCoverAndImages(
    id: string,
    data: UpdateGalgameCoverAndImagesDto,
    req: RequestWithUser,
  ) {
    if (isNaN(Number(id))) {
      throw new BadRequestException('id must be a number')
    }

    const galgame = await this.galgameModel.findOne({ galId: id })
    if (!galgame) {
      throw new NotFoundException('Galgame not found')
    }
    const previous = await this.galgameModel.findById(galgame._id)

    const { cover, images, headCover } = data
    galgame.cover = cover
    galgame.images = images
    galgame.headCover = headCover
    galgame.status =
      req.user.hikariUserGroup === 'admin' || req.user.hikariUserGroup === 'superAdmin'
        ? 'published'
        : 'pending'
    await galgame.save()

    await this.editHistoryService.recordEditHistory({
      type: 'galgame',
      actionType: 'update',
      galId: galgame.galId,
      userId: new Types.ObjectId(req.user._id),
      userName: req.user.name,
      changes: '更新了游戏封面和图片',
      previous: previous,
      updated: galgame,
    })

    return {
      galId: galgame.galId,
      cover: galgame.cover,
      images: galgame.images,
      headCover: galgame.headCover,
    }
  }

  async getRandomGalgame(req: RequestWithUser) {
    let nsfw = false
    if (req.user && req.user.userSetting) {
      nsfw = req.user.userSetting.showNSFWContent
    }
    const matchStage: any = {
      status: 'published',
    }
    if (!nsfw) {
      matchStage.nsfw = { $ne: true }
    }
    const galgame = await this.galgameModel.aggregate([
      { $match: matchStage },
      { $sample: { size: 1 } },
      { $project: { _id: 0, galId: 1 } },
    ])
    return galgame && galgame.length > 0 ? galgame[0].galId : null
  }
}
