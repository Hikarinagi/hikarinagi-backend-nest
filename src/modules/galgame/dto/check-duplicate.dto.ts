import { IsBoolean, IsInt, IsNotEmpty, IsOptional } from 'class-validator'

export class CheckDuplicateDto {
  @IsInt()
  @IsNotEmpty()
  bangumiId: number

  @IsInt()
  @IsNotEmpty()
  vndbId: number

  @IsOptional()
  @IsBoolean()
  skipMatchCheck?: boolean
}

export interface CheckDuplicateResponse {
  isDuplicate: boolean
  name?: string | null
  message: string
}
