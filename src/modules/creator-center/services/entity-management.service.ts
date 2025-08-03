import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { Person, PersonDocument } from '../../entities/schemas/person.schema'
import { Producer, ProducerDocument } from '../../entities/schemas/producer.schema'
import { Character, CharacterDocument } from '../../entities/schemas/character.schema'
import { Tag, TagDocument } from '../../entities/schemas/tag.schema'
import { GetEntityListDto } from '../dto/entity/get-entity-list.dto'
import { UpdateEntityDto } from '../dto/entity/update-entity.dto'
import { UpdateRequest, UpdateRequestDocument } from '../../shared/schemas/update-request.schema'
import { UpdateRequestService } from '../../shared/services/update-request.service'
import { RequestWithUser } from '../../auth/interfaces/request-with-user.interface'
import { EntityType } from '../dto/entity/get-entity-list.dto'

@Injectable()
export class EntityManagementService {
  constructor(
    @InjectModel(Person.name) private personModel: Model<PersonDocument>,
    @InjectModel(Producer.name) private producerModel: Model<ProducerDocument>,
    @InjectModel(Character.name) private characterModel: Model<CharacterDocument>,
    @InjectModel(Tag.name) private tagModel: Model<TagDocument>,
    @InjectModel(UpdateRequest.name) private updateRequestModel: Model<UpdateRequestDocument>,
    private readonly updateRequestService: UpdateRequestService,
  ) {}

  private getModel(type: EntityType): Model<any> {
    switch (type) {
      case EntityType.Person:
        return this.personModel
      case EntityType.Producer:
        return this.producerModel
      case EntityType.Character:
        return this.characterModel
      case EntityType.Tag:
        return this.tagModel
    }
  }

  async getEntityList(type: EntityType, queryDto: GetEntityListDto) {
    const { keyword, page, limit } = queryDto
    const Model = this.getModel(type)

    const query: any = {}
    if (keyword) {
      query.$or = [
        { name: new RegExp(keyword, 'i') },
        { transName: new RegExp(keyword, 'i') },
        { aliases: new RegExp(keyword, 'i') },
      ]
    }

    if (type === EntityType.Tag) {
      const total = await this.tagModel.countDocuments(query)
      const entities = await this.tagModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('id name')
        .lean()

      return {
        entities,
        meta: {
          totalItems: total,
          itemCount: entities.length,
          itemsPerPage: limit,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
        },
      }
    } else {
      const total = await Model.countDocuments(query)
      const entities = await Model.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('_id name image logo note role')
        .lean()

      return {
        entities,
        meta: {
          totalItems: total,
          itemCount: entities.length,
          itemsPerPage: limit,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
        },
      }
    }
  }

  async updateEntity(type: EntityType, id: number, data: UpdateEntityDto, req: RequestWithUser) {
    const Model = this.getModel(type)
    const hikariUserGroup = req.user.hikariUserGroup

    if (type !== EntityType.Tag) {
      const entity = await Model.findOne({ id })
      if (!entity) {
        throw new NotFoundException('Entity not found')
      }

      const exisitedRequest = await this.updateRequestModel.findOne({
        entityId: entity._id,
        requestedBy: new Types.ObjectId(req.user._id),
        status: 'pending',
      })
      if (exisitedRequest) {
        throw new BadRequestException('You have a pending update request for this item')
      }

      const updatedEntity = data
      const originalEntity = entity.toJSON({ _transformToUpdateRequestFormat: true })

      await this.updateRequestService.createUpdateRequest(
        {
          entityType: type,
          entityId: entity._id,
          title: `${type} 更新请求`,
          description: `更新 ${type} 条目`,
          requestedBy: new Types.ObjectId(req.user._id),
          changes: {
            previous: originalEntity,
            updated: updatedEntity,
          },
        },
        req,
      )

      return updatedEntity
    } else {
      const tag = await this.tagModel.findOne({ id })
      if (!tag) {
        throw new NotFoundException('Tag not found')
      }

      if (
        hikariUserGroup !== 'admin' &&
        hikariUserGroup !== 'superAdmin' &&
        tag.creator.userId.toString() !== req.user._id.toString()
      ) {
        throw new ForbiddenException('No permission to update this entity')
      }

      const protectedFields = ['id', 'creator', 'createdAt']
      protectedFields.forEach(field => delete data[field])

      const updateData = { ...data }

      const updatedTag = await this.tagModel.findOneAndUpdate(
        { id },
        { $set: updateData },
        { new: true },
      )

      return updatedTag
    }
  }
}
