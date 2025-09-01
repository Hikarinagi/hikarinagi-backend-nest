import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { TokenizationService } from './helper/tokenization.service'
import { SearchDto } from '../dto/search.dto'
import { SearchType } from '../types/SearchType.types'
import { Galgame, GalgameDocument } from '../../galgame/schemas/galgame.schema'
import { LightNovel, LightNovelDocument } from '../../novel/schemas/light-novel.schema'
import { Character, CharacterDocument } from '../../entities/schemas/character.schema'
import { Person, PersonDocument } from '../../entities/schemas/person.schema'
import { Producer, ProducerDocument } from '../../entities/schemas/producer.schema'
import { Tag, TagDocument } from '../../entities/schemas/tag.schema'
import { Model, FilterQuery, Types } from 'mongoose'
import {
  PersonSearchResult,
  CharacterSearchResult,
  ProducerSearchResult,
  TagSearchResult,
} from '../types/results'
import { MATCH_SCORES_WEIGHT } from '../constants/MATCH_SCORES_WEIGHT'
import { PaginatedResult } from '../../../common/interfaces/paginated-result.interface'

@Injectable()
export class SearchService {
  constructor(
    private readonly tokenizationService: TokenizationService,
    @InjectModel(Galgame.name) private readonly galgameModel: Model<GalgameDocument>,
    @InjectModel(LightNovel.name) private readonly lightNovelModel: Model<LightNovelDocument>,
    @InjectModel(Character.name) private readonly characterModel: Model<CharacterDocument>,
    @InjectModel(Person.name) private readonly personModel: Model<PersonDocument>,
    @InjectModel(Producer.name) private readonly producerModel: Model<ProducerDocument>,
    @InjectModel(Tag.name) private readonly tagModel: Model<TagDocument>,
  ) {}

  async search(searchDto: SearchDto) {
    const { keyword, type, page, limit, relative_match } = searchDto
    const tokens = this.tokenizationService.tokenizeText(keyword)

    switch (type) {
      case SearchType.Galgame:
        return this.searchGalgame(this.escapeRegExp(keyword), tokens, page, limit, relative_match)
      case SearchType.Novel:
        return this.searchLightNovel(
          this.escapeRegExp(keyword),
          tokens,
          page,
          limit,
          relative_match,
        )
      case SearchType.Producer:
        return this.searchProducer(this.escapeRegExp(keyword), page, limit)
      case SearchType.Person:
        return this.searchPerson(this.escapeRegExp(keyword), page, limit)
      case SearchType.Character:
        return this.searchCharacter(this.escapeRegExp(keyword), page, limit)
    }
  }

  private buildFuzzySearchQuery<T>(keyword: string, isPersonOrCharacter?: boolean): FilterQuery<T> {
    const containsBackslash = keyword.includes('\\')
    if (containsBackslash) {
      return {
        $or: isPersonOrCharacter
          ? [{ name: keyword }, { transName: keyword }, { aliases: keyword }]
          : [{ name: keyword }, { aliases: keyword }],
      }
    } else {
      const tokens = this.tokenizationService.tokenizeText(keyword)
      const safeTokens = this.sanitizeTokens(tokens)
      const conditions = []

      // 完整匹配
      conditions.push(
        isPersonOrCharacter
          ? {
              $or: [
                { name: { $regex: keyword, $options: 'i' } },
                { transName: { $regex: keyword, $options: 'i' } },
                { aliases: { $regex: keyword, $options: 'i' } },
              ],
            }
          : {
              $or: [
                { name: { $regex: keyword, $options: 'i' } },
                { aliases: { $regex: keyword, $options: 'i' } },
              ],
            },
      )

      // tokens > 3 时进行分词匹配
      safeTokens.forEach(token => {
        if (token.length >= 3) {
          conditions.push(
            isPersonOrCharacter
              ? {
                  $or: [
                    { name: { $regex: token, $options: 'i' } },
                    { transName: { $regex: token, $options: 'i' } },
                    { aliases: { $regex: token, $options: 'i' } },
                  ],
                }
              : {
                  $or: [
                    { name: { $regex: token, $options: 'i' } },
                    { aliases: { $regex: token, $options: 'i' } },
                  ],
                },
          )
        }
      })

      return { $or: conditions }
    }
  }

