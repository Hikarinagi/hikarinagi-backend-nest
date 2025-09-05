import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { BullModule } from '@nestjs/bullmq'
import { TokenizationService } from './services/helper/tokenization.service'
import { SearchService } from './services/search.service'
import { SearchController } from './controllers/search.controller'
import { SearchAnalyticsService } from './services/search-analytics.service'
import { SearchRedisService } from './services/search-redis.service'
import { SearchAnalyticsProcessor } from './processors/search-analytics.processor'
import { SEARCH_ANALYTICS_QUEUE } from './constants/analytics'
import { SearchEvent, SearchEventSchema } from './schemas/search-event.schema'
import { SearchAnalyticsTask } from './tasks/search-analytics.task'
import { HikariConfigService } from '../../common/config/configs'

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [HikariConfigService],
      useFactory: (config: HikariConfigService) => ({
        connection: {
          host: config.get('redis.host'),
          port: config.get('redis.port'),
          password: config.get('redis.password') || undefined,
          db: Number(config.get('redis.database') || 0),
        },
      }),
    }),
    MongooseModule.forFeature([{ name: SearchEvent.name, schema: SearchEventSchema }]),
    BullModule.registerQueue({ name: SEARCH_ANALYTICS_QUEUE }),
  ],
  providers: [
    TokenizationService,
    SearchService,
    SearchAnalyticsService,
    SearchRedisService,
    SearchAnalyticsProcessor,
    SearchAnalyticsTask,
  ],
  exports: [TokenizationService, SearchService, SearchAnalyticsService],
  controllers: [SearchController],
})
export class SearchModule {}
