import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { SearchEvent, SearchEventDocument } from '../schemas/search-event.schema'
import { SearchRedisService } from './search-redis.service'
import {
  SUGG_FREQ_KEY,
  SUGG_PREFIX_MAX_CANDIDATES_PER_PREFIX,
  SUGG_PREFIX_MIN_LENGTH,
  suggPrefixKey,
  trendKey,
  TREND_WINDOWS,
  ENABLE_SEARCH_EVENT_LOG,
} from '../constants/analytics'

@Injectable()
export class SearchAnalyticsService {
  constructor(
    private readonly redis: SearchRedisService,
    @InjectModel(SearchEvent.name) private readonly searchEventModel: Model<SearchEventDocument>,
  ) {}

  private normalizeKeyword(raw: string): string {
    const trimmed = (raw || '').trim().toLowerCase()
    return trimmed
  }

  async recordSearch(params: {
    keyword: string
    type?: string
    userIdHash?: string
    ipHash?: string
    resultCount?: number
  }) {
    const { keyword, type, userIdHash, ipHash, resultCount } = params
    if (!keyword || keyword.trim().length < 1) return

    const normalized = this.normalizeKeyword(keyword)
    const client = this.redis.getClient()

    // 根据 trend windows 统计
    await Promise.all(TREND_WINDOWS.map(w => client.zincrby(trendKey(w), 1, normalized)))
    // 根据建议词频率计数
    await client.hincrby(SUGG_FREQ_KEY, normalized, 1)

    // 前缀索引
    for (let L = SUGG_PREFIX_MIN_LENGTH; L <= normalized.length; L++) {
      const prefix = normalized.slice(0, L)
      const key = suggPrefixKey(prefix)
      const freq = await client.hget(SUGG_FREQ_KEY, normalized)
      if (freq) {
        await client.zadd(key, Number(freq), normalized)
        await client.zremrangebyrank(key, 0, -1 * (SUGG_PREFIX_MAX_CANDIDATES_PER_PREFIX + 1))
      }
    }

    if (ENABLE_SEARCH_EVENT_LOG) {
      await this.searchEventModel.create({
        keyword,
        normalized,
        type,
        userIdHash,
        ipHash,
        resultCount,
        timestamp: new Date(),
      })
    }
  }

  async getTrending(limit = 10, windows = TREND_WINDOWS) {
    const client = this.redis.getClient()
    // 逐个取 top，再合并统计
    const maps = await Promise.all(
      windows.map(async w => {
        const members = await client.zrevrange(trendKey(w), 0, limit - 1, 'WITHSCORES')
        const m = new Map<string, number>()
        for (let i = 0; i < members.length; i += 2) {
          m.set(members[i], Number(members[i + 1]))
        }
        return m
      }),
    )

    const agg = new Map<string, number>()
    maps.forEach(m => {
      m.forEach((score, k) => agg.set(k, (agg.get(k) || 0) + score))
    })

    const sorted = Array.from(agg.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)

    return sorted.map(([keyword, score]) => ({ keyword, score }))
  }

  async getSuggest(prefix: string, limit = 10) {
    const client = this.redis.getClient()
    const key = suggPrefixKey(prefix.toLowerCase())
    const items = await client.zrevrange(key, 0, limit - 1)

    // 回填频次作为分数
    if (!items.length) return []
    const freqs = await client.hmget(SUGG_FREQ_KEY, ...items)
    return items.map((k, i) => ({ keyword: k, score: Number(freqs[i] || 0) }))
  }
}