  private escapeRegExp = (string: string) => {
    const result = string
      .replace(/[\u0020-\u002F\u003A-\u0040\u005B-\u0060\u007B-\u007E]/g, ' ')
      .trim()
    return result.replace(/[-/\\^$*+?.[\]{}|]/g, '\\$&')
  }

  private sanitizeTokens(tokens: string[]): string[] {
    const hasMeaningfulChar = /[A-Za-z0-9\u3040-\u30ff\u3400-\u9fff]/
    return tokens
      .map(t => this.escapeRegExp(t))
      .map(t => t.trim())
      .filter(t => t.length >= 3 && hasMeaningfulChar.test(t))
  }

  private getMatchInfo(
    work: any,
    entities: {
      producers: ProducerSearchResult[]
      persons: PersonSearchResult[]
      characters: CharacterSearchResult[]
      tags: TagSearchResult[]
    },
  ) {
    const { producers, persons, characters, tags } = entities
    const matchInfo = []

    // Galgame 特有的 match info，包括 producers, staffs
    if (work.producers) {
      work.producers.forEach(prod => {
        const matchedProducer = producers.find(
          p => p._id.toString() === prod.producer._id.toString(),
        )
        if (matchedProducer) {
          matchInfo.push({
            type: 'producer',
            name: matchedProducer.name,
            aliases: matchedProducer.aliases,
          })
        }
      })
    }

    if (work.staffs) {
      work.staffs.forEach(staff => {
        const matchedPerson = persons.find(p => p._id.toString() === staff.person._id.toString())
        if (matchedPerson) {
          matchInfo.push({ type: 'staff', name: matchedPerson.name, role: staff.role })
        }
      })
    }

    // Novel 特有的 match info，包括 publishers, author, illustrators
    if (work.publishers) {
      work.publishers.forEach(pub => {
        const matchedPublisher = producers.find(
          p => p._id.toString() === pub.publisher._id.toString(),
        )
        if (matchedPublisher) {
          matchInfo.push({
            type: 'publisher',
            name: matchedPublisher.name,
            aliases: matchedPublisher.aliases,
          })
        }
      })
    }

    if (work.author) {
      const matchedAuthor = persons.find(p => p._id.toString() === work.author._id.toString())
      if (matchedAuthor) {
        matchInfo.push({ type: 'author', name: matchedAuthor.name })
      }
    }

    if (work.illustrators && work.illustrators.length > 0) {
      work.illustrators.forEach(ill => {
        const matchedIllustrator = persons.find(
          p => p._id.toString() === ill.illustrator._id.toString(),
        )
        if (matchedIllustrator) {
          matchInfo.push({
            type: 'illustrator',
            name: matchedIllustrator.name,
          })
        }
      })
    }

    // Galgame 和 Novel 都有的 match info，包括 tags, characters
    if (work.tags) {
      work.tags.forEach(tag => {
        const matchedTag = tags.find(t => t._id.toString() === tag.tag._id.toString())
        if (matchedTag) {
          matchInfo.push({ type: 'tag', name: matchedTag.name })
        }
      })
    }

    if (work.characters) {
      work.characters.forEach(char => {
        const matchedChar = characters.find(c => c._id.toString() === char.character._id.toString())
        if (matchedChar) {
          matchInfo.push({
            type: 'character',
            name: matchedChar.name,
            role: char.role,
          })
        }
      })
    }

    return matchInfo
  }

