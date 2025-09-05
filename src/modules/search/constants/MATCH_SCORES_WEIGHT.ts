export const MATCH_SCORES_WEIGHT = {
  TITLE_EXACT: 100, // 标题精确匹配
  TITLE_CONTAIN: 80, // 标题包含关键词
  PRODUCER: 30, // 制作商/出版社匹配
  CHARACTER: 20, // 角色匹配
  PERSON: 20, // 人物匹配(作者/画师/声优等)
  TAG: 20, // 标签匹配
  TOKEN_MATCH: 20, // 分词匹配
}
