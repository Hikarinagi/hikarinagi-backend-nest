import { Injectable, Logger } from '@nestjs/common'
import { HikariConfigService } from '../../../common/config/configs'
import { SitemapService } from '../../sitemap/services/sitemap.service'
import { HttpService } from '@nestjs/axios'
import { firstValueFrom } from 'rxjs'
import {
  INDEX_NOW_API_URL,
  MAX_RETRIES,
  RETRY_DELAY,
  SUBMIT_RECORD_CACHE_PATH,
} from '../constants/index-now'
import { SubmitRecord } from '../interface/submit-record'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

@Injectable()
export class IndexNowService {
  private readonly logger = new Logger(IndexNowService.name)
  constructor(
    private readonly configService: HikariConfigService,
    private readonly sitemapService: SitemapService,
    private readonly httpService: HttpService,
  ) {}
  async onModuleInit() {
    await this.process()
  }
  async process() {
    const urls = Array.from(new Set(await this.getUrls()))
    if (!urls.length) {
      this.logger.log('No urls to submit to IndexNow, skip')
      return
    }
    try {
      await this.submitInBatches(urls)
      try {
        this.saveSubmitRecord(urls, true)
      } catch (error) {
        this.logger.error(
          `Failed to save submit record for ${urls.length} urls to IndexNow`,
          error.message,
        )
      }
    } catch (error) {
      this.logger.error(`Failed to submit ${urls.length} urls to IndexNow`, error.message)
      try {
        this.saveSubmitRecord(urls, false, error.message)
      } catch (error) {
        this.logger.error(
          `Failed to save submit record for ${urls.length} urls to IndexNow`,
          error.message,
        )
      }
    }
  }

  private getUrls(): Promise<string[]> {
    return this.sitemapService.getLatestUrls(3000) // 实际最多返回 3000 * SitemapType 个
  }

  private getIndexNowApiKey(): string {
    return this.configService.get('indexNowApiKey')
  }

  private getSiteBaseUrl(): string {
    return this.configService.get('siteBaseUrl')
  }

  private saveSubmitRecord(urls: string[], success: boolean, error?: string, finishedAt?: Date) {
    const submitRecord: SubmitRecord = {
      items: urls.map(url => ({ url, submitTime: finishedAt || new Date() })),
      total: urls.length,
      success,
      finishedAt: finishedAt || new Date(),
      error,
    }
    const fileName = `index-now-submit-record-${finishedAt?.toISOString() || new Date().toISOString()}.json`
    const filePath = join(SUBMIT_RECORD_CACHE_PATH, fileName)
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, JSON.stringify(submitRecord, null, 2))
    this.logger.log(`Saved submit record to ${filePath}`)
  }

  private retries = 0
  private async submit(urls: string[]) {
    const siteBaseUrl = this.getSiteBaseUrl()
    const host = new URL(siteBaseUrl).hostname
    const key = this.getIndexNowApiKey()
    const keyLocation = `${siteBaseUrl}/${key}.txt`

    const payload = {
      host,
      key,
      keyLocation,
      urlList: urls,
    }

    try {
      this.logger.log(`Submitting ${urls.length} urls to IndexNow`)
      await firstValueFrom(this.httpService.post(INDEX_NOW_API_URL, payload))
      this.logger.log(`Submitted ${urls.length} urls to IndexNow`)
      this.retries = 0
    } catch (error) {
      this.retries++
      if (this.retries > MAX_RETRIES) {
        this.logger.error(`Failed to submit ${urls.length} urls to IndexNow`, error)
        throw error
      }
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
      await this.submit(urls)
    }
  }

  private async submitInBatches(urls: string[], batchSize: number = 10000) {
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize)
      await this.submit(batch)
    }
  }
}
