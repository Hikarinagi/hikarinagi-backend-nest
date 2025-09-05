import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'

export type SearchEventDocument = HydratedDocument<SearchEvent>

@Schema({ collection: 'search_events', timestamps: true })
export class SearchEvent {
  @Prop({ required: true })
  keyword: string

  @Prop({ required: true })
  normalized: string

  @Prop({ required: false })
  type?: string

  @Prop({ required: false })
  userIdHash?: string

  @Prop({ required: false })
  ipHash?: string

  @Prop({ required: false })
  resultCount?: number

  @Prop({ required: true, default: Date.now })
  timestamp: Date
}

export const SearchEventSchema = SchemaFactory.createForClass(SearchEvent)

SearchEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 14 * 24 * 60 * 60 }) // 14 天
