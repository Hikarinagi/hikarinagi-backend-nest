import { Prop, Schema } from '@nestjs/mongoose'
import { BaseDisplayItem } from './base-display-item.schema'
import { Document } from 'mongoose'
import { DeviceType } from '../../enums/DeviceType.enum'

export type AdvertisementItemDocument = AdvertisementItem & Document
export type AdvertisementSettingsDocument = AdvertisementSettings & Document

@Schema({ _id: false })
export class ImageItem {
  @Prop({ type: String, required: true })
  url: string

  @Prop({ type: String, enum: DeviceType })
  device?: DeviceType
}

@Schema({ _id: false })
export class AdvertisementItem extends BaseDisplayItem {
  @Prop({ type: [ImageItem] })
  images: ImageItem[]

  image: never
}

@Schema({ _id: false })
export class AdvertisementSettings {}
