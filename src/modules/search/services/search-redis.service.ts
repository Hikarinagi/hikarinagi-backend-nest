import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import IORedis, { Redis } from 'ioredis'
import { HikariConfigService } from '../../../common/config/configs'

@Injectable()
export class SearchRedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis

  constructor(private readonly configService: HikariConfigService) {}

  async onModuleInit() {
    const host = this.configService.get('redis.host')
    const port = this.configService.get('redis.port')
    const password = this.configService.get('redis.password') || undefined
    const database = this.configService.get('redis.database') || 0

    this.client = new IORedis({
      host,
      port,
      password,
      db: Number(database),
    })
  }

  getClient(): Redis {
    return this.client
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit()
    }
  }
}
