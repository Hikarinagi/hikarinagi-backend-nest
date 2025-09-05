import { Injectable, Logger } from '@nestjs/common'
import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { SEARCH_ANALYTICS_QUEUE } from '../constants/analytics'
import { SearchAnalyticsService } from '../services/search-analytics.service'
import { RecordSearchJob } from '../interfaces/record-search-job.interface'

@Processor(SEARCH_ANALYTICS_QUEUE)
@Injectable()
export class SearchAnalyticsProcessor extends WorkerHost {
  private readonly logger = new Logger(SearchAnalyticsProcessor.name)

  constructor(private readonly analytics: SearchAnalyticsService) {
    super()
  }

  async process(job: Job<RecordSearchJob>): Promise<void> {
    try {
      await this.analytics.recordSearch(job.data)
    } catch (e) {
      this.logger.error('Failed processing search analytics job', e)
      throw e
    }
  }
}
