import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { MongooseModule } from '@nestjs/mongoose'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { CacheModule } from '@nestjs/cache-manager'
import { ThrottlerGuard, ThrottlerModule, ThrottlerModuleOptions } from '@nestjs/throttler'
import { redisStore } from 'cache-manager-redis-yet'
import { KeyvAdapter } from 'cache-manager'
import config from './common/config/configs'
import { HikariConfigModule } from './common/config/config.module'
import { HikariConfigService } from './common/config/configs'
import { UserModule } from './modules/user/user.module'
import { AuthModule } from './modules/auth/auth.module'
import { EmailModule } from './modules/email/email.module'
import { MessageModule } from './modules/message/message.module'
import { SharedModule } from './modules/shared/shared.module'
import { EntitiesModule } from './modules/entities/entities.module'
import { BangumiModule } from './modules/bangumi/bangumi.module'
import { GalgameModule } from './modules/galgame/galgame.module'
import { LightNovelModule } from './modules/novel/lightnovel.module'
import { RootAppModule } from './common/modules/app.module'
import { TokenExtractionInterceptor } from './common/interceptors/token-extraction.interceptor'
import { NSFWFilterInterceptor } from './common/interceptors/nsfw-filter.interceptor'
import { CommentModule } from './modules/comment/comment.module'
import { CreatorCenterModule } from './modules/creator-center/creator-center.module'
import { VersionService } from './common/services/version.service'
import { SearchModule } from './modules/search/search.module'
import { SiteModule } from './modules/site/site.module'
import { SitemapModule } from './modules/sitemap/sitemap.module'

@Module({
  imports: [
    // 配置模块
    ConfigModule.forRoot({
      isGlobal: true,
      load: config,
    }),
    HikariConfigModule,
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [HikariConfigService],
      useFactory: (configService: HikariConfigService) => ({
        secret: configService.get('jwt.secret'),
        signOptions: {
          expiresIn: configService.get('jwt.hikariAccessTokenExpiresIn'),
        },
      }),
    }),

    // 数据库模块
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [HikariConfigService],
      useFactory: async (configService: HikariConfigService) => ({
        uri: configService.get('database.uri'),
      }),
    }),

    // 缓存模块 (Redis)
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [HikariConfigService],
      useFactory: async (configService: HikariConfigService) => {
        const host = configService.get('redis.host')
        const port = configService.get('redis.port')
        const password = configService.get('redis.password')
        const keyPrefix = configService.get('redis.keyPrefix')
        const database = configService.get('redis.database')

        return {
          stores: [
            new KeyvAdapter(
              await redisStore({
                socket: { host, port },
                password: password || undefined,
                keyPrefix,
                database,
              }),
            ),
          ],
        }
      },
    }),

    // 限流模块
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [HikariConfigService],
      useFactory: (configService: HikariConfigService): ThrottlerModuleOptions => ({
        throttlers: [
          {
            ttl: configService.get('throttle.ttl'),
            limit: configService.get('throttle.limit'),
          },
        ],
        errorMessage: 'Too many requests, please try again later.',
      }),
    }),

    // 共享模块
    SharedModule,
    EntitiesModule,
    BangumiModule,

    // 应用模块
    RootAppModule,
    AuthModule,
    UserModule,
    EmailModule,
    GalgameModule,
    MessageModule,
    LightNovelModule,
    CommentModule,
    CreatorCenterModule,
    SearchModule,
    SiteModule,
    SitemapModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TokenExtractionInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: NSFWFilterInterceptor,
    },
    VersionService,
  ],
})
export class AppModule {}
