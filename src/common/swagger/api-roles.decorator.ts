import { applyDecorators } from '@nestjs/common'
import { ApiExtension } from '@nestjs/swagger'

export const ApiRoles = (...roles: string[]) => applyDecorators(ApiExtension('x-roles', roles))
