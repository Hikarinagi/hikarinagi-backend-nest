import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Character, CharacterDocument } from '../schemas/character.schema'
import { RequestWithUser } from '../../auth/interfaces/request-with-user.interface'
import { EditHistoryService } from '../../../common/services/edit-history.service'

@Injectable()
export class CharacterService {
  constructor(
    @InjectModel(Character.name) private characterModel: Model<CharacterDocument>,
    private readonly editHistoryService: EditHistoryService,
  ) {}

  async findById(id: number | string, req: RequestWithUser): Promise<Character | null> {
    if (isNaN(Number(id))) {
      throw new BadRequestException('id must be a number')
    }
    const rwaCharacter = await this.characterModel.findOne({ id })
    if (!rwaCharacter) {
      throw new NotFoundException('character not found')
    }

    let nsfw = false
    if (req.user && req.user.userSetting) {
      nsfw = req.user.userSetting.showNSFWContent
    }

    const characterAggregation = await this.characterModel.aggregate([
      // 匹配指定角色
      { $match: { id: Number(id) } },

      // 展开act数组以便处理声优和作品信息
      { $unwind: { path: '$act', preserveNullAndEmptyArrays: true } },

      // 关联声优信息
      {
        $lookup: {
          from: 'people',
          localField: 'act.person',
          foreignField: '_id',
          as: 'actorData',
        },
      },

      // 查找Galgame作品
      {
        $lookup: {
          from: 'galgames',
          let: {
            workId: '$act.work.workId',
            workType: '$act.work.workType',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$_id', '$$workId'] },
                    { $eq: ['$$workType', 'Galgame'] },
                    nsfw ? {} : { $ne: ['$nsfw', true] },
                  ],
                },
              },
            },
            // 关联producers
            {
              $lookup: {
                from: 'producers',
                localField: 'producers.producer',
                foreignField: '_id',
                as: 'producersData',
              },
            },
            // 关联tags
            {
              $lookup: {
                from: 'tags',
                localField: 'tags.tag',
                foreignField: '_id',
                as: 'tagsData',
              },
            },
            // 关联characters信息以获取cv
            {
              $lookup: {
                from: 'characters',
                localField: 'characters.character',
                foreignField: '_id',
                as: 'charactersData',
              },
            },
            // 获取评分数据
            {
              $lookup: {
                from: 'rates',
                let: { galgameId: '$_id' },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ['$fromId', '$$galgameId'] },
                          { $eq: ['$from', 'Galgame'] },
                          { $eq: ['$isDeleted', false] },
                        ],
                      },
                    },
                  },
                  {
                    $group: {
                      _id: null,
                      avgRate: { $avg: '$rate' },
                      rateCount: { $sum: 1 },
                    },
                  },
                ],
                as: 'rateData',
              },
            },
          ],
          as: 'galgameWork',
        },
      },

      // 查找LightNovel作品
      {
        $lookup: {
          from: 'lightnovels',
          let: {
            workId: '$act.work.workId',
            workType: '$act.work.workType',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$_id', '$$workId'] },
                    { $eq: ['$$workType', 'LightNovel'] },
                    nsfw ? {} : { $ne: ['$nsfw', true] },
                  ],
                },
              },
            },
            // 关联author
            {
              $lookup: {
                from: 'people',
                localField: 'author',
                foreignField: '_id',
                as: 'authorData',
              },
            },
            // 关联bunko
            {
              $lookup: {
                from: 'producers',
                localField: 'bunko',
                foreignField: '_id',
                as: 'bunkoData',
              },
            },
            // 关联publishers
            {
              $lookup: {
                from: 'producers',
                localField: 'publishers.publisher',
                foreignField: '_id',
                as: 'publishersData',
              },
            },
            // 关联characters信息以获取cv
            {
              $lookup: {
                from: 'characters',
                localField: 'characters.character',
                foreignField: '_id',
                as: 'charactersData',
              },
            },
            // 获取评分数据
            {
              $lookup: {
                from: 'rates',
                let: { novelId: '$_id' },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ['$fromId', '$$novelId'] },
                          { $eq: ['$from', 'LightNovel'] },
                          { $eq: ['$isDeleted', false] },
                        ],
                      },
                    },
                  },
                  {
                    $group: {
                      _id: null,
                      avgRate: { $avg: '$rate' },
                      rateCount: { $sum: 1 },
                    },
                  },
                ],
                as: 'rateData',
              },
            },
            // 获取第一卷发布日期
            {
              $lookup: {
                from: 'lightnovelvolumes',
                let: { novelId: '$_id' },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ['$seriesId', '$$novelId'] },
                          { $eq: ['$status', 'published'] },
                        ],
                      },
                    },
                  },
                  { $sort: { publicationDate: 1 } },
                  { $limit: 1 },
                  { $project: { publicationDate: 1 } },
                ],
                as: 'firstVolume',
              },
            },
          ],
          as: 'lightNovelWork',
        },
      },

      // 重新组合数据
      {
        $group: {
          _id: '$_id',
          characterData: { $first: '$$ROOT' },
          act: {
            $push: {
              $cond: [
                {
                  $or: [
                    { $gt: [{ $size: '$galgameWork' }, 0] },
                    { $gt: [{ $size: '$lightNovelWork' }, 0] },
                  ],
                },
                {
                  person: { $arrayElemAt: ['$actorData', 0] },
                  work: {
                    $cond: [
                      { $gt: [{ $size: '$galgameWork' }, 0] },
                      { $arrayElemAt: ['$galgameWork', 0] },
                      { $arrayElemAt: ['$lightNovelWork', 0] },
                    ],
                  },
                },
                null,
              ],
            },
          },
        },
      },

      // 过滤掉null的act条目
      {
        $addFields: {
          act: {
            $filter: {
              input: '$act',
              cond: { $ne: ['$$this', null] },
            },
          },
        },
      },
    ])

    const characterResult = characterAggregation[0]
    const character = characterResult.characterData
    const act = characterResult.act || []
    // 按作品releaseDate降序排列
    const sortedAct = act.sort((a, b) => {
      if (a.work && b.work) {
        return (
          new Date(b.work.releaseDate || b.work.publicationDate || '1970-01-01').getTime() -
          new Date(a.work.releaseDate || a.work.publicationDate || '1970-01-01').getTime()
        )
      }
      return 0
    })

    // 格式化act数据，保持work结构不变
    const formattedAct = sortedAct
      .map(actItem => {
        if (!actItem.work) return null
        const workData = actItem.work
        const characterId = character._id.toString()

        // 格式化声优信息
        const person = actItem.person
          ? {
              id: actItem.person.id,
              name: actItem.person.name,
              transName: actItem.person.transName,
            }
          : null

        // 从作品的characters数组中获取当前角色的role信息
        const getRoleFromWork = () => {
          if (!workData.characters || !Array.isArray(workData.characters)) {
            return '未知'
          }

          const characterEntry = workData.characters.find(
            char => char.character && char.character.toString() === characterId,
          )

          return characterEntry?.role || '未知'
        }

        const role = getRoleFromWork()

        // 判断作品类型并格式化作品数据
        let formattedWork
        if (workData.galId) {
          // Galgame作品
          const rateInfo = workData.rateData?.[0]
          formattedWork = {
            type: 'Galgame',
            galId: workData.galId,
            transTitle: workData.transTitle,
            originTitle: workData.originTitle,
            cover: workData.cover,
            releaseDate: workData.releaseDate,
            views: workData.views || 0,
            nsfw: workData.nsfw,
            rate: rateInfo?.avgRate || null,
            rateCount: rateInfo?.rateCount || 0,
            producers:
              workData.producersData?.map(p => ({
                producer: {
                  id: p.id,
                  name: p.name,
                  aliases: p.aliases,
                  logo: p.logo,
                },
              })) || [],
            tags: workData.tagsData?.map(t => t.name).filter(Boolean) || [],
            role: role,
            cv: person ? [person] : [],
          }
        } else {
          const rateInfo = workData.rateData?.[0]
          const publicationDate = workData.firstVolume?.[0]?.publicationDate
          formattedWork = {
            type: 'LightNovel',
            novelId: workData.novelId,
            name: workData.name,
            name_cn: workData.name_cn,
            cover: workData.cover,
            publicationDate: publicationDate,
            views: workData.views || 0,
            nsfw: workData.nsfw,
            rate: rateInfo?.avgRate || null,
            rateCount: rateInfo?.rateCount || 0,
            author: workData.authorData?.[0]
              ? {
                  id: workData.authorData[0].id,
                  name: workData.authorData[0].name,
                  transName: workData.authorData[0].transName,
                }
              : null,
            bunko: workData.bunkoData?.[0]
              ? {
                  id: workData.bunkoData[0].id,
                  name: workData.bunkoData[0].name,
                  transName: workData.bunkoData[0].transName,
                }
              : null,
            publishers: workData.publishersData?.[0]?.name || '未知',
            role: role,
            cv: person ? [person] : [],
          }
        }

        return {
          person: person,
          work: formattedWork,
        }
      })
      .filter(Boolean)

    const { contributors, createdBy, lastEditBy } = await this.editHistoryService.getContributors(
      'character',
      character.id,
    )

    const response = {
      ...character,
      act: formattedAct,
      contributors,
      createdBy,
      lastEditBy,
    }
    delete response.lightNovelWork
    delete response.galgameWork
    delete response.actorData

    return response
  }

  async findByName(name: string): Promise<Character | null> {
    return this.characterModel.findOne({ name }).exec()
  }
}
