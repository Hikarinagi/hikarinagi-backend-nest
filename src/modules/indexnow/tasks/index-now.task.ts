import { Injectable, Logger } from '@nestjs/common'
import { IndexNowService } from '../services/index-now.service'
import { Cron } from '@nestjs/schedule'
import { INDEX_NOW_SCHEDULE } from '../constants/index-now'
import { HikariConfigService } from '../../../common/config/configs'

@Injectable()
export class IndexNowTask {
  private readonly logger = new Logger(IndexNowTask.name)
  constructor(
    private readonly indexNowService: IndexNowService,
    private readonly configService: HikariConfigService,
  ) {}

  @Cron(INDEX_NOW_SCHEDULE)
  async runIndexNow() {
    if (!this.configService.get('enableIndexNow')) {
      return
    } else if (!this.configService.get('indexNowApiKey')) {
      this.logger.error('IndexNow API key is not set')
      return
    }
    this.logger.log('Running IndexNow task')
    await this.indexNowService.process()
  }
}
