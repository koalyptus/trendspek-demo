import { createRxDatabase, addRxPlugin } from 'rxdb'
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie'
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv'
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode'
import { RxDBUpdatePlugin } from 'rxdb/plugins/update'
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import type { RxCollection, RxDatabase, RxConflictHandler } from 'rxdb'
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

// Custom conflict handler for annotation replication (RxDB-recommended pattern:
// set on the collection via addCollections, NOT on replicateRxCollection).
// On push conflict, keep the local (fork) state so the user's edit survives;
// the simulation server accepts the re-push of an already-conflicted doc,
// which breaks the retry loop. conflict$ then surfaces both versions to the UI.
const annotationConflictHandler: RxConflictHandler<DefectAnnotation> = {
  isEqual: (a, b) => {
    if (!a || !b) return false
    const strip = (d: typeof a) => {
      const { _rev, _meta, ...rest } = d as any
      return JSON.stringify(rest)
    }
    return strip(a) === strip(b)
  },
  resolve: async (input) => {
    console.log('[ConflictHandler] Resolving push conflict for:', input.newDocumentState.id,
      '— keeping local version')
    return input.newDocumentState
  }
}

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
      migrationStrategies: annotationMigrations,
      conflictHandler: annotationConflictHandler
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


