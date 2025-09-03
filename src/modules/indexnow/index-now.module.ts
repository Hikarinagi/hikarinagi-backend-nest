import { Module } from '@nestjs/common'
import { IndexNowService } from './services/index-now.service'
import { IndexNowTask } from './tasks/index-now.task'
import { SitemapModule } from '../sitemap/sitemap.module'
import { HttpModule } from '@nestjs/axios'
import { HikariConfigModule } from '../../common/config/config.module'

@Module({
  imports: [
    SitemapModule,
    HttpModule.register({ timeout: 20000, maxRedirects: 0 }),
    HikariConfigModule,
  ],
  providers: [IndexNowService, IndexNowTask],
})
export class IndexNowModule {}