  private calculateScore(
    work: any,
    keyword: string,
    tokens: string[],
    entities: {
      producers: ProducerSearchResult[]
      persons: PersonSearchResult[]
      characters: CharacterSearchResult[]
      tags: TagSearchResult[]
    },
    workType: 'galgame' | 'novel',
  ): number {
    let score = 0
    const { producers = [], persons = [], characters = [], tags = [] } = entities
    const lowercaseKeyword = keyword.toLowerCase()
    const escapedKeyword = this.escapeRegExp(lowercaseKeyword)

    if (workType === 'galgame') {
      if (
        (Array.isArray(work.originTitle) &&
          work.originTitle.some(title => title.toLowerCase() === escapedKeyword)) ||
        work.transTitle?.toLowerCase() === escapedKeyword
      ) {
        score += MATCH_SCORES_WEIGHT.TITLE_EXACT
      }

      if (
        (Array.isArray(work.originTitle) &&
          work.originTitle.some(title => title.toLowerCase().includes(escapedKeyword))) ||
        work.transTitle?.toLowerCase().includes(escapedKeyword)
      ) {
        score += MATCH_SCORES_WEIGHT.TITLE_CONTAIN
      }

      if (work.producers) {
        work.producers.forEach(prod => {
          const matchedProducer = producers.find(
            p => p._id.toString() === prod.producer._id.toString(),
          )
          if (matchedProducer) {
            score += MATCH_SCORES_WEIGHT.PRODUCER
          }
        })
      }

      if (work.staffs) {
        work.staffs.forEach(staff => {
          const matchedPerson = persons.find(p => p._id.toString() === staff.person._id.toString())
          if (matchedPerson) {
            score += MATCH_SCORES_WEIGHT.PERSON
          }
        })
      }

      tokens.forEach(token => {
        if (token.length >= 3) {
          if (
            (Array.isArray(work.originTitle) &&
              work.originTitle.some(title => title.toLowerCase().includes(token.toLowerCase()))) ||
            work.transTitle?.toLowerCase().includes(token.toLowerCase())
          ) {
            score += MATCH_SCORES_WEIGHT.TOKEN_MATCH
          }
        }
      })
    } else if (workType === 'novel') {
      if (
        work.name?.toLowerCase() === escapedKeyword ||
        work.name_cn?.toLowerCase() === escapedKeyword ||
        work.otherNames?.some(name => name.toLowerCase() === escapedKeyword)
      ) {
        score += MATCH_SCORES_WEIGHT.TITLE_EXACT
      }

      if (
        work.name?.toLowerCase().includes(escapedKeyword) ||
        work.name_cn?.toLowerCase().includes(escapedKeyword) ||
        work.otherNames?.some(name => name.toLowerCase().includes(escapedKeyword))
      ) {
        score += MATCH_SCORES_WEIGHT.TITLE_CONTAIN
      }

      if (work.publishers) {
        work.publishers.forEach(pub => {
          const matchedPublisher = producers.find(
            p => p._id.toString() === pub.publisher._id.toString(),
          )
          if (matchedPublisher) {
            score += MATCH_SCORES_WEIGHT.PRODUCER
          }
        })
      }

      if (work.author) {
        const matchedAuthor = persons.find(p => p._id.toString() === work.author._id.toString())
        if (matchedAuthor) {
          score += MATCH_SCORES_WEIGHT.PERSON
        }
      }

      if (work.illustrators) {
        work.illustrators.forEach(ill => {
          const matchedIllustrator = persons.find(
            p => p._id.toString() === ill.illustrator._id.toString(),
          )
          if (matchedIllustrator) {
            score += MATCH_SCORES_WEIGHT.PERSON
          }
        })
      }

      tokens.forEach(gram => {
        if (gram.length >= 3) {
          if (
            work.name?.toLowerCase().includes(gram.toLowerCase()) ||
            work.name_cn?.toLowerCase().includes(gram.toLowerCase())
          ) {
            score += MATCH_SCORES_WEIGHT.TOKEN_MATCH
          }
        }
      })
    }

    if (work.characters) {
      work.characters.forEach(char => {
        const matchedChar = characters.find(c => c._id.toString() === char.character._id.toString())
        if (matchedChar) {
          score += MATCH_SCORES_WEIGHT.CHARACTER
        }
      })
    }

    if (work.tags) {
      work.tags.forEach(tag => {
        const matchedTag = tags.find(t => t._id.toString() === tag.tag._id.toString())
        if (matchedTag) {
          score += MATCH_SCORES_WEIGHT.TAG
        }
      })
    }

    return score
  }

