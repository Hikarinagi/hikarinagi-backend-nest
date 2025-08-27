import { ApiOkResponse, ApiResponseOptions, getSchemaPath } from '@nestjs/swagger'

export const standardResponseSchema = (dataSchema: any) => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    code: { type: 'number', example: 200 },
    version: { type: 'string' },
    message: { type: 'string' },
    data: dataSchema,
    cached: { type: 'boolean' },
    timestamp: { type: 'number' },
  },
})

export const paginatedDataSchema = (modelRef: any) => ({
  type: 'object',
  properties: {
    items: { type: 'array', items: modelRef },
    meta: {
      type: 'object',
      properties: {
        totalItems: { type: 'number' },
        itemCount: { type: 'number' },
        itemsPerPage: { type: 'number' },
        totalPages: { type: 'number' },
        currentPage: { type: 'number' },
      },
    },
  },
})

export const ApiOkResponseStandard = (
  dataSchema: any,
  options?: Omit<ApiResponseOptions, 'schema'>,
) => ApiOkResponse({ ...options, schema: standardResponseSchema(dataSchema) })

export const ApiOkResponsePaginated = (model: any, options?: Omit<ApiResponseOptions, 'schema'>) =>
  ApiOkResponse({
    ...options,
    schema: standardResponseSchema(paginatedDataSchema({ $ref: getSchemaPath(model) })),
  })
