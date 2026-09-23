import { ref, onBeforeUnmount, computed } from 'vue'
import { getDatabase, type TrendspekDatabase } from '@/database'
import type { Subscription } from 'rxjs'
import type { DefectAnnotation, AnnotationTemplate } from '@/types'

export function useDb(notify: (text: string, color?: string, icon?: string) => void) {
  let db: TrendspekDatabase | null = null
  let annotationsSub: Subscription | null = null
  let templatesSub: Subscription | null = null

  const annotations = ref<DefectAnnotation[]>([])
  const templates = ref<AnnotationTemplate[]>([])
  const dbReady = ref(false)
  const annotationsReady = ref(false)
  const templatesReady = ref(false)

  // 1. Initialize RxDB Local-First Database
  const execute = async () => {
    try {
      db = await getDatabase()

      // 2. Subscribe to RxDB Live Queries (Observable Streams)
      // RxDB handles IndexedDB persistence; components reactively receive mutations
      annotationsSub = db.annotations.find().$.subscribe((docs) => {
        annotations.value = docs.map((d) => d.toJSON() as DefectAnnotation)
        annotationsReady.value = true
      })

      templatesSub = db.templates.find().$.subscribe((docs) => {
        templates.value = docs.map((d) => d.toJSON() as AnnotationTemplate)
        templatesReady.value = true
      })

      dbReady.value = true

      notify('RxDB Local-First Database Initialized (IndexedDB)', 'success', 'mdi-database-check')
    } catch (err) {
      console.error('[RxDB Init Error]:', err)
      notify('Database initialization warning. Using fallback.', 'warning', 'mdi-alert')
    }
  }

  execute()

  onBeforeUnmount(() => {
    if (annotationsSub) {
      annotationsSub.unsubscribe()
      annotationsSub = null
    }
    if (templatesSub) {
      templatesSub.unsubscribe()
      templatesSub = null
    }
  })

  return {
    annotations,
    db: () => db,
    ready: computed(() => dbReady.value && annotationsReady.value && templatesReady.value ),
    templates
  }
}
