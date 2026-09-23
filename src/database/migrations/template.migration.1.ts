import type { RxDocumentData } from 'rxdb'
import type { AnnotationTemplate } from '@/types'

export function templateMigration1(oldDoc: RxDocumentData<AnnotationTemplate> | null) { return oldDoc } 