  private async getRelatedEntities(keyword: string): Promise<{
    producers: ProducerSearchResult[]
    persons: PersonSearchResult[]
    characters: CharacterSearchResult[]
    tags: TagSearchResult[]
  }> {
    let producers: ProducerSearchResult[] = [],
      persons: PersonSearchResult[] = [],
      characters: CharacterSearchResult[] = [],
      tags: TagSearchResult[] = []

    ;[producers, persons, characters, tags] = await Promise.all([
      this.producerModel
        .find(this.buildFuzzySearchQuery<ProducerDocument>(keyword))
        .select('_id name aliases country')
        .limit(10)
        .lean() as unknown as ProducerSearchResult[],

      this.personModel
        .find(this.buildFuzzySearchQuery<PersonDocument>(keyword, true))
        .select('_id name transName aliases image')
        .limit(10)
        .lean() as unknown as PersonSearchResult[],

      this.characterModel
        .find(this.buildFuzzySearchQuery<CharacterDocument>(keyword, true))
        .select('_id name transName aliases image')
        .limit(10)
        .lean() as unknown as CharacterSearchResult[],

      this.tagModel
        .find(this.buildFuzzySearchQuery<TagDocument>(keyword))
        .select('_id name description')
        .limit(10)
        .lean() as unknown as TagSearchResult[],
    ])

    return { producers, persons, characters, tags }
  }

