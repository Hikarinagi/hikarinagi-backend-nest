import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'
import { CharacterToObjectOptions } from '../../../types/mongoose-extensions'

export type CharacterDocument = Character & Document

@Schema({ _id: false })
export class Label {
  @Prop({ type: String, required: true })
  key: string

  @Prop({ type: String, required: true, default: '未知' })
  value: string
}

@Schema()
export class Relation {
  @Prop({
    type: Types.ObjectId,
    ref: 'Character',
  })
  character: Types.ObjectId

  @Prop({
    type: String,
    required: true,
  })
  relation: string
}

@Schema()
export class Creator {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  })
  userId: Types.ObjectId

  @Prop({ type: String, required: true })
  name: string
}

@Schema({
  timestamps: true,
  toJSON: {
    transform: (_, ret, options: CharacterToObjectOptions) => {
      if (options._transformToUpdateRequestFormat) {
        const _ret = {
          name: ret.name,
          transName: ret.transName,
          aliases: ret.aliases,
          intro: ret.intro,
          transIntro: ret.transIntro,
          image: ret.image,
          labels: ret.labels.map(label => ({ key: label.key, value: label.value })),
          status: ret.status,
        }
        return _ret
      }
      if (options.notInclude_id) {
        delete ret._id
      }
      delete ret.__v
      delete ret.createdAt
      delete ret.updatedAt
      return ret
    },
  },
})
export class Character {
  @Prop({
    type: Number,
    required: true,
    unique: true,
  })
  id: number

  @Prop({
    type: String,
    required: true,
  })
  name: string

  @Prop({ type: String })
  transName: string

  @Prop({ type: [String] })
  aliases: string[]

  @Prop({
    type: String,
    required: false,
    default: '暂无',
  })
  intro: string

  @Prop({ type: String })
  transIntro: string

  @Prop({ type: String })
  image: string

  @Prop({
    type: [
      {
        _id: false,
        person: {
          type: Types.ObjectId,
          ref: 'Person',
        },
        work: {
          workId: {
            type: Types.ObjectId,
            required: true,
            refPath: 'act.work.workType',
          },
          workType: {
            type: String,
            required: true,
            enum: ['Galgame', 'LightNovel'],
          },
        },
      },
    ],
    default: [],
  })
  act: {
    person?: Types.ObjectId
    work: {
      workId: Types.ObjectId
      workType: 'Galgame' | 'LightNovel'
    }
  }[]

  @Prop({ type: [Label] })
  labels: Label[]

  @Prop({ type: [Relation] })
  relations: Relation[]

  @Prop({
    type: String,
    enum: ['pending', 'published', 'rejected', 'deleted', 'draft'],
    default: 'published',
  })
  status: string

  @Prop({ type: Creator, required: true })
  creator: Creator
}

export const CharacterSchema = SchemaFactory.createForClass(Character)

CharacterSchema.pre('save', function () {
  const existingKeys = new Set(this.labels.map(label => label.key))

  const defaultLabels = ['性别', '生日']
  defaultLabels.forEach(key => {
    if (!existingKeys.has(key)) {
      this.labels.push({ key, value: '未知' })
    }
  })
})
