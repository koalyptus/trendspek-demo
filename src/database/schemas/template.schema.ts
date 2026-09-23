import type { RxJsonSchema } from 'rxdb'
import type { AnnotationTemplate } from '@/types'

export const templateSchemaLiteral: RxJsonSchema<AnnotationTemplate> = {
  version: 1,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100
    },
    name: {
      type: 'string'
    },
    category: {
      type: 'string'
    },
    version: {
      type: 'string'
    },
    description: {
      type: 'string'
    },
    fields: {
      type: 'array',
      items: {
        type: 'object'
      }
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
      maxLength: 64
    },
    updatedAt: {
      type: 'string',
      format: 'date-time',
      maxLength: 64
    }
  },
  required: ['id', 'name', 'category', 'fields']
}
