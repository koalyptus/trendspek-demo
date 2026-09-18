import { createRxDatabase, addRxPlugin } from 'rxdb'
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie'
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode'
import { RxDBUpdatePlugin } from 'rxdb/plugins/update'
import type { RxCollection, RxDatabase } from 'rxdb'
import { annotationSchemaLiteral } from './schemas/annotation.schema'
import { templateSchemaLiteral } from './schemas/template.schema'
import { defaultTemplates, initialDemoAnnotations } from './defaultData'
import type { DefectAnnotation, AnnotationTemplate } from '@/types'

// Add update plugin
addRxPlugin(RxDBUpdatePlugin)

// Add dev-mode plugin only during development
if (import.meta.env?.DEV) {
  addRxPlugin(RxDBDevModePlugin)
}

export type AnnotationCollection = RxCollection<DefectAnnotation>
export type TemplateCollection = RxCollection<AnnotationTemplate>

export interface TrendspekDatabaseCollections {
  annotations: AnnotationCollection
  templates: TemplateCollection
}

export type TrendspekDatabase = RxDatabase<TrendspekDatabaseCollections>

let dbPromise: Promise<TrendspekDatabase> | null = null

export async function getDatabase(): Promise<TrendspekDatabase> {
  if (!dbPromise) {
    dbPromise = initDatabase()
  }
  return dbPromise
}

async function initDatabase(): Promise<TrendspekDatabase> {
  const db = await createRxDatabase<TrendspekDatabaseCollections>({
    name: 'trendspek_db_v1',
    storage: getRxStorageDexie(),
    ignoreDuplicate: true
  })

  // Add collections
  await db.addCollections({
    annotations: {
      schema: annotationSchemaLiteral
    },
    templates: {
      schema: templateSchemaLiteral
    }
  })

  // Seed default templates if not present
  const existingTemplates = await db.templates.find().exec()
  if (existingTemplates.length === 0) {
    await db.templates.bulkInsert(defaultTemplates)
    console.log('[RxDB] Seeded default inspection templates')
  }

  // Seed initial demo annotations if empty
  const existingAnnotations = await db.annotations.find().exec()
  if (existingAnnotations.length === 0) {
    await db.annotations.bulkInsert(initialDemoAnnotations)
    console.log('[RxDB] Seeded initial demo annotations')
  }

  console.log('[RxDB] Local-first IndexedDB database initialized successfully')
  return db
}

/**
 * Resets database to default demo state
 */
export async function resetDatabaseToDemo(db: TrendspekDatabase): Promise<void> {
  await db.annotations.find().remove()
  await db.templates.find().remove()
  await db.templates.bulkInsert(defaultTemplates)
  await db.annotations.bulkInsert(initialDemoAnnotations)
  console.log('[RxDB] Reset database to default demo state')
}