  private async searchGalgame(
    keyword: string,
    tokens: string[],
    page: number,
    limit: number,
    relative_match: boolean,
  ): Promise<PaginatedResult<any>> {
    let galgameQuery: FilterQuery<GalgameDocument>
    const containsBackslash = keyword.includes('\\')
    const safeTokens = this.sanitizeTokens(tokens)

    if (containsBackslash) {
      galgameQuery = {
        $or: [{ originTitle: keyword }, { transTitle: keyword }],
      }
    } else {
      galgameQuery = {
        $or: [
          // 精确匹配
          { originTitle: { $elemMatch: { $regex: keyword, $options: 'i' } } },
          { transTitle: { $regex: keyword, $options: 'i' } },
          // 分词匹配
          ...safeTokens.map(token => ({
            $or: [
              { originTitle: { $elemMatch: { $regex: token, $options: 'i' } } },
              { transTitle: { $regex: token, $options: 'i' } },
            ],
          })),
        ],
      }
    }

    let relatedGalgames = []
    if (relative_match) {
      const directGalgames = await this.galgameModel
        .find(galgameQuery)
        .select('_id galId originTitle transTitle nsfw cover producers staffs characters tags')
        .populate('producers.producer', 'id name aliases')
        .populate('staffs.person', 'name transName')
        .populate('characters.character', 'name transName')
        .populate('tags.tag', 'name')
        .where('status')
        .equals('published')
        .lean()

      const { producers, persons, characters, tags } = await this.getRelatedEntities(keyword)

      if (producers.length || persons.length || characters.length || tags.length) {
        const relatedQuery: FilterQuery<GalgameDocument> = {
          $or: [
            { 'producers.producer': { $in: producers.map(p => p._id) } },
            { 'staffs.person': { $in: persons.map(p => p._id) } },
            { 'characters.character': { $in: characters.map(c => c._id) } },
            { 'tags.tag': { $in: tags.map(t => t._id) } },
          ],
          _id: { $nin: directGalgames.map(g => g._id) },
        }

        relatedGalgames = await this.galgameModel
          .find(relatedQuery)
          .select('_id galId originTitle transTitle cover nsfw producers staffs characters tags')
          .populate('producers.producer', 'id name aliases')
          .populate('staffs.person', 'name transName')
          .populate('characters.character', 'name transName')
          .populate('tags.tag', 'name')
          .where('status')
          .equals('published')
          .lean()
      }

      const allGalgames = [...directGalgames, ...relatedGalgames]

      const scoredGalgames = allGalgames.map(game => ({
        ...game,
        matchType: directGalgames.some(dg => dg._id.toString() === game._id.toString())
          ? 'direct'
          : 'related',
        matchInfo: this.getMatchInfo(game, { producers, persons, characters, tags }),
        score:
          game.matchType === 'direct'
            ? this.calculateScore(
                game,
                keyword,
                tokens,
                {
                  producers,
                  persons,
                  characters,
                  tags,
                },
                'galgame',
              ) + 100 // 直接匹配加权
            : this.calculateScore(
                game,
                keyword,
                tokens,
                { producers, persons, characters, tags },
                'galgame',
              ),
      }))

      scoredGalgames.sort((a, b) => b.score - a.score)
      const total = scoredGalgames.length
      const totalPages = Math.ceil(total / limit)
      const paginatedGalgames = scoredGalgames.slice((page - 1) * limit, page * limit)

      // 格式化结果
      const formattedGalgames = paginatedGalgames.map(g => ({
        _id: g._id,
        galId: g.galId,
        originTitle: g.originTitle,
        transTitle: g.transTitle,
        cover: g.cover,
        nsfw: g.nsfw,
        producers: g.producers.map(p => ({
          producer: {
            _id: p.producer._id,
            id: p.producer.id,
            name: p.producer.name,
            aliases: p.producer.aliases,
          },
        })),
        matchType: g.matchType,
        matchInfo: g.matchInfo,
        score: g.score,
      }))

      return {
        items: formattedGalgames,
        meta: {
          totalItems: total,
          itemCount: paginatedGalgames.length,
          itemsPerPage: limit,
          totalPages,
          currentPage: page,
        },
      }
    } else {
      const directGalgames = await this.galgameModel
        .find(galgameQuery)
        .select('_id galId originTitle transTitle nsfw cover producers staffs characters tags')
        .populate('producers.producer', 'id name aliases')
        .populate('staffs.person', 'name transName')
        .populate('characters.character', 'name transName')
        .populate('tags.tag', 'name')
        .where('status')
        .equals('published')
        .limit(limit)
        .skip((page - 1) * limit)
        .lean()

      const directGalgamesCount = await this.galgameModel.countDocuments(galgameQuery)

      const formattedGalgames = directGalgames.map(g => ({
        _id: g._id,
        galId: g.galId,
        originTitle: g.originTitle,
        transTitle: g.transTitle,
        cover: g.cover,
        nsfw: g.nsfw,
        producers: g.producers.map(p => {
          const prod = p.producer as unknown as {
            _id: Types.ObjectId
            id: number
            name: string
            aliases: string[]
          }
          return {
            producer: {
              _id: prod._id,
              id: prod.id,
              name: prod.name,
              aliases: prod.aliases,
            },
          }
        }),
      }))

      return {
        items: formattedGalgames,
        meta: {
          totalItems: directGalgamesCount,
          itemCount: directGalgames.length,
          itemsPerPage: limit,
          totalPages: Math.ceil(directGalgamesCount / limit),
          currentPage: page,
        },
      }
    }
  }

