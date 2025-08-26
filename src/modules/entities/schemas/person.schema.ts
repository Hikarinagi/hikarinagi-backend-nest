import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'
import { PersonToObjectOptions } from '../../../types/mongoose-extensions'

export type PersonDocument = Person & Document

@Schema()
export class Work {
  @Prop({
    type: String,
    required: true,
    enum: ['Galgame', 'LightNovel'],
  })
  workType: string

  @Prop({
    type: Types.ObjectId,
    refPath: 'works.workType',
  })
  work: Types.ObjectId
}

@Schema({ _id: false })
export class Label {
  @Prop({ type: String, required: true })
  key: string

  @Prop({ type: String, required: true, default: '未知' })
  value: string
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
    transform: (_, ret, options: PersonToObjectOptions) => {
      if (options._transformToUpdateRequestFormat) {
        const _ret = {
          aliases: ret.aliases,
          name: ret.name,
          transName: ret.transName,
          intro: ret.intro,
          transIntro: ret.transIntro,
          image: ret.image,
          labels: ret.labels.map(label => ({ key: label.key, value: label.value })),
          status: ret.status,
        }
        return _ret
      }
      delete ret.__v
      delete ret.createdAt
      delete ret.updatedAt
    },
  },
})
export class Person {
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

  @Prop({ type: [Work] })
  works: Work[]

  @Prop({ type: [Label] })
  labels: Label[]

  @Prop({
    type: String,
    enum: ['pending', 'published', 'rejected', 'deleted', 'draft'],
    default: 'published',
  })
  status: string

  @Prop({ type: Creator, required: true })
  creator: Creator
}

export const PersonSchema = SchemaFactory.createForClass(Person)

PersonSchema.pre('save', function () {
  const existingKeys = new Set(this.labels.map(label => label.key))

  const defaultLabels = ['性别', '生日', '国家']
  defaultLabels.forEach(key => {
    if (!existingKeys.has(key)) {
      this.labels.push({ key, value: '未知' })
    }
  })
})
