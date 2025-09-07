import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { GalgameLinks, GalgameLinksDocument } from '../schemas/galgame-links.schema'

@Injectable()
export class GalgameLinksCleanTask {
  private readonly logger = new Logger(GalgameLinksCleanTask.name)
  constructor(
    @InjectModel(GalgameLinks.name)
    private readonly galgameLinksModel: Model<GalgameLinksDocument>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredLinks() {
    this.logger.log('Deleting expired links')

    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const pullQuery = {
        isActive: false,
        reportedAt: { $lt: sevenDaysAgo },
      }
      const updateResult = await this.galgameLinksModel.updateMany(
        { linkDetail: { $elemMatch: pullQuery } },
        { $pull: { linkDetail: pullQuery } },
      )
      const deleteResult = await this.galgameLinksModel.deleteMany({
        linkDetail: { $size: 0 },
      })
      this.logger.log(
        `Cleanup complete: ${updateResult.modifiedCount} collections updated, ${deleteResult.deletedCount} empty collections deleted.`,
      )
    } catch (error) {
      this.logger.error('Error during expired links cleanup', error)
    }
  }
}