  private async searchLightNovel(
    keyword: string,
    tokens: string[],
    page: number,
    limit: number,
    relative_match: boolean,
  ): Promise<PaginatedResult<any>> {
    let novelQuery: FilterQuery<LightNovelDocument>
    const containsBackslash = keyword.includes('\\')
    const safeTokens = this.sanitizeTokens(tokens)

    if (containsBackslash) {
      novelQuery = {
        $or: [{ name: keyword }, { name_cn: keyword }],
      }
    } else {
      novelQuery = {
        $or: [
          { name: { $regex: keyword, $options: 'i' } },
          { name_cn: { $regex: keyword, $options: 'i' } },
          { otherNames: { $regex: keyword, $options: 'i' } },
          ...safeTokens.map(token => ({
            $or: [
              { name: { $regex: token, $options: 'i' } },
              { name_cn: { $regex: token, $options: 'i' } },
              { otherNames: { $regex: token, $options: 'i' } },
            ],
          })),
        ],
      }
    }

    let relatedNovels = []
    if (relative_match) {
      const directNovels = await this.lightNovelModel
        .find(novelQuery)
        .select(
          '_id novelId name name_cn otherNames cover author publishers illustrators tags characters nsfw',
        )
        .populate('author', 'id name transName')
        .populate('publishers.publisher', 'name aliases')
        .populate('illustrators.illustrator', 'name transName')
        .populate('characters.character', 'name transName')
        .where('status')
        .equals('published')
        .lean()

      const { producers, persons, characters, tags } = await this.getRelatedEntities(keyword)

      if (producers.length || persons.length || characters.length || tags.length) {
        const relatedQuery: FilterQuery<LightNovelDocument> = {
          $or: [
            { 'publishers.publisher': { $in: producers.map(p => p._id) } },
            { author: { $in: persons.map(p => p._id) } },
            { 'illustrators.illustrator': { $in: persons.map(p => p._id) } },
            { 'characters.character': { $in: characters.map(c => c._id) } },
            { tags: { $in: tags.map(t => t._id) } },
          ],
          // 排除已经在直接搜索中找到的结果
          _id: { $nin: directNovels.map(n => n._id) },
        }

        relatedNovels = await this.lightNovelModel
          .find(relatedQuery)
          .select(
            '_id novelId name name_cn otherNames cover author publishers illustrators tags characters nsfw',
          )
          .populate('author', 'id name transName')
          .populate('publishers.publisher', 'name aliases')
          .populate('illustrators.illustrator', 'name transName')
          .populate('characters.character', 'name transName')
          .where('status')
          .equals('published')
          .lean()
      }

      const allNovels = [...directNovels, ...relatedNovels]

      const scoredNovels = allNovels.map(novel => ({
        ...novel,
        matchType: directNovels.some(dn => dn._id.toString() === novel._id.toString())
          ? 'direct'
          : 'related',
        matchInfo: this.getMatchInfo(novel, { producers, persons, characters, tags }),
        score:
          novel.matchType === 'direct'
            ? this.calculateScore(
                novel,
                keyword,
                tokens,
                {
                  producers,
                  persons,
                  characters,
                  tags,
                },
                'novel',
              ) + 100 // 直接匹配加权
            : this.calculateScore(
                novel,
                keyword,
                tokens,
                {
                  producers,
                  persons,
                  characters,
                  tags,
                },
                'novel',
              ),
      }))

      scoredNovels.sort((a, b) => b.score - a.score)
      const total = scoredNovels.length
      const totalPages = Math.ceil(total / limit)
      const paginatedNovels = scoredNovels.slice((page - 1) * limit, page * limit)

      const formattedNovels = paginatedNovels.map(n => ({
        _id: n._id,
        novelId: n.novelId,
        name: n.name,
        name_cn: n.name_cn,
        otherNames: n.otherNames,
        cover: n.cover,
        author: n.author,
        nsfw: n.nsfw,
        matchType: n.matchType,
        matchInfo: n.matchInfo,
        score: n.score,
      }))

      return {
        items: formattedNovels,
        meta: {
          totalItems: total,
          itemCount: paginatedNovels.length,
          itemsPerPage: limit,
          totalPages,
          currentPage: page,
        },
      }
    } else {
      const directNovels = await this.lightNovelModel
        .find(novelQuery)
        .select(
          '_id novelId name name_cn otherNames cover author publishers illustrators tags characters nsfw',
        )
        .populate('author', 'id name transName')
        .populate('publishers.publisher', 'name aliases')
        .populate('illustrators.illustrator', 'name transName')
        .populate('characters.character', 'name transName')
        .where('status')
        .equals('published')
        .limit(limit)
        .skip((page - 1) * limit)
        .lean()

      const directNovelsCount = await this.lightNovelModel.countDocuments(novelQuery)

      const formattedNovels = directNovels.map(n => ({
        _id: n._id,
        novelId: n.novelId,
        name: n.name,
        name_cn: n.name_cn,
        otherNames: n.otherNames,
        cover: n.cover,
        author: n.author,
        nsfw: n.nsfw,
      }))

      return {
        items: formattedNovels,
        meta: {
          totalItems: directNovelsCount,
          itemCount: directNovels.length,
          itemsPerPage: limit,
          totalPages: Math.ceil(directNovelsCount / limit),
          currentPage: page,
        },
      }
    }
  }

