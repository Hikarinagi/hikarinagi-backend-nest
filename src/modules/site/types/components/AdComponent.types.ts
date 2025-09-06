import { UIComponent } from '../UIComponent.types'
import { BaseDisplayItem } from '../BaseDisplayItem.types'
import { UIComponentType } from '../../enums/UIComponentType.enum'
import { DeviceType } from '../../enums/DeviceType.enum'

export interface AdComponent extends UIComponent {
  type: UIComponentType.ADVERTISEMENT
  items: AdItem[]
  settings: AdSettings
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface AdSettings {}

export interface AdItem extends BaseDisplayItem {
  device?: DeviceType
}
