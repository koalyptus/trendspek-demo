import type { RxDocumentData } from 'rxdb'
import type { DefectAnnotation } from '@/types'

export function annotationMigration1(oldDoc:  RxDocumentData<DefectAnnotation> | null) { return oldDoc }
