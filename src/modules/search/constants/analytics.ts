export const SEARCH_ANALYTICS_QUEUE = 'search_analytics'
export const ENABLE_SEARCH_EVENT_LOG = false

export const TREND_WINDOWS = ['1h', '6h', '1d'] as const
export type TrendWindow = (typeof TREND_WINDOWS)[number]

export const trendKey = (window: TrendWindow) => `trends:${window}`

export const SUGG_FREQ_KEY = 'sugg:freq'
export const suggPrefixKey = (prefix: string) => `sugg:prefix:${prefix}`

export const SUGG_PREFIX_MIN_LENGTH = 1 // 前缀最小长度
export const SUGG_PREFIX_MAX_CANDIDATES_PER_PREFIX = 200 // 每个前缀最大候选数

export const ANALYTICS_DECAY_CRON = '0 0 * * * *' // 每小时
export const ANALYTICS_TRIM_CRON = '0 10 * * * *' // 每小时第10秒进行修剪
