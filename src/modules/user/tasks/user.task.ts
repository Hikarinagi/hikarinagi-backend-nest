import { Injectable, Logger } from '@nestjs/common'
import { UserService } from '../services/user.service'
import { Cron, CronExpression } from '@nestjs/schedule'

@Injectable()
export class UserTask {
  private readonly logger = new Logger(UserTask.name)
  constructor(private readonly userService: UserService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async deleteUnverifiedUser() {
    let count = 0
    try {
      this.logger.log('Deleting unverified users')
      count = await this.userService.deleteUnverifiedUser()
    } catch (error) {
      this.logger.error('Error deleting unverified users', error)
    }
    this.logger.log(`Deleted ${count} unverified users`)
  }
}