  private async searchProducer(
    keyword: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<any>> {
    const query: FilterQuery<ProducerDocument> = {
      $or: [
        { name: { $regex: keyword, $options: 'i' } },
        { aliases: { $elemMatch: { $regex: keyword, $options: 'i' } } },
      ],
    }

    const producers = await this.producerModel
      .find(query)
      .select('_id id name logo aliases country')
      .limit(limit)
      .skip((page - 1) * limit)
      .lean()

    const total = await this.producerModel.countDocuments(query)

    const formattedProducers = producers.map(p => ({
      _id: p._id,
      id: p.id,
      name: p.name,
      aliases: p.aliases,
      logo: p.logo,
    }))

    return {
      items: formattedProducers,
      meta: {
        totalItems: total,
        itemCount: producers.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    }
  }

  private async searchPerson(
    keyword: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<any>> {
    const query: FilterQuery<PersonDocument> = {
      $or: [
        { name: { $regex: keyword, $options: 'i' } },
        { transName: { $regex: keyword, $options: 'i' } },
        { aliases: { $elemMatch: { $regex: keyword, $options: 'i' } } },
      ],
    }

    const persons = await this.personModel
      .find(query)
      .select('_id id name transName aliases image')
      .limit(limit)
      .skip((page - 1) * limit)
      .lean()

    const total = await this.personModel.countDocuments(query)

    const formattedPersons = persons.map(p => ({
      _id: p._id,
      id: p.id,
      name: p.name,
      transName: p.transName,
      aliases: p.aliases,
      image: p.image,
    }))

    return {
      items: formattedPersons,
      meta: {
        totalItems: total,
        itemCount: persons.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    }
  }

  private async searchCharacter(
    keyword: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<any>> {
    const query: FilterQuery<CharacterDocument> = {
      $or: [
        { name: { $regex: keyword, $options: 'i' } },
        { transName: { $regex: keyword, $options: 'i' } },
        { aliases: { $elemMatch: { $regex: keyword, $options: 'i' } } },
      ],
    }
    const characters = await this.characterModel
      .find(query)
      .select('_id id name transName aliases image')
      .limit(limit)
      .skip((page - 1) * limit)
      .lean()

    const total = await this.characterModel.countDocuments(query)

    const formattedCharacters = characters.map(c => ({
      _id: c._id,
      id: c.id,
      name: c.name,
      transName: c.transName,
      aliases: c.aliases,
      image: c.image,
    }))

    return {
      items: formattedCharacters,
      meta: {
        totalItems: total,
        itemCount: characters.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    }
  }
}
