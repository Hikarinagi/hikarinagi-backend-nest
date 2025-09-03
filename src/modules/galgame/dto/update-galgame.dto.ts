import { IsArray, IsNumber, IsOptional, ValidateBy, Min, IsUrl, ValidateIf } from 'class-validator'

export class UpdateGalgameDto {}

export class UpdateGalgameCoverAndImagesDto {
  @ValidateIf(o => o.cover !== '' && o.cover !== undefined && o.cover !== null)
  @IsUrl()
  cover: string

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  images: string[]

  @IsNumber()
  @Min(0, { message: 'headCover must be greater than or equal to 0' })
  @ValidateBy({
    name: 'isValidHeadCover',
    validator: {
      validate: (value: any, args: any) => {
        if (value === undefined || value === null) return true
        const object = args.object as UpdateGalgameCoverAndImagesDto
        if (!object.images || !Array.isArray(object.images)) return false
        return value < object.images.length
      },
      defaultMessage: () => 'headCover must be less than images array length',
    },
  })
  @IsOptional()
  headCover?: number
}
