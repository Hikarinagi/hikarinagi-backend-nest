import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'
import { GalgameToObjectOptions } from '../../../types/mongoose-extensions'

@Schema({ _id: false })
export class GalgameProducer {
  @Prop({ type: Types.ObjectId, ref: 'Producer' })
  producer: Types.ObjectId

  @Prop({ type: String, default: '' })
  note: string
}

@Schema({ _id: false })
export class GalgameTag {
  @Prop({ type: Types.ObjectId, ref: 'Tag' })
  tag: Types.ObjectId

  @Prop({ type: Number, default: 0 })
  likes: number
}

@Schema({ _id: false })
export class GalgameStaff {
  @Prop({ type: Types.ObjectId, ref: 'Person' })
  person: Types.ObjectId

  @Prop({ type: String })
  role: string
}

@Schema({ _id: false })
export class GalgameCharacter {
  @Prop({ type: Types.ObjectId, ref: 'Character' })
  character: Types.ObjectId

  @Prop({ type: String, required: true })
  role: string
}

@Schema({ _id: false })
export class TranslationGroup {
  @Prop({ type: String })
  name: string

  @Prop({ type: String })
  link: string

  @Prop({ type: String })
  linkDisplayName: string
}

@Schema({ _id: false })
export class AIInfos {
  @Prop({
    type: String,
    enum: [
      'OpenAI',
      'Anthropic',
      'DeepSeek',
      'Google DeepMind',
      'Meta',
      'Mistral',
      'xAI',
      'Alibaba DAMO Academy',
      'Other',
      '',
    ],
  })
  provider: string

  @Prop({ type: String })
  model: string
}

@Schema({ _id: false })
export class FileInfo {
  @Prop({ type: String })
  fileName: string

  @Prop({ type: Number })
  fileSize: number

  @Prop({ type: String })
  sizeUnit: string

  @Prop({ type: String })
  filePath: string
}

@Schema({ _id: false })
export class DownloadFileInfo {
  @Prop({ type: String, enum: ['simplified', 'traditional'] })
  language: string

  @Prop({
    type: String,
    enum: ['Windows', 'Mac', 'Linux', 'Android', 'iOS', 'Switch', 'Web', 'Other'],
  })
  platform: string

  @Prop({
    type: String,
    enum: ['official', 'fan', 'AI', 'machine', 'untranslated'],
  })
  translationType: string

  @Prop({ type: TranslationGroup })
  translationGroup: TranslationGroup

  @Prop({ type: AIInfos })
  AIInfos: AIInfos

  @Prop({ type: [FileInfo] })
  files: FileInfo[]

  @Prop({ type: String })
  note: string
}

@Schema({ _id: false })
export class DownloadInfo {
  @Prop({ type: Boolean, default: false })
  downloadable: boolean

  @Prop({ type: Number, default: 0, immutable: true })
  viewTimes: number

  @Prop({ type: Number, default: 0, immutable: true })
  downloadTimes: number

  @Prop({ type: [DownloadFileInfo] })
  fileInfos: DownloadFileInfo[]
}

@Schema({ _id: false })
export class GalgameCreator {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId

  @Prop({ type: String, required: true })
  name: string
}

@Schema({ _id: false })
export class GalgamePrice {
  @Prop({ type: String })
  version: string

  @Prop({ type: Number })
  amount: number

  @Prop({ type: String })
  currency: string
}

