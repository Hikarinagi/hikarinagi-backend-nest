import {
  BadRequestException,
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { Galgame, GalgameDocument } from '../../galgame/schemas/galgame.schema'
import { LightNovel, LightNovelDocument } from '../../novel/schemas/light-novel.schema'
import {
  LightNovelVolume,
  LightNovelVolumeDocument,
} from '../../novel/schemas/light-novel-volume.schema'
import { Producer, ProducerDocument } from '../../entities/schemas/producer.schema'
import { Person, PersonDocument } from '../../entities/schemas/person.schema'
import { Character, CharacterDocument } from '../../entities/schemas/character.schema'
import { User, UserDocument } from '../../user/schemas/user.schema'
import { EditHistoryService } from '../../../common/services/edit-history.service'
import { EntityRelationsSyncService } from '../../../common/services/entity-relations-sync.service'
import { EntityType } from '../dto/create-update-request.dto'
import { SystemMessageService } from '../../../modules/message/services/system-message.service'
import { MergeUpdateRequestDto } from '../dto/merge-update-request.dto'
import { SystemMessageType } from '../../message/dto/send-system-message.dto'

interface UpdateItemParams {
  itemType?: EntityType
  itemId: Types.ObjectId
  mergeData: Record<string, any>
  processedBy: Types.ObjectId
  requestedBy: Types.ObjectId
}

@Injectable()
export class UpdateRequestMergeService {
  constructor(
    @InjectModel(Galgame.name) private galgameModel: Model<GalgameDocument>,
    @InjectModel(LightNovel.name) private lightNovelModel: Model<LightNovelDocument>,
    @InjectModel(LightNovelVolume.name)
    private lightNovelVolumeModel: Model<LightNovelVolumeDocument>,
    @InjectModel(Producer.name) private producerModel: Model<ProducerDocument>,
    @InjectModel(Person.name) private personModel: Model<PersonDocument>,
    @InjectModel(Character.name) private characterModel: Model<CharacterDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private editHistoryService: EditHistoryService,
    private entityRelationsSyncService: EntityRelationsSyncService,
    private systemMessageService: SystemMessageService,
  ) {}

  async mergeUpdateRequest(mergeUpdateRequestDto: MergeUpdateRequestDto) {
    const { itemType, itemId, mergeData, processedBy, requestedBy } = mergeUpdateRequestDto

    switch (itemType) {
      case EntityType.Galgame:
        await this.updateGalgame({
          itemId,
          mergeData,
          processedBy,
          requestedBy,
        })
        break
      case EntityType.LightNovel:
        await this.updateLightNovel({
          itemId,
          mergeData,
          processedBy,
          requestedBy,
        })
        break
      case EntityType.LightNovelVolume:
        await this.updateLightNovelVolume({
          itemId,
          mergeData,
          processedBy,
          requestedBy,
        })
        break
      case EntityType.Producer:
      case EntityType.Person:
      case EntityType.Character:
        await this.updateEntity({
          itemType,
          itemId,
          mergeData,
          processedBy,
          requestedBy,
        })
        break
    }
  }

  private async updateGalgame(params: UpdateItemParams) {
    const requestedUser = await this.userModel.findById(params.requestedBy)
    const processedUser = await this.userModel.findById(params.processedBy)

    // 验证必填字段
    const requiredFields = [
      'cover',
      'transTitle',
      'originTitle',
      'producers',
      'releaseDate',
      'releaseDateTBD',
      'tags',
      'originIntro',
      'transIntro',
      'staffs',
      'characters',
      'images',
      'nsfw',
      'status',
    ]
    if (!params.mergeData.releaseDateTBD) {
      params.mergeData.releaseDateTBD = false
    }
    const missingFields = requiredFields.filter(field => params.mergeData[field] === undefined)
    if (missingFields.length > 0) {
      throw new BadRequestException(`Missing required fields: ${missingFields.join(', ')}`)
    }

    // 验证输入数据类型
    if (
      params.mergeData.producers &&
      (!Array.isArray(params.mergeData.producers) ||
        !params.mergeData.producers.every(p => p && p._id))
    ) {
      throw new BadRequestException('invalid producers format')
    }
    if (
      params.mergeData.tags &&
      (!Array.isArray(params.mergeData.tags) || !params.mergeData.tags.every(t => t && t._id))
    ) {
      throw new BadRequestException('invalid tags format')
    }
    if (
      params.mergeData.staffs &&
      (!Array.isArray(params.mergeData.staffs) ||
        !params.mergeData.staffs.every(s => s && s._id && s.role))
    ) {
      throw new BadRequestException('invalid staffs format')
    }
    if (
      params.mergeData.characters &&
      (!Array.isArray(params.mergeData.characters) ||
        !params.mergeData.characters.every(c => c && c._id && c.role))
    ) {
      throw new BadRequestException('invalid characters format')
    }

    const originalGalgame = await this.galgameModel.findById(params.itemId)
    if (!originalGalgame) {
      throw new NotFoundException('Galgame not found')
    }

    const updateData: any = {
      cover: params.mergeData.cover,
      headCover: params.mergeData.headCover,
      transTitle: params.mergeData.transTitle,
      originTitle: params.mergeData.originTitle,
      releaseDate: params.mergeData.releaseDate,
      releaseDateTBD: params.mergeData.releaseDateTBD,
      releaseDateTBDNote: params.mergeData.releaseDateTBDNote,
      originIntro: params.mergeData.originIntro,
      transIntro: params.mergeData.transIntro,
      images: params.mergeData.images,
      homepage: params.mergeData.homepage,
      price: params.mergeData.price,
      platform: params.mergeData.platform,
      advType: params.mergeData.advType,
      nsfw: params.mergeData.nsfw,
      status: params.mergeData.status,
    }

    if (params.mergeData.downloadInfo) {
      const newDownloadInfo = { ...params.mergeData.downloadInfo }
      newDownloadInfo.viewTimes = originalGalgame.downloadInfo.viewTimes || 0
      newDownloadInfo.downloadTimes = originalGalgame.downloadInfo.downloadTimes || 0
      updateData.downloadInfo = newDownloadInfo
    }

    if (params.mergeData.producers && Array.isArray(params.mergeData.producers)) {
      updateData.producers = params.mergeData.producers.map(producer => ({
        producer: new Types.ObjectId(producer._id as string),
        note: producer.note || '',
      }))
    }

    if (params.mergeData.tags && Array.isArray(params.mergeData.tags)) {
      updateData.tags = params.mergeData.tags.map(tag => ({
        tag: new Types.ObjectId(tag._id as string),
      }))
    }

    if (params.mergeData.staffs && Array.isArray(params.mergeData.staffs)) {
      updateData.staffs = params.mergeData.staffs.map(staff => ({
        person: new Types.ObjectId(staff._id as string),
        role: staff.role,
      }))
    }

    if (params.mergeData.characters && Array.isArray(params.mergeData.characters)) {
      updateData.characters = params.mergeData.characters.map(character => ({
        character: new Types.ObjectId(character._id as string),
        role: character.role,
      }))

      // 批量更新角色的 act 字段
      const characterUpdates = params.mergeData.characters.map(async charDto => {
        const characterDoc = await this.characterModel.findById(charDto._id).exec()
        if (characterDoc) {
          // 保留其他作品的 act 条目
          const otherWorkActs =
            characterDoc.act?.filter(
              act => act.work.workId.toString() !== params.itemId.toString(),
            ) || []

          // 处理当前作品的声优条目
          let currentWorkActs = []
          if (charDto.act && charDto.act.length > 0) {
            const currentWorkActsFromDto = charDto.act.filter(
              act =>
                act.work &&
                act.work.workId &&
                act.work.workId.toString() === params.itemId.toString(),
            )
            if (currentWorkActsFromDto.length > 0) {
              const newActs = currentWorkActsFromDto.map(act => ({
                person:
                  act.person && Types.ObjectId.isValid(act.person)
                    ? new Types.ObjectId(act.person)
                    : null,
                work: {
                  workId: new Types.ObjectId(params.itemId),
                  workType: 'Galgame',
                },
              }))

              currentWorkActs = newActs.filter(
                (newAct, index, self) =>
                  index ===
                  self.findIndex(
                    act =>
                      (act.person?.toString() || null) === (newAct.person?.toString() || null) &&
                      act.work.workId.toString() === newAct.work.workId.toString(),
                  ),
              )
            } else {
              currentWorkActs = [
                {
                  person: null,
                  work: {
                    workId: new Types.ObjectId(params.itemId),
                    workType: 'Galgame',
                  },
                },
              ]
            }
          } else {
            currentWorkActs = [
              {
                person: null,
                work: {
                  workId: new Types.ObjectId(params.itemId),
                  workType: 'Galgame',
                },
              },
            ]
          }

          // 更新角色的act数组
          characterDoc.act = [...otherWorkActs, ...currentWorkActs]
          return characterDoc.save()
        }
      })

      // 等待所有角色更新完成
      await Promise.all(characterUpdates.filter(Boolean))
    }

    // 可选字段处理
    if (params.mergeData.vndbId !== undefined) updateData.vndbId = params.mergeData.vndbId
    if (params.mergeData.bangumiGameId !== undefined)
      updateData.bangumiGameId = params.mergeData.bangumiGameId
    if (params.mergeData.locked !== undefined) updateData.locked = params.mergeData.locked

    const updatedGalgame = await this.galgameModel.findByIdAndUpdate(params.itemId, updateData, {
      new: true,
    })

    if (!updatedGalgame) {
      throw new InternalServerErrorException('Failed to update galgame')
    }

    await this.entityRelationsSyncService.syncEntityRelations({
      originalData: originalGalgame,
      newData: updatedGalgame,
      workType: 'Galgame',
    })
    await this.editHistoryService.recordEditHistory({
      type: 'galgame',
      actionType: 'update',
      galId: updatedGalgame.galId,
      userId: params.requestedBy,
      userName: requestedUser.name,
      changes: '更新了游戏条目',
      previous: originalGalgame.toObject(),
      updated: updatedGalgame.toObject(),
    })
    await this.systemMessageService.sendSystemMessage({
      targetUser: params.requestedBy,
      title: '更新请求已处理',
      content: `您的更新请求已被处理。
      <br>条目类型: Galgame
      <br>条目ID: ${updatedGalgame.galId}
      <br>条目名称: ${updatedGalgame.transTitle || updatedGalgame.originTitle[0]}
      <br>处理人: ${processedUser.name}
      <br>处理时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`,
      type: SystemMessageType.SYSTEM,
      link: `/galgame/${updatedGalgame.galId}`,
      linkText: '查看条目',
    })
  }

  private async updateLightNovel(params: UpdateItemParams) {
    const requestedUser = await this.userModel.findById(params.requestedBy)
    const processedUser = await this.userModel.findById(params.processedBy)

    const requiredFields = [
      'cover',
      'name',
      'name_cn',
      'summary',
      'summary_cn',
      'author',
      'publishers',
      'characters',
      'bunko',
      'illustrators',
      'tags',
      'series',
      'novelStatus',
      'nsfw',
      'status',
    ]
    const missingFields = requiredFields.filter(field => params.mergeData[field] === undefined)
    if (missingFields.length > 0) {
      throw new BadRequestException(`Missing required fields: ${missingFields.join(', ')}`)
    }

    if (params.mergeData.author && !params.mergeData.author._id) {
      throw new BadRequestException('invalid author format')
    }
    if (
      params.mergeData.publishers &&
      (!Array.isArray(params.mergeData.publishers) ||
        !params.mergeData.publishers.every(p => p && p._id))
    ) {
      throw new BadRequestException('invalid publishers format')
    }
    if (params.mergeData.bunko && !params.mergeData.bunko._id) {
      throw new BadRequestException('invalid bunko format')
    }
    if (
      params.mergeData.characters &&
      (!Array.isArray(params.mergeData.characters) ||
        !params.mergeData.characters.every(c => c && c._id && c.role))
    ) {
      throw new BadRequestException('invalid characters format')
    }
    if (
      params.mergeData.illustrators &&
      (!Array.isArray(params.mergeData.illustrators) ||
        !params.mergeData.illustrators.every(i => i && i._id))
    ) {
      throw new BadRequestException('invalid illustrators format')
    }
    if (
      params.mergeData.tags &&
      (!Array.isArray(params.mergeData.tags) || !params.mergeData.tags.every(t => t && t._id))
    ) {
      throw new BadRequestException('invalid tags format')
    }
    if (
      params.mergeData.series &&
      (!Array.isArray(params.mergeData.series.volumes) ||
        !params.mergeData.series.volumes.every(v => (v && v._id) || typeof v === 'string'))
    ) {
      throw new BadRequestException('invalid series format')
    }

    const originalLightNovel = await this.lightNovelModel.findById(params.itemId)
    if (!originalLightNovel) {
      throw new NotFoundException('Light novel not found')
    }

    const updateData: any = {
      cover: params.mergeData.cover,
      name: params.mergeData.name,
      name_cn: params.mergeData.name_cn,
      summary: params.mergeData.summary,
      summary_cn: params.mergeData.summary_cn,
      novelStatus: params.mergeData.novelStatus,
      nsfw: params.mergeData.nsfw,
      status: params.mergeData.status,
    }
    if (params.mergeData.author) {
      updateData.author = new Types.ObjectId(params.mergeData.author._id as string)
    }
    if (params.mergeData.publishers) {
      updateData.publishers = params.mergeData.publishers.map(publisher => ({
        publisher: new Types.ObjectId(publisher._id as string),
        note: publisher.note,
      }))
    }
    if (params.mergeData.bunko) {
      updateData.bunko = new Types.ObjectId(params.mergeData.bunko._id as string)
    }
    if (params.mergeData.characters) {
      updateData.characters = params.mergeData.characters.map(character => ({
        character: new Types.ObjectId(character._id as string),
        role: character.role,
      }))

      const characterUpdates = params.mergeData.characters.map(async charDto => {
        const characterDoc = await this.characterModel.findById(charDto._id).exec()
        if (!characterDoc) return

        // 过滤掉其他作品的act条目
        const otherWorkActs =
          characterDoc.act?.filter(
            act =>
              !(
                act.work &&
                act.work.workId &&
                act.work.workId.toString() === params.itemId.toString()
              ),
          ) || []

        // 处理当前作品的条目
        let currentWorkActs = []
        if (charDto.act && charDto.act.length > 0) {
          const currentWorkActsFromDto = charDto.act.filter(
            act =>
              act.work &&
              act.work.workId &&
              act.work.workId.toString() === params.itemId.toString(),
          )
          if (currentWorkActsFromDto.length > 0) {
            const newActs = currentWorkActsFromDto.map(() => ({
              person: null,
              work: {
                workId: new Types.ObjectId(params.itemId),
                workType: 'LightNovel',
              },
            }))

            currentWorkActs = newActs.filter(
              (newAct, index, self) =>
                index ===
                self.findIndex(act => act.work.workId.toString() === newAct.work.workId.toString()),
            )
          } else {
            currentWorkActs = [
              {
                person: null,
                work: {
                  workId: new Types.ObjectId(params.itemId),
                  workType: 'LightNovel',
                },
              },
            ]
          }
        } else {
          currentWorkActs = [
            {
              person: null,
              work: {
                workId: new Types.ObjectId(params.itemId),
                workType: 'LightNovel',
              },
            },
          ]
        }

        characterDoc.act = [...otherWorkActs, ...currentWorkActs]
        return characterDoc.save()
      })

      await Promise.all(characterUpdates.filter(Boolean))
    }
    if (params.mergeData.illustrators) {
      updateData.illustrators = params.mergeData.illustrators.map(illustrator => ({
        illustrator: new Types.ObjectId(illustrator._id as string),
        note: illustrator.note,
      }))
    }
    if (params.mergeData.tags && Array.isArray(params.mergeData.tags)) {
      updateData.tags = params.mergeData.tags.map(tag => ({
        tag: new Types.ObjectId(tag._id as string),
      }))
    }
    if (params.mergeData.series) {
      const volumes = params.mergeData.series.volumes.map(volume =>
        volume._id ? new Types.ObjectId(volume._id as string) : volume,
      )
      updateData.series = {
        totalVolumes: params.mergeData.series.totalVolumes || null,
        volumes,
      }
    }

    if (params.mergeData.bangumiGameId !== undefined)
      updateData.bangumiGameId = params.mergeData.bangumiGameId
    if (params.mergeData.locked !== undefined) updateData.locked = params.mergeData.locked

    const updatedLightNovel = await this.lightNovelModel.findByIdAndUpdate(
      params.itemId,
      updateData,
      { new: true },
    )

    if (!updatedLightNovel) {
      throw new InternalServerErrorException('Failed to update light novel')
    }

    if (params.mergeData.series && params.mergeData.series.volumes) {
      params.mergeData.series.volumes.forEach(
        async (volume: { status: any; _id: Types.ObjectId }) => {
          if (volume.status) {
            await this.lightNovelVolumeModel.findByIdAndUpdate(
              volume._id,
              { status: volume.status },
              { timestamps: false },
            )
          }
        },
      )
    }

    await this.entityRelationsSyncService.syncEntityRelations({
      originalData: originalLightNovel,
      newData: updatedLightNovel,
      workType: 'LightNovel',
    })
    await this.editHistoryService.recordEditHistory({
      type: 'lightNovel',
      actionType: 'update',
      novelId: String(updatedLightNovel.novelId),
      userId: params.requestedBy,
      userName: requestedUser.name,
      changes: '更新了轻小说条目',
      previous: originalLightNovel.toObject(),
      updated: updatedLightNovel.toObject(),
    })
    await this.systemMessageService.sendSystemMessage({
      targetUser: params.requestedBy,
      title: '更新请求已处理',
      content: `您的更新请求已被处理。
      <br>条目类型: LightNovel
      <br>条目ID: ${updatedLightNovel.novelId}
      <br>条目名称: ${updatedLightNovel.name}
      <br>处理人: ${processedUser.name}
      <br>处理时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`,
      type: SystemMessageType.SYSTEM,
      link: `/lightnovel/${updatedLightNovel.novelId}`,
      linkText: '查看条目',
    })
  }

  private async updateLightNovelVolume(params: UpdateItemParams) {
    const requestedUser = await this.userModel.findById(params.requestedBy)
    const processedUser = await this.userModel.findById(params.processedBy)

    const requiredFields = [
      'cover',
      'name',
      'name_cn',
      'summary',
      'summary_cn',
      'volumeType',
      'volumeNumber',
      'publicationDate',
      'isbn',
      'price',
      'pages',
      'status',
      'hasEpub',
    ]
    const missingFields = requiredFields.filter(field => params.mergeData[field] === undefined)
    if (missingFields.length > 0) {
      throw new BadRequestException(`Missing required fields: ${missingFields.join(', ')}`)
    }

    if (params.mergeData.volumeType && !['main', 'extra'].includes(params.mergeData.volumeType)) {
      throw new BadRequestException('Invalid volumeType format, must be "main" or "extra"')
    }

    if (
      params.mergeData.price &&
      ((!params.mergeData.price.amount && params.mergeData.price.amount !== 0) ||
        !params.mergeData.price.currency)
    ) {
      throw new BadRequestException('Invalid price format, must include amount and currency')
    }

    const originalLightNovelVolume = await this.lightNovelVolumeModel.findById(params.itemId)
    if (!originalLightNovelVolume) {
      throw new NotFoundException('Light novel volume not found')
    }

    const updateData: any = {
      cover: params.mergeData.cover,
      name: params.mergeData.name,
      name_cn: params.mergeData.name_cn,
      summary: params.mergeData.summary,
      summary_cn: params.mergeData.summary_cn,
      volumeType: params.mergeData.volumeType,
      volumeNumber: params.mergeData.volumeNumber,
      volumeExtraName: params.mergeData.volumeExtraName,
      isbn: params.mergeData.isbn,
      price: params.mergeData.price,
      publicationDate: params.mergeData.publicationDate,
      pages: params.mergeData.pages,
      status: params.mergeData.status,
      hasEpub: params.mergeData.hasEpub,
    }

    if (params.mergeData.volumeExtraName !== undefined)
      updateData.volumeExtraName = params.mergeData.volumeExtraName
    if (params.mergeData.bangumiBookId !== undefined)
      updateData.bangumiBookId = params.mergeData.bangumiBookId
    if (params.mergeData.relation !== undefined) updateData.relation = params.mergeData.relation

    const updatedLightNovelVolume = await this.lightNovelVolumeModel.findByIdAndUpdate(
      params.itemId,
      updateData,
      { new: true },
    )

    if (!updatedLightNovelVolume) {
      throw new InternalServerErrorException('Failed to update light novel volume')
    }

    await this.editHistoryService.recordEditHistory({
      type: 'LightNovelVolume',
      actionType: 'update',
      volumeId: String(updatedLightNovelVolume.volumeId),
      userId: params.requestedBy,
      userName: requestedUser.name,
      changes: '更新了轻小说卷条目',
      previous: originalLightNovelVolume.toObject(),
      updated: updatedLightNovelVolume.toObject(),
    })
    await this.systemMessageService.sendSystemMessage({
      targetUser: params.requestedBy,
      title: '更新请求已处理',
      content: `您的更新请求已被处理。
      <br>条目类型: 轻小说卷
      <br>条目ID: ${updatedLightNovelVolume.volumeId}
      <br>条目名称: ${updatedLightNovelVolume.name || updatedLightNovelVolume.name_cn}
      <br>处理人: ${processedUser.name}
      <br>处理时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`,
      type: SystemMessageType.SYSTEM,
      link: `/lightnovel/volumes/${updatedLightNovelVolume.volumeId}`,
      linkText: '查看条目',
    })
  }

  private async updateEntity(params: UpdateItemParams) {
    const requestedUser = await this.userModel.findById(params.requestedBy)
    const processedUser = await this.userModel.findById(params.processedBy)

    const getModel = (entityType: EntityType): Model<any> => {
      switch (entityType) {
        case 'Person':
          return this.personModel
        case 'Producer':
          return this.producerModel
        case 'Character':
          return this.characterModel
        default:
          throw new BadRequestException('Invalid entity type')
      }
    }

    const Model = getModel(params.itemType)
    if (!Model) {
      throw new BadRequestException('Invalid entity type')
    }
    const entity = await Model.findById(params.itemId)
    if (!entity) {
      throw new NotFoundException('Entity not found')
    }

    const protectedFields = ['id', 'creator', 'createdAt']
    protectedFields.forEach(field => delete params.mergeData[field])

    const updateData = { ...params.mergeData }

    if (params.itemType.toLowerCase() === 'character') {
      // 处理角色关系
      if (params.mergeData.relations && Array.isArray(params.mergeData.relations)) {
        updateData.relations = params.mergeData.relations.map(relation => ({
          character: relation.character, // _id
          relation: relation.relation,
        }))
      }
    }

    // 更新实体
    await Model.findByIdAndUpdate(params.itemId, { $set: updateData }, { new: true })

    await entity.populate([
      {
        path: 'creator.userId',
        select: 'name avatar userId -_id',
      },
    ])
    if (params.itemType.toLowerCase() === 'character') {
      await entity.populate([
        {
          path: 'relations.character',
          select: 'name transName image',
        },
      ])
    }

    const result = entity.toObject()

    if (params.itemType.toLowerCase() !== 'tag') {
      await this.editHistoryService.recordEditHistory({
        type: params.itemType.toLowerCase() as 'person' | 'producer' | 'character',
        actionType: 'update',
        entityId: new Types.ObjectId(entity._id as string),
        userId: params.requestedBy,
        userName: requestedUser.name,
        changes: `更新了${params.itemType.toLowerCase()}条目`,
        previous: entity.toObject(),
        updated: result,
      })
    }

    await this.systemMessageService.sendSystemMessage({
      targetUser: params.requestedBy,
      title: '更新请求已处理',
      content: `您的更新请求已被处理。
      <br>条目类型: ${params.itemType.toLowerCase()}
      <br>条目ID: ${entity.id}
      <br>条目名称: ${entity.name || entity.transName}
      <br>处理人: ${processedUser.name}
      <br>处理时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`,
      type: SystemMessageType.SYSTEM,
      link: `/${params.itemType.toLowerCase()}/${entity.id}`,
      linkText: '查看条目',
    })
  }
}
