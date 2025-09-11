import { Model } from 'mongoose'
import { LightNovel, LightNovelDocument } from '../schemas/light-novel.schema'
import { EditHistoryService } from '../../../common/services/edit-history.service'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { GetLightNovelListDto } from '../dto/get-lightnovel-list.dto'
import { PaginatedResult } from '../../../common/interfaces/paginated-result.interface'
import { RequestWithUser } from '../../../modules/auth/interfaces/request-with-user.interface'
import { Types } from 'mongoose'
import { CreateLightNovelDto } from '../dto/create-lightnovel.dto'
import { InjectConnection } from '@nestjs/mongoose'
import { Connection } from 'mongoose'
import { CounterService } from '../../shared/services/counter.service'
import { Tag, TagDocument } from '../../entities/schemas/tag.schema'
import { Producer, ProducerDocument } from '../../entities/schemas/producer.schema'
import { Person, PersonDocument } from '../../entities/schemas/person.schema'
import { Character, CharacterDocument } from '../../entities/schemas/character.schema'
import { SystemMessageType } from '../../message/dto/send-system-message.dto'
import { SystemMessageService } from '../../message/services/system-message.service'
import { User, UserDocument } from '../../user/schemas/user.schema'
import { HikariUserGroup } from '../../auth/enums/hikari-user-group.enum'

@Injectable()
export class LightNovelService {
  constructor(
    @InjectModel(LightNovel.name) private lightNovelModel: Model<LightNovelDocument>,
    private readonly editHistoryService: EditHistoryService,
    @InjectConnection() private readonly connection: Connection,
    private readonly counterService: CounterService,
    @InjectModel(Tag.name) private tagModel: Model<TagDocument>,
    @InjectModel(Producer.name) private producerModel: Model<ProducerDocument>,
    @InjectModel(Person.name) private personModel: Model<PersonDocument>,
    @InjectModel(Character.name) private characterModel: Model<CharacterDocument>,
    private readonly systemMessageService: SystemMessageService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async findById(id: string, req: RequestWithUser, preview: boolean = false) {
    if (isNaN(Number(id))) {
      throw new BadRequestException('id must be a number')
    }

    const query: any = {
      novelId: id,
      status: 'published',
    }
    const volumeMatch: any = {
      status: 'published',
    }
    if (
      [HikariUserGroup.ADMIN, HikariUserGroup.SUPER_ADMIN].includes(req.user?.hikariUserGroup) &&
      preview
    ) {
      delete query.status
      delete volumeMatch.status
    }

    const novel = await this.lightNovelModel
      .findOneAndUpdate(
        query,
        { $inc: { views: 1 } },
        {
          timestamps: false,
        },
      )
      .select('-__v')
      .populate('creator.userId', 'name avatar userId -_id')
      .populate('author', 'name id transName -_id')
      .populate('illustrators.illustrator', 'name id transName -_id')
      .populate('publishers.publisher', 'name id transName -_id')
      .populate('bunko', 'name id transName -_id')
      .populate('characters.character', 'name id transName image -_id')
      .populate('tags.tag', 'name aliases -_id')
      .populate({
        path: 'series.volumes',
        model: 'LightNovelVolume',
        match: volumeMatch,
        select:
          'volumeId name volumeNumber volumeExtraName volumeType publicationDate status -_id cover',
        options: { sort: { publicationDate: 1 } }, // 按出版日期升序排列
      })

    if (!novel) {
      throw new NotFoundException('Light novel not found')
    }

    const { contributors, createdBy, lastEditBy } = await this.editHistoryService.getContributors(
      'lightNovel',
      novel.novelId,
    )

    return {
      ...novel.toJSON(),
      contributors,
      createdBy,
      lastEditBy,
    }
  }

  async getLightNovelList(
    req: RequestWithUser,
    query: GetLightNovelListDto,
  ): Promise<PaginatedResult<any>> {
    const { page, limit, year, month, sortField, sortOrder, tagsField, bunkoField } = query

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

    // 标签过滤
    const tagsMatch = {}
    if (tagsField) {
      if (Array.isArray(tagsField) && tagsField.length > 0) {
        const tagIds = tagsField.map(tag => new Types.ObjectId(String(tag)))
        tagsMatch['tags.tag'] = { $in: tagIds }
      } else if (typeof tagsField === 'string') {
        tagsMatch['tags.tag'] = new Types.ObjectId(tagsField as string)
      }
    }

    // 文库过滤
    const bunkoMatch: any = {}
    if (bunkoField) {
      if (Array.isArray(bunkoField) && bunkoField.length > 0) {
        const bunkoIds = bunkoField.map(bunko => new Types.ObjectId(String(bunko)))
        bunkoMatch.bunko = { $in: bunkoIds }
      } else if (typeof bunkoField === 'string') {
        bunkoMatch.bunko = new Types.ObjectId(bunkoField as string)
      }
    }

    // 构建基础聚合管道
    const aggregationPipeline: any = [
      { $match: matchStage },
      ...(Object.keys(tagsMatch).length > 0 ? [{ $match: tagsMatch }] : []),
      ...(Object.keys(bunkoMatch).length > 0 ? [{ $match: bunkoMatch }] : []),

      // 关联轻小说卷数据，获取每本小说的卷信息
      {
        $lookup: {
          from: 'lightnovelvolumes',
          let: { seriesId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$seriesId', '$$seriesId'] }, { $eq: ['$status', 'published'] }],
                },
              },
            },
            { $sort: { publicationDate: 1 } }, // 按发布日期升序排序，获取最早的卷
            { $limit: 1 }, // 只取第一卷
          ],
          as: 'volumes',
        },
      },

