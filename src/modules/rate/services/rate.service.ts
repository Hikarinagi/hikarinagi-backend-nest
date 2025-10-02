import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Rate, RateDocument } from '../schemas/rate.schema'
import { RequestWithUser } from '../../auth/interfaces/request-with-user.interface'
import { HikariUserGroup } from '../../auth/enums/hikari-user-group.enum'

@Injectable()
export class RateService {
  constructor(@InjectModel(Rate.name) private readonly rateModel: Model<RateDocument>) {}

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
}
