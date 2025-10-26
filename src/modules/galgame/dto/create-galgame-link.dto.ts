import {
  IsOptional,
  IsString,
  IsNumber,
  IsNotEmpty,
  ValidateBy,
  Min,
  IsUrl,
  IsEnum,
} from 'class-validator'
import { Type } from 'class-transformer'

enum GalgameLinkType {
  OFFICIAL_LINK = 'official-link',
  DOWNLOAD_LINK = 'download-link',
}

enum DownloadType {
  GAME = 'game',
  PATCH = 'patch',
  SAVE = 'save',
  CG = 'cg',
  OST = 'ost',
  OTHER = 'other',
}

enum DownloadLinkType {
  BAIDU = 'baidu',
  QUARK = 'quark',
  ALI = 'ali',
  PAN123 = '123pan',
  ONEDRIVE = 'onedrive',
  MEGA = 'mega',
  TORRENT = 'torrent',
  MAGNET = 'magnet',
  OTHER = 'other',
}

enum OfficialLinkPlatform {
  STEAM = 'steam',
  DLSITE = 'dlsite',
  FANZA = 'fanza',
  GETCHU = 'getchu',
  OFFICIAL = 'official',
  OTHER = 'other',
}

enum Platform {
  WINDOWS = 'windows',
  MAC = 'mac',
  LINUX = 'linux',
  ANDROID = 'android',
  IOS = 'ios',
  PS = 'ps',
  PSV = 'psv',
  PSP = 'psp',
  SWITCH = 'switch',
  XBOX = 'xbox',
  OTHER = 'other',
}

enum Language {
  CN = 'cn',
  TW = 'tw',
  JP = 'jp',
  EN = 'en',
  OTHER = 'other',
}

enum SizeFormat {
  MB = 'MB',
  GB = 'GB',
  TB = 'TB',
}

export class CreateGalgameLinkDto {
  @IsString()
  @IsNotEmpty()
  galgame_Id: string

  @IsEnum(GalgameLinkType)
  @IsNotEmpty()
  linkType: GalgameLinkType

  @IsString()
  @IsUrl(
    {
      protocols: ['http', 'https', 'ftp', 'magnet'],
      require_protocol: false,
      require_valid_protocol: true,
      require_host: false,
      require_tld: false,
      allow_protocol_relative_urls: false,
    },
    { message: 'link must be a valid URL or magnet link' },
  )
  @IsNotEmpty()
  link: string

  @IsString()
  @IsOptional()
  note: string

  @IsString()
  @IsEnum(OfficialLinkPlatform)
  @IsOptional()
  officialLinkPlatform?: OfficialLinkPlatform

  @IsString()
  @IsOptional()
  @IsEnum(DownloadType)
  downloadType?: DownloadType

  @IsNumber()
  @Type(() => Number)
  @Min(0, { message: 'size must be greater than or equal to 0' })
  @IsOptional()
  size?: number

  @IsString()
  @IsEnum(SizeFormat)
  @IsOptional()
  @ValidateBy({
    name: 'isValidSizeFormat',
    validator: {
      validate: (value: any, args: any) => {
        const object = args.object as CreateGalgameLinkDto
        if (object.size && (value === undefined || value === null)) return false
        return true
      },
      defaultMessage: () => 'sizeFormat is required when size is provided',
    },
  })
  sizeFormat?: string

  @IsString()
  @IsOptional()
  downloadLinkType?: DownloadLinkType

  @IsString()
  @IsEnum(Language)
  @IsOptional()
  language?: Language

  @IsString()
  @IsOptional()
  platform?: Platform

  @IsString()
  @IsOptional()
  linkPassword?: string

  @IsString()
  @IsOptional()
  unzipPassword?: string
}
