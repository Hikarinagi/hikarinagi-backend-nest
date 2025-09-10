import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Person, PersonDocument } from '../schemas/person.schema'
import { EditHistoryService } from '../../../common/services/edit-history.service'
import { RequestWithUser } from '../../auth/interfaces/request-with-user.interface'

@Injectable()
export class PersonService {
  constructor(
    @InjectModel(Person.name) private personModel: Model<PersonDocument>,
    private readonly editHistoryService: EditHistoryService,
  ) {}

  async findById(id: number, req: RequestWithUser): Promise<any> {
    if (isNaN(Number(id))) {
      throw new BadRequestException('id must be a number')
    }

    const personExists = await this.personModel.findOne({ id }).lean()
    if (!personExists) {
      throw new NotFoundException(`Person with id ${id} not found`)
    }

    let nsfw = false
    if (req.user && req.user.userSetting) {
      nsfw = req.user.userSetting.showNSFWContent
    }

    const personAggregation = await this.personModel.aggregate([
      // 匹配指定人员
      { $match: { id: Number(id) } },

      // 展开works数组
      { $unwind: { path: '$works', preserveNullAndEmptyArrays: true } },

      // 查找Galgame作品
      {
        $lookup: {
          from: 'galgames',
          let: {
            workId: '$works.work',
            workType: '$works.workType',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$_id', '$$workId'] },
                    { $eq: ['$$workType', 'Galgame'] },
                    ...(nsfw ? [] : [{ $ne: ['$nsfw', true] }]),
                  ],
                },
              },
            },
            // 关联制作商信息
            {
              $lookup: {
                from: 'producers',
                localField: 'producers.producer',
                foreignField: '_id',
                as: 'producerDetails',
              },
            },
            // 关联标签信息
            {
              $lookup: {
                from: 'tags',
                localField: 'tags.tag',
                foreignField: '_id',
                as: 'tagDetails',
              },
            },
            // 关联角色信息
            {
              $lookup: {
                from: 'characters',
                localField: 'characters.character',
                foreignField: '_id',
                as: 'charactersData',
              },
            },
            // 关联评分信息
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
                  {
                    $group: {
                      _id: '$fromId',
                      avgRate: { $avg: '$rate' },
                      rateCount: { $sum: 1 },
                    },
                  },
                ],
                as: 'rateData',
              },
            },
            {
              $project: {
                galId: 1,
                transTitle: 1,
                originTitle: 1,
                cover: 1,
                releaseDate: 1,
                views: 1,
                nsfw: 1,
                staffs: 1,
                characters: 1,
                producerDetails: 1,
                tagDetails: 1,
                charactersData: 1,
                rateData: 1,
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
            workId: '$works.work',
            workType: '$works.workType',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$_id', '$$workId'] },
                    { $eq: ['$$workType', 'LightNovel'] },
                    ...(nsfw ? [] : [{ $ne: ['$nsfw', true] }]),
                  ],
                },
              },
            },
            // 关联作者信息
            {
              $lookup: {
                from: 'people',
                localField: 'author',
                foreignField: '_id',
                as: 'authorData',
              },
            },
            // 关联插画师信息
            {
              $lookup: {
                from: 'people',
                localField: 'illustrators.illustrator',
                foreignField: '_id',
                as: 'illustratorsData',
              },
            },
            // 关联文库信息
            {
              $lookup: {
                from: 'producers',
                localField: 'bunko',
                foreignField: '_id',
                as: 'bunkoData',
              },
            },
            // 关联出版商信息
            {
              $lookup: {
                from: 'producers',
                localField: 'publishers.publisher',
                foreignField: '_id',
                as: 'publishersData',
              },
            },
            // 关联标签信息
            {
              $lookup: {
                from: 'tags',
                localField: 'tags.tag',
                foreignField: '_id',
                as: 'tagDetails',
              },
            },
            // 关联评分信息
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
                          { $eq: ['$isDeleted', false] },
                        ],
                      },
                    },
                  },
                  {
                    $group: {
                      _id: '$fromId',
                      avgRate: { $avg: '$rate' },
                      rateCount: { $sum: 1 },
                    },
                  },
                ],
                as: 'rateData',
              },
            },
            // 获取第一卷作为发布日期
            {
              $lookup: {
                from: 'lightnovelvolumes',
                localField: '_id',
                foreignField: 'seriesId',
                as: 'firstVolume',
                pipeline: [
                  { $sort: { volumeNumber: 1 } },
                  { $limit: 1 },
                  { $project: { publicationDate: 1 } },
                ],
              },
            },
            {
              $project: {
                novelId: 1,
                name: 1,
                name_cn: 1,
                cover: 1,
                views: 1,
                nsfw: 1,
                authorData: 1,
                illustratorsData: 1,
                bunkoData: 1,
                publishersData: 1,
                tagDetails: 1,
                rateData: 1,
                firstVolume: 1,
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
          id: { $first: '$id' },
          name: { $first: '$name' },
          transName: { $first: '$transName' },
          aliases: { $first: '$aliases' },
          intro: { $first: '$intro' },
          transIntro: { $first: '$transIntro' },
          image: { $first: '$image' },
          labels: { $first: '$labels' },
          status: { $first: '$status' },
          works: {
            $push: {
              $cond: {
                if: { $ne: ['$works', null] },
                then: {
                  workType: '$works.workType',
                  galgameWork: '$galgameWork',
                  lightNovelWork: '$lightNovelWork',
                },
                else: '$$REMOVE',
              },
            },
          },
        },
      },
    ])

    if (!personAggregation || personAggregation.length === 0) {
      throw new NotFoundException(`Person with id ${id} not found`)
    }

    const personData = personAggregation[0]

    const worksToDelete = []

    const workIdMap = new Map()
    const duplicateWorks = []

    personData.works.forEach(workItem => {
      if (workItem.workType === 'Galgame' && workItem.galgameWork?.[0]) {
        const workId = workItem.galgameWork[0]._id.toString()
        if (workIdMap.has(workId)) {
          duplicateWorks.push({
            work: workItem.galgameWork[0]._id,
            workType: 'Galgame',
          })
        } else {
          workIdMap.set(workId, true)
        }
      } else if (workItem.workType === 'LightNovel' && workItem.lightNovelWork?.[0]) {
        const workId = workItem.lightNovelWork[0]._id.toString()
        if (workIdMap.has(workId)) {
          duplicateWorks.push({
            work: workItem.lightNovelWork[0]._id,
            workType: 'LightNovel',
          })
        } else {
          workIdMap.set(workId, true)
        }
      }
    })

    worksToDelete.push(...duplicateWorks)

    // 格式化works数据，并按发布日期降序排列
    const formattedWorks = personData.works
      .map(workItem => {
        let formattedWork = null

        if (workItem.workType === 'Galgame' && workItem.galgameWork?.[0]) {
          const work = workItem.galgameWork[0]
          const rateInfo = work.rateData?.[0]
          const personId = personData._id.toString()

          // 查找该 person 在 staffs 中的所有角色
          const staffRoles = []
          if (work.staffs && Array.isArray(work.staffs)) {
            work.staffs.forEach(staff => {
              if (staff.person && staff.person.toString() === personId) {
                if (staff.role) {
                  staffRoles.push(staff.role)
                }
              }
            })
          }

          // 查找该 person 配音的角色
          const voicedCharacters = []
          if (work.charactersData && Array.isArray(work.charactersData)) {
            work.charactersData.forEach(char => {
              if (char.act && Array.isArray(char.act)) {
                const hasActor = char.act.some(
                  actItem =>
                    actItem.person &&
                    actItem.person.toString() === personId &&
                    actItem.work &&
                    actItem.work.workType === 'Galgame' &&
                    actItem.work.workId.toString() === work._id.toString(),
                )
                if (hasActor) {
                  voicedCharacters.push({
                    id: char.id,
                    name: char.name,
                    transName: char.transName,
                    image: char.image,
                  })
                }
              }
            })
          }

          const roleInfo = {
            roles: [...staffRoles],
            voicedRoles: [],
          }

          if (voicedCharacters.length > 0) {
            roleInfo.roles.push('配音')
            roleInfo.voicedRoles = voicedCharacters.map(char => char.name)
          }

          if (roleInfo.roles.length === 0) {
            worksToDelete.push({ work: work._id, workType: 'Galgame' })
            return null
          }

          formattedWork = {
            type: 'Galgame',
            galId: work.galId,
            transTitle: work.transTitle,
            originTitle: work.originTitle,
            cover: work.cover,
            releaseDate: work.releaseDate,
            views: work.views || 0,
            nsfw: work.nsfw,
            rate: rateInfo?.avgRate || null,
            rateCount: rateInfo?.rateCount || 0,
            producers:
              work.producerDetails?.map(producer => ({
                producer: {
                  id: producer.id,
                  name: producer.name,
                  aliases: producer.aliases,
                  logo: producer.logo,
                },
              })) || [],
            tags: work.tagDetails?.map(tag => tag.name) || [],
            role: roleInfo.roles.length > 0 ? roleInfo.roles.join('、') : '未知',
            voicedCharacters,
          }
        } else if (workItem.workType === 'LightNovel' && workItem.lightNovelWork?.[0]) {
          const work = workItem.lightNovelWork[0]
          const rateInfo = work.rateData?.[0]
          const publicationDate = work.firstVolume?.[0]?.publicationDate
          const personId = personData._id.toString()

          // 查找该 person 在 LightNovel 中的角色
          const roles = []
          if (work.authorData?.[0]?._id.toString() === personId) {
            roles.push('作者')
          }
          if (work.illustratorsData?.some(ill => ill._id.toString() === personId)) {
            roles.push('插画')
          }

          formattedWork = {
            type: 'LightNovel',
            novelId: work.novelId,
            name: work.name,
            name_cn: work.name_cn,
            cover: work.cover,
            publicationDate: publicationDate,
            views: work.views || 0,
            nsfw: work.nsfw,
            rate: rateInfo?.avgRate || null,
            rateCount: rateInfo?.rateCount || 0,
            author: work.authorData?.[0]
              ? {
                  id: work.authorData[0].id,
                  name: work.authorData[0].name,
                  transName: work.authorData[0].transName,
                }
              : null,
            bunko: work.bunkoData?.[0]
              ? {
                  id: work.bunkoData[0].id,
                  name: work.bunkoData[0].name,
                  transName: work.bunkoData[0].transName,
                }
              : null,
            publishers: work.publishersData?.[0]?.name || '未知',
            tags: work.tagDetails?.map(tag => tag.name) || [],
            role: roles.length > 0 ? roles.join('、') : '未知',
          }
        }

        return formattedWork
      })
      .filter(Boolean)
      .sort((a, b) => {
        const dateA = a.releaseDate || a.publicationDate || '0'
        const dateB = b.releaseDate || b.publicationDate || '0'
        return new Date(dateB).getTime() - new Date(dateA).getTime()
      })

    if (worksToDelete.length > 0) {
      await this.personModel.updateOne(
        { id: Number(id) },
        { $pull: { works: { $or: worksToDelete } } },
      )
    }

    const { contributors, createdBy, lastEditBy } = await this.editHistoryService.getContributors(
      'person',
      personData.id,
    )

    const response = {
      ...personData,
      works: formattedWorks,
      contributors,
      createdBy,
      lastEditBy,
    }

    return response
  }
}
