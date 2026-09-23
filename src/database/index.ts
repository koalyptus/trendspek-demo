import { createRxDatabase, addRxPlugin } from 'rxdb'
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie'
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv'
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode'
import { RxDBUpdatePlugin } from 'rxdb/plugins/update'
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import type { RxCollection, RxDatabase } from 'rxdb'
import { annotationSchemaLiteral } from './schemas/annotation.schema'
import { templateSchemaLiteral } from './schemas/template.schema'
import { defaultTemplates } from './defaultData'
import type { DefectAnnotation, AnnotationTemplate } from '@/types'
import { annotationMigrations } from './migrations/annotation.migrations'
import { templateMigrations } from './migrations/template.migrations'

const DBNAME = 'trendspek_db'

// Add update plugin
addRxPlugin(RxDBUpdatePlugin)

// Add dev-mode plugin only during development
if (import.meta.env?.DEV) {
  addRxPlugin(RxDBDevModePlugin)
}

addRxPlugin(RxDBMigrationSchemaPlugin)

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
  const baseStorage = getRxStorageDexie()
  const storage = import.meta.env?.DEV
    ? wrappedValidateAjvStorage({ storage: baseStorage })
    : baseStorage

  const db = await createRxDatabase<TrendspekDatabaseCollections>({
    name: DBNAME,
    storage,
    ignoreDuplicate: true
  })

  // Add collections
  await db.addCollections({
    annotations: {
      schema: annotationSchemaLiteral,
      migrationStrategies: annotationMigrations
    },
    templates: {
      schema: templateSchemaLiteral,
      migrationStrategies: templateMigrations
    }
  })

  // Seed default templates if not present
  for (const tpl of defaultTemplates) {
    const existing = await db.templates.findOne(tpl.id).exec()
    if (!existing) {
      await db.templates.insert(tpl)
    }
  }

  console.log('[RxDB] Local-first IndexedDB database initialized with real building assets')
  return db
}


