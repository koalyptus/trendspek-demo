import type { RxJsonSchema } from 'rxdb'
import type { DefectAnnotation } from '@/types'

export const annotationSchemaLiteral: RxJsonSchema<DefectAnnotation> = {
  version: 1,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100
    },
    assetId: {
      type: 'string',
      maxLength: 100
    },
    title: {
      type: 'string'
    },
    description: {
      type: 'string'
    },
    severity: {
      type: 'string'
    },
    status: {
      type: 'string'
    },
    positionXyz: {
      type: 'array',
      items: {
        type: 'number'
      }
    },
    templateId: {
      type: 'string',
      maxLength: 100
    },
    templateValues: {
      type: 'object'
    },
    author: {
      type: 'string'
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
  required: ['id', 'assetId', 'title', 'severity', 'status', 'positionXyz', 'templateId', 'createdAt']
}