      // 添加计算字段：使用第一卷的publicationDate作为小说的发布日期
      {
        $addFields: {
          firstVolumePublicationDate: {
            $cond: {
              if: { $gt: [{ $size: '$volumes' }, 0] },
              then: { $arrayElemAt: ['$volumes.publicationDate', 0] },
              else: null,
            },
          },
        },
      },
    ]

    if (year) {
      // 处理日期
      const dateRangeConditions = []
      if (month) {
        // 为每个年月组合创建日期范围
        for (const yearNum of year) {
          for (const monthNum of month) {
            const monthStr = monthNum < 10 ? `0${monthNum}` : `${monthNum}`
            const startDateStr = `${yearNum}-${monthStr}-01`
            const lastDay = new Date(yearNum, monthNum, 0).getDate()
            const endDateStr = `${yearNum}-${monthStr}-${lastDay}`

            dateRangeConditions.push({
              $and: [
                { firstVolumePublicationDate: { $gte: startDateStr } },
                { firstVolumePublicationDate: { $lte: endDateStr } },
              ],
            })
          }
        }
      } else {
        // 如果没有提供month参数，为每一年创建一个日期范围
        for (const yearNum of year) {
          const startDateStr = `${yearNum}-01-01`
          const endDateStr = `${yearNum}-12-31`
          dateRangeConditions.push({
            $and: [
              { firstVolumePublicationDate: { $gte: startDateStr } },
              { firstVolumePublicationDate: { $lte: endDateStr } },
            ],
          })
        }
      }
      if (dateRangeConditions.length > 0) {
        aggregationPipeline.push({ $match: { $or: dateRangeConditions } })
      }
    }

    // 关联评分数据
    aggregationPipeline.push(
      {
        $lookup: {
          from: 'rates',
          let: { lightNovelId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$from', 'LightNovel'] },
                    { $eq: ['$fromId', '$$lightNovelId'] },
                    { $eq: ['$isDeleted', 'false'] },
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
    )

    // 排序条件
    const sortStage: any = {}
    if (sortField) {
      if (sortField === 'publicationDate') {
        sortStage.firstVolumePublicationDate = sortOrder === 'asc' ? 1 : -1
      } else if (sortField === 'views') {
        sortStage.views = sortOrder === 'asc' ? 1 : -1
      } else if (sortField === 'rate') {
        sortStage.rate = sortOrder === 'asc' ? 1 : -1
      } else if (sortField === 'rateCount') {
        sortStage.rateCount = sortOrder === 'asc' ? 1 : -1
      } else if (sortField === 'novelId') {
        sortStage.novelId = sortOrder === 'asc' ? 1 : -1
      }
    }

    // 只有当sortStage包含至少一个排序键时才添加$sort阶段
    if (Object.keys(sortStage).length > 0) {
      // 添加排序
      aggregationPipeline.push({ $sort: sortStage })
    }

    // 完成聚合管道
    aggregationPipeline.push({
      $facet: {
        metadata: [{ $count: 'totalCount' }],
        lightNovels: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $lookup: {
              from: 'people',
              localField: 'author',
              foreignField: '_id',
              as: 'authorDetails',
            },
          },
          {
            $lookup: {
              from: 'producers',
              localField: 'bunko',
              foreignField: '_id',
              as: 'bunkoDetails',
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
              novelId: 1,
              name: 1,
              name_cn: 1,
              cover: 1,
              publicationDate: '$firstVolumePublicationDate', // 使用第一卷的发布日期
              views: 1,
              nsfw: 1,
              rate: 1,
              rateCount: 1,
              author: {
                $cond: {
                  if: { $gt: [{ $size: '$authorDetails' }, 0] },
                  then: {
                    id: { $arrayElemAt: ['$authorDetails.id', 0] },
                    name: { $arrayElemAt: ['$authorDetails.name', 0] },
                    transName: { $arrayElemAt: ['$authorDetails.transName', 0] },
                  },
                  else: null,
                },
              },
              bunko: {
                $cond: {
                  if: { $gt: [{ $size: '$bunkoDetails' }, 0] },
                  then: {
                    id: { $arrayElemAt: ['$bunkoDetails.id', 0] },
                    name: { $arrayElemAt: ['$bunkoDetails.name', 0] },
                    transName: { $arrayElemAt: ['$bunkoDetails.transName', 0] },
                  },
                  else: null,
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
    })

    const result = await this.lightNovelModel.aggregate(aggregationPipeline)

    const totalCount = result[0].metadata[0]?.totalCount || 0
    const lightNovels = result[0].lightNovels
    const totalPages = Math.ceil(totalCount / limit)

    return {
      items: lightNovels,
      meta: {
        totalItems: totalCount,
        itemCount: lightNovels.length,
        itemsPerPage: limit,
        totalPages,
        currentPage: page,
      },
    }
  }

  async createLightNovel(createLightNovelDto: CreateLightNovelDto, req: RequestWithUser) {
    const session = await this.connection.startSession()
    try {
      session.startTransaction()

      const creator = {
        userId: new Types.ObjectId(req.user._id),
        name: req.user.name,
      }

      const {
        bangumiBookId,
        tags,
        author,
        illustrators,
        publishers,
        bunko,
        characters,
        novelStatus,
      } = createLightNovelDto

      // 1. 检查小说是否已存在
      if (bangumiBookId) {
        const existingNovel = await this.lightNovelModel.findOne({ bangumiBookId }).session(session)
        if (existingNovel) {
          throw new Error(`Light novel with bangumiBookId ${bangumiBookId} already exists`)
        }
      }

      // 2. 创建/获取作者
      let authorId
      if (author && !author._id) {
        const processedLabels = author.labels.map(label => ({
          key: label.key,
          value: label.value || '未知',
        }))

        const existingAuthor = await this.personModel
          .findOne({ name: author.name })
          .session(session)
        if (existingAuthor) {
          authorId = existingAuthor._id
        } else {
          const id = await this.counterService.getNextSequence('personId')
          const [newAuthor] = await this.personModel.create(
            [
              {
                id,
                creator,
                ...author,
                labels: processedLabels,
              },
            ],
            { session },
          )
          await this.editHistoryService.recordEditHistory({
            type: 'person',
            actionType: 'create',
            entityId: new Types.ObjectId(newAuthor._id as string),
            userId: new Types.ObjectId(creator.userId),
            userName: creator.name,
            changes: '创建了person条目',
            previous: null,
            updated: newAuthor.toObject(),
          })
          authorId = newAuthor._id
        }
      } else {
        authorId = new Types.ObjectId(author._id)
      }

      // 3. 创建/获取插画师
      const illustratorIds = []
      if (illustrators && illustrators.length > 0) {
        for (const illustratorData of illustrators) {
          if (illustratorData.illustrator._id) {
            illustratorIds.push({
              illustrator: new Types.ObjectId(illustratorData.illustrator._id),
              note: illustratorData.note || '',
            })
            continue
          }
          try {
            let person
            const processedLabels = illustratorData.illustrator.labels.map(label => ({
              key: label.key,
              value: label.value || '未知',
            }))

            const existingPerson = await this.personModel
              .findOne({
                name: illustratorData.illustrator.name,
              })
              .session(session)

            if (existingPerson) {
              person = existingPerson
            } else {
              const id = await this.counterService.getNextSequence('personId')
              const [newPerson] = await this.personModel.create(
                [
                  {
                    id,
                    creator,
                    ...illustratorData.illustrator,
                    labels: processedLabels,
                  },
                ],
                { session },
              )
              await this.editHistoryService.recordEditHistory({
                type: 'person',
                actionType: 'create',
                entityId: new Types.ObjectId(newPerson._id as string),
                userId: new Types.ObjectId(creator.userId),
                userName: creator.name,
                changes: '创建了person条目',
                previous: null,
                updated: newPerson.toObject(),
              })
              person = newPerson
            }

            illustratorIds.push({
              illustrator: new Types.ObjectId(person._id as string),
              note: illustratorData.note || '',
            })
          } catch (error) {
            console.error('Error processing illustrator:', error, illustratorData)
            throw error
          }
        }
      }

      // 4. 创建/获取出版社
      const publisherIds = []
      if (publishers && publishers.length > 0) {
        for (const publisherData of publishers) {
          if (publisherData.publisher._id) {
            publisherIds.push({
              publisher: new Types.ObjectId(publisherData.publisher._id),
              note: publisherData.note || '',
            })
            continue
          }
          try {
            let producer
            // 检查出版社数据是否包含必需的 country 字段
            if (!publisherData.publisher.country) {
              throw new Error(`Country is required for publisher ${publisherData.publisher.name}`)
            }

            const existingProducer = await this.producerModel
              .findOne({
                name: publisherData.publisher.name,
              })
              .session(session)

            if (existingProducer) {
              producer = existingProducer
            } else {
              const id = await this.counterService.getNextSequence('producerId')
              const [newProducer] = await this.producerModel.create(
                [
                  {
                    id,
                    creator,
                    ...publisherData.publisher,
                    country: publisherData.publisher.country, // 确保包含 country 字段
                  },
                ],
                { session },
              )
              await this.editHistoryService.recordEditHistory({
                type: 'producer',
                actionType: 'create',
                entityId: new Types.ObjectId(newProducer._id as string),
                userId: new Types.ObjectId(creator.userId),
                userName: creator.name,
                changes: '创建了producer条目',
                previous: null,
                updated: newProducer.toObject(),
              })
              producer = newProducer
            }

            publisherIds.push({
              publisher: new Types.ObjectId(producer._id as string),
              note: publisherData.note || '',
            })
          } catch (error) {
            console.error('Error processing publisher:', error, publisherData)
            throw error
          }
        }
      }

      // 5. 处理文库（新增）
      let bunkoId = null
      if (bunko && !bunko._id) {
        try {
          if (!bunko.country) {
            throw new Error(`Country is required for bunko ${bunko.name}`)
          }

          const existingBunko = await this.producerModel
            .findOne({
              name: bunko.name,
            })
            .session(session)

          if (existingBunko) {
            bunkoId = new Types.ObjectId(existingBunko._id as string)
          } else {
            const id = await this.counterService.getNextSequence('producerId')
            const [newBunko] = await this.producerModel.create(
              [
                {
                  id,
                  creator,
                  ...bunko,
                  country: bunko.country,
                },
              ],
              { session },
            )
            await this.editHistoryService.recordEditHistory({
              type: 'producer',
              actionType: 'create',
              entityId: new Types.ObjectId(newBunko._id as string),
              userId: new Types.ObjectId(creator.userId),
              userName: creator.name,
              changes: '创建了producer条目',
              previous: null,
              updated: newBunko.toObject(),
            })
            bunkoId = new Types.ObjectId(newBunko._id as string)
          }
        } catch (error) {
          console.error('Error processing bunko:', error, bunko)
          throw error
        }
      } else {
        bunkoId = new Types.ObjectId(bunko._id)
      }

      // 6. 处理角色
      const characterLinks = []
      if (characters && characters.length > 0) {
        for (const characterData of characters) {
          if (characterData.character._id) {
            characterLinks.push({
              character: new Types.ObjectId(characterData.character._id),
              role: characterData.role || '主角',
            })
            continue
          }
          try {
            let character
            const processedLabels = characterData.character.labels.map(label => ({
              key: label.key,
              value: label.value || '未知',
            }))

            const existingCharacter = await this.characterModel
              .findOne({
                name: characterData.character.name,
              })
              .session(session)

            if (existingCharacter) {
              character = existingCharacter
            } else {
              const id = await this.counterService.getNextSequence('characterId')
              const [newCharacter] = await this.characterModel.create(
                [
                  {
                    id,
                    creator,
                    ...characterData.character,
                    labels: processedLabels,
                  },
                ],
                { session },
              )
              await this.editHistoryService.recordEditHistory({
                type: 'character',
                actionType: 'create',
                entityId: new Types.ObjectId(newCharacter._id as string),
                userId: new Types.ObjectId(creator.userId),
                userName: creator.name,
                changes: '创建了character条目',
                previous: null,
                updated: newCharacter.toObject(),
              })
              character = newCharacter
            }

            characterLinks.push({
              character: new Types.ObjectId(character._id as string),
              role: characterData.role,
            })
          } catch (error) {
            console.error('Error processing character:', error, characterData)
            throw error
          }
        }
      }

      // 7. 处理标签
      const tagIds = []
      if (tags && tags.length > 0) {
        for (const tagData of tags) {
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
                    creator,
                    name: tagData.tag.name,
                    aliases: tagData.tag.aliases || [],
                    description: tagData.tag.description,
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

      // 8. 创建轻小说主条目（不包含分卷信息）
      const novelId = await this.counterService.getNextSequence('novelId')
      const lightNovelData = {
        ...createLightNovelDto,
        novelId,
        author: authorId,
        illustrators: illustratorIds,
        publishers: publisherIds,
        bunko: bunkoId,
        characters: characterLinks,
        tags: tagIds,
        novelStatus,
        series: {
          currentVolume: 0,
          volumes: [],
        },
        creator,
        createdAt: new Date(),
        status:
          req.user.hikariUserGroup === 'admin' || req.user.hikariUserGroup === 'superAdmin'
            ? 'published'
            : 'pending',
      }

      const [newLightNovel] = await this.lightNovelModel.create([lightNovelData], { session })

      if (newLightNovel.status === 'pending') {
        const adminUsers = await this.userModel.find({
          hikariUserGroup: { $in: ['admin', 'superAdmin'] },
        })
        const adminUserIds = adminUsers.map(user => user._id)
        for (const adminUserId of adminUserIds) {
          await this.systemMessageService.sendSystemMessage({
            targetUser: new Types.ObjectId(adminUserId.toString()),
            title: '新轻小说条目等待审核',
            content: `新轻小说条目 ${newLightNovel.name_cn || newLightNovel.name} 等待审核`,
            type: SystemMessageType.SYSTEM,
            link: `/lightnovel/${newLightNovel.novelId}?preview=true`,
            linkText: '预览轻小说条目',
          })
        }
      }

      // 9. 更新关联信息
      // 更新作者关联
      if (authorId) {
        await this.personModel.findByIdAndUpdate(
          authorId,
          {
            $push: {
              works: {
                workType: 'LightNovel',
                work: newLightNovel._id,
              },
            },
          },
          { session },
        )
      }

      // 更新插画师关联
      for (const illustrator of illustratorIds) {
        await this.personModel.findByIdAndUpdate(
          illustrator.illustrator,
          {
            $push: {
              works: {
                workType: 'LightNovel',
                work: newLightNovel._id,
              },
            },
          },
          { session },
        )
      }

      // 更新出版社关联
      for (const publisher of publisherIds) {
        await this.producerModel.findByIdAndUpdate(
          publisher.publisher,
          {
            $push: {
              act: {
                work: { workId: newLightNovel._id, workType: 'LightNovel' },
              },
            },
          },
          { session },
        )
      }

      // 更新文库关联
      if (bunkoId) {
        await this.producerModel.findByIdAndUpdate(
          bunkoId,
          {
            $push: {
              works: {
                workType: 'LightNovel',
                work: newLightNovel._id,
              },
            },
          },
          { session },
        )
      }

      // 更新角色关联
      for (const char of characterLinks) {
        await this.characterModel.findByIdAndUpdate(
          char.character,
          {
            $push: {
              act: {
                work: {
                  workId: newLightNovel._id,
                  workType: 'LightNovel',
                },
              },
            },
          },
          { session },
        )
      }

      await this.editHistoryService.recordEditHistory({
        type: 'lightNovel',
        actionType: 'create',
        novelId: String(novelId),
        userId: new Types.ObjectId(req.user._id),
        userName: req.user.name,
        changes: '创建了小说条目',
        previous: null,
        updated: newLightNovel.toObject(),
      })

      await session.commitTransaction()

      return {
        novelId: newLightNovel.novelId,
      }
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      session.endSession()
    }
  }

  async getRandomLightNovel(req: RequestWithUser) {
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
    const lightNovel = await this.lightNovelModel.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: 'lightnovelvolumes',
          let: { seriesId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$seriesId', '$$seriesId'] }, { $eq: ['$status', 'published'] }],
                },
                hasEpub: true,
              },
            },
            { $limit: 1 },
          ],
          as: 'volumes',
        },
      },
      { $match: { 'volumes.0': { $exists: true } } },
      { $sample: { size: 1 } },
      { $project: { _id: 0, novelId: 1 } },
    ])
    return lightNovel[0].novelId
  }
}
