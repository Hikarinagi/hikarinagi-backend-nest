import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { SearchRedisService } from '../services/search-redis.service'
import {
  ANALYTICS_DECAY_CRON,
  ANALYTICS_TRIM_CRON,
  SUGG_PREFIX_MAX_CANDIDATES_PER_PREFIX,
  TREND_WINDOWS,
  trendKey,
} from '../constants/analytics'

@Injectable()
export class SearchAnalyticsTask {
  constructor(private readonly redis: SearchRedisService) {}

  // 将各窗口分数乘以 0.9，并删除小于 0.01 的分数
  @Cron(ANALYTICS_DECAY_CRON)
  async decayTrends() {
    const client = this.redis.getClient()
    for (const w of TREND_WINDOWS) {
      const key = trendKey(w)
      const members = await client.zrange(key, 0, -1, 'WITHSCORES')
      const pipeline = client.pipeline()
      for (let i = 0; i < members.length; i += 2) {
        const member = members[i]
        const score = Number(members[i + 1])
        const newScore = Math.max(0, score * 0.9)
        if (newScore <= 0.01) pipeline.zrem(key, member)
        else pipeline.zadd(key, newScore, member)
      }
      await pipeline.exec()
    }
  }

  // 修剪每个前缀的候选集
  @Cron(ANALYTICS_TRIM_CRON)
  async trimSuggestPrefixes() {
    const client = this.redis.getClient()
    let cursor = '0'
    do {
      const [next, keys] = await client.scan(cursor, 'MATCH', 'sugg:prefix:*', 'COUNT', 200)
      cursor = next
      const pipeline = client.pipeline()
      for (const key of keys) {
        pipeline.zremrangebyrank(key, 0, -1 * (SUGG_PREFIX_MAX_CANDIDATES_PER_PREFIX + 1))
      }
      await pipeline.exec()
    } while (cursor !== '0') // 当 cursor 为 0 时，表示扫描完成
  }
}
