import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { Galgame, GalgameDocument } from '../../galgame/schemas/galgame.schema'
import { UpdateRequest, UpdateRequestDocument } from '../../shared/schemas/update-request.schema'
import { UpdateRequestService } from '../../shared/services/update-request.service'
import { UpdateGalgameDto } from '../dto/galgame/update-galgame.dto'
import { RequestWithUser } from '../../auth/interfaces/request-with-user.interface'
import { EntityType } from '../../shared/dto/create-update-request.dto'
import { HikariUserGroup } from '../../auth/enums/hikari-user-group.enum'

@Injectable()
export class GalgameManagementService {
  constructor(
    @InjectModel(Galgame.name) private galgameModel: Model<GalgameDocument>,
    @InjectModel(UpdateRequest.name) private updateRequestModel: Model<UpdateRequestDocument>,
    private readonly updateRequestService: UpdateRequestService,
  ) {}

  async updateGalgame(galId: string, data: UpdateGalgameDto, req: RequestWithUser) {
    const galgame = await this.galgameModel
      .findOne({ galId })
      .populate('creator.userId')
      .populate('characters.character')
      .populate('staffs.person')
      .populate('producers.producer')
      .populate('tags.tag')
    if (!galgame) {
      throw new NotFoundException('Galgame not found')
    }

    if (galgame.status !== 'published') {
      throw new BadRequestException('Item status must be published to update')
    }

    const exisitedRequest = await this.updateRequestModel.findOne({
      entityId: galgame._id,
      status: 'pending',
    })
    if (exisitedRequest) {
      throw new BadRequestException('There are pending update requests for this item')
    }

    const updatedGalgame = data
    if (updatedGalgame.characters) {
      for (const character of updatedGalgame.characters) {
        if (character.act) {
          for (const act of character.act) {
            if (act.person && typeof act.person === 'object' && act.person._id) {
              // 确保 _id 是有效的 ObjectId 格式
              if (Types.ObjectId.isValid(act.person._id)) {
                act.person = act.person._id
              } else {
                act.person = null
              }
            }
          }
        }
      }
    }
    delete updatedGalgame.updatedAt
    delete updatedGalgame.createdAt
    if (updatedGalgame.downloadInfo) {
      delete updatedGalgame.downloadInfo.viewTimes
      delete updatedGalgame.downloadInfo.downloadTimes
    }
    const originalGalgame = galgame.toJSON({ transformToUpdateRequestFormat: true })

    await this.updateRequestService.createUpdateRequest(
      {
        entityType: EntityType.Galgame,
        entityId: galgame._id as Types.ObjectId,
        title: 'Galgame 更新请求',
        description: '更新 Galgame 条目',
        requestedBy: new Types.ObjectId(req.user._id),
        changes: {
          previous: originalGalgame,
          updated: updatedGalgame,
          changedFields: Object.keys(updatedGalgame),
        },
      },
      req,
    )

    return {
      original: originalGalgame,
      updated: updatedGalgame,
    }
  }

  async getGalgame(galId: string, req: RequestWithUser) {
    const hikariUserGroup = req.user.hikariUserGroup
    const query: any = { galId }

    // 非管理员和非创作者只能查看已发布的内容
    if (
      ![HikariUserGroup.ADMIN, HikariUserGroup.SUPER_ADMIN, HikariUserGroup.CREATOR].includes(
        hikariUserGroup,
      )
    ) {
      query.status = 'published'
    }

    const galgame = await this.galgameModel
      .findOne(query)
      .select(
        'galId vndbId bangumiGameId cover headCover transTitle originTitle producers releaseDate releaseDateTBD releaseDateTBDNote tags originIntro transIntro staffs characters images advType price platform homepage nsfw downloadInfo locked status createdAt updatedAt _id',
      )
      .populate({
        path: 'producers.producer',
        select: 'name logo',
      })
      .populate({
        path: 'staffs.person',
        select: 'name image',
      })
      .populate({
        path: 'characters.character',
        select: 'name image act',
        populate: {
          path: 'act.person',
          select: 'name image',
        },
      })
      .populate({
        path: 'tags.tag',
        select: 'name',
      })
      .populate({
        path: 'creator.userId',
        select: 'name avatar userId',
      })
      .lean()

    if (!galgame) {
      throw new NotFoundException('Galgame not found')
    }

    // 检查创作者权限：只有作品创建者本人或管理员可以查看未发布的内容
    if (
      galgame.creator.userId._id.toString() !== req.user._id.toString() &&
      galgame.status !== 'published' &&
      hikariUserGroup === HikariUserGroup.CREATOR
    ) {
      throw new ForbiddenException('You do not have permission to view this galgame')
    }

    // 初始化 downloadInfo 如果不存在
    if (!galgame.downloadInfo) {
      ;(galgame as any).downloadInfo = {
        downloadable: false,
        viewTimes: 0,
        downloadTimes: 0,
        fileInfos: [],
      }
    }
    if (!galgame.downloadInfo.fileInfos) {
      ;(galgame.downloadInfo as any).fileInfos = []
    }

    // 确保每个 fileInfo 都有 AIInfos
    galgame.downloadInfo.fileInfos.forEach((fileInfo: any) => {
      fileInfo.AIInfos = fileInfo.AIInfos || {
        provider: '',
        model: '',
      }
    })

    // 转换数据格式以匹配前端期望的结构
    const result = galgame as any
    result.creator = galgame.creator.userId
    result.producers = galgame.producers.map((producer: any) => ({
      ...producer.producer,
      note: producer.note || '',
    }))
    result.staffs = galgame.staffs.map((staff: any) => ({
      ...staff.person,
      role: staff.role,
    }))
    result.characters = galgame.characters.map((character: any) => ({
      _id: character.character._id,
      name: character.character.name,
      image: character.character.image,
      role: character.role,
      act: character.character.act,
    }))
    result.tags = galgame.tags.map((tag: any) => tag.tag)

    return result
  }
}