@Schema({
  timestamps: true,
  toJSON: {
    transform: (_, ret, options: GalgameToObjectOptions) => {
      if (options.onlyDownloadInfo) {
        for (const key in ret) {
          if (key !== 'downloadInfo') {
            delete ret[key]
          }
        }
        return ret
      }

      if (options.transformToUpdateRequestFormat) {
        if (ret.producers && Array.isArray(ret.producers)) {
          ret.producers = ret.producers.map(producer => ({
            _id: producer.producer?._id || producer.producer,
            name: producer.producer?.name || '',
            logo: producer.producer?.logo || '',
            note: producer.note || '',
          }))
        }
        if (ret.tags && Array.isArray(ret.tags)) {
          ret.tags = ret.tags.map(tag => ({
            _id: tag.tag?._id || tag.tag,
            name: tag.tag?.name || '',
          }))
        }
        if (ret.staffs && Array.isArray(ret.staffs)) {
          ret.staffs = ret.staffs.map(staff => ({
            _id: staff.person?._id || staff.person,
            name: staff.person?.name || '',
            image: staff.person?.image || '',
            role: staff.role || '',
          }))
        }
        if (ret.characters && Array.isArray(ret.characters)) {
          ret.characters = ret.characters.map(character => ({
            _id: character.character?._id || character.character,
            name: character.character?.name || '',
            image: character.character?.image || '',
            role: character.role || '',
            act:
              character.character?.act?.map(act => ({
                person: act.person?._id || act.person,
                work: act.work,
              })) || [],
          }))
        }
        if (ret.creator) {
          ret.creator = {
            _id: ret.creator.userId?._id || ret.creator.userId,
            name: ret.creator.name || '',
            avatar: ret.creator.userId?.avatar || '',
            userId: ret.creator.userId?.userId || '',
          }
        }
        if (ret.downloadInfo) {
          delete ret.downloadInfo.viewTimes
          delete ret.downloadInfo.downloadTimes
          if (ret.downloadInfo.fileInfos) {
            for (const fileInfo of ret.downloadInfo.fileInfos) {
              if (!fileInfo.AIInfos) {
                fileInfo.AIInfos = {
                  provider: '',
                  model: '',
                }
              }
            }
          }
        }
        delete ret.__v
        delete ret._id
        delete ret.views
        delete ret.createdAt
        delete ret.updatedAt
        return ret
      }

      delete ret.__v
      delete ret.createdAt
      delete ret.updatedAt
      delete ret.creator
      ret.downloadable = ret.downloadInfo.downloadable || false
      delete ret.downloadInfo
      return ret
    },
  },
})
export class Galgame {
  @Prop({ type: String, required: true, unique: true })
  galId: string

  @Prop({ type: Number, required: false })
  vndbId: number

  @Prop({ type: Number, required: false, unique: true })
  bangumiGameId: number

  @Prop({ type: String })
  cover: string

  @Prop({ type: Number, required: false, default: 0 })
  headCover: number

  @Prop({ type: String, required: false })
  transTitle: string

  @Prop({ type: [String], required: true })
  originTitle: string[]

  @Prop({ type: [GalgameProducer] })
  producers: GalgameProducer[]

  @Prop({
    type: String,
    required: function () {
      return !this.releaseDateTBD
    },
  })
  releaseDate: string

  @Prop({ type: Boolean, required: false, default: false })
  releaseDateTBD: boolean

  @Prop({
    type: String,
    required: false,
    default: '',
  })
  releaseDateTBDNote: string

  @Prop({ type: [GalgameTag] })
  tags: GalgameTag[]

  @Prop({ type: String })
  originIntro: string

  @Prop({ type: String })
  transIntro: string

  @Prop({ type: [GalgameStaff] })
  staffs: GalgameStaff[]

  @Prop({ type: [GalgameCharacter] })
  characters: GalgameCharacter[]

  @Prop({ type: String })
  advType: string

  @Prop({ type: [GalgamePrice] })
  price: GalgamePrice[]

  @Prop({ type: [String] })
  platform: string[]

  @Prop({ type: String })
  homepage: string

  @Prop({ type: [String], default: [] })
  images: string[]

  @Prop({ type: Boolean, default: false })
  nsfw: boolean

  @Prop({ type: Boolean, default: false })
  locked: boolean

  @Prop({ type: DownloadInfo, default: { downloadable: false } })
  downloadInfo: DownloadInfo

  @Prop({
    type: String,
    enum: ['pending', 'published', 'rejected', 'deleted', 'draft'],
    default: 'published',
  })
  status: 'pending' | 'published' | 'rejected' | 'deleted' | 'draft'

  @Prop({ type: GalgameCreator })
  creator: GalgameCreator

  @Prop({ type: Number, default: 0 })
  views: number

  @Prop({ type: Date, default: Date.now })
  createdAt: Date
}

export type GalgameDocument = Galgame & Document
export const GalgameSchema = SchemaFactory.createForClass(Galgame)
