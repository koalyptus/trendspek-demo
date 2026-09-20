import { replicateRxCollection } from 'rxdb/plugins/replication'
import type { RxReplicationState } from 'rxdb/plugins/replication'
import type { TrendspekDatabase } from '@/database'
import type { DefectAnnotation } from '@/types'
import { ref } from 'vue'
import { Subject } from 'rxjs'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

type CheckpointType = string

export function createReplicationService(db: TrendspekDatabase) {
  let replicationState: RxReplicationState<DefectAnnotation, CheckpointType> | null = null
  let isRunning = false
  const status = ref<'synced' | 'offline'>('offline')
  let onStatusChange: ((newStatus: 'synced' | 'offline') => void) | null = null
  let lastErrorTime: number = -1
  const handlerErrorSubject = new Subject<void>()

  async function start() {
    if (replicationState && !replicationState.isStoppedOrPaused()) {
      await replicationState.start()
      isRunning = true
      status.value = 'synced'
      onStatusChange?.('synced')
      return
    }

    const currentState = replicationState
    if (currentState) {
      await currentState.remove()
    }

    replicationState = await replicateRxCollection<DefectAnnotation, CheckpointType>({
      collection: db.annotations,
      replicationIdentifier: 'trendspek-annotations-replication',
      live: true,
      pull: {
        handler: async (lastPulledCheckpoint: CheckpointType | undefined, _batchSize: number) => {
          try {
            const res = await fetch(`${API_BASE}/sync/pull`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ checkpoint: lastPulledCheckpoint })
            })
            if (!res.ok) {
              throw new Error(`Pull failed: ${res.status} ${res.statusText}`)
            }
            const data = await res.json() as { documents: DefectAnnotation[]; checkpoint: string }
            return {
              documents: data.documents.map(d => ({ ...d, _deleted: false })),
              checkpoint: data.checkpoint
            }
          } catch (err) {
            handlerErrorSubject.next()
            throw err
          }
        },
        batchSize: 10
      },
      push: {
        handler: async (docs: any[]) => {
          try {
            const res = await fetch(`${API_BASE}/sync/push`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ documents: docs })
            })
            if (!res.ok) {
              throw new Error(`Push failed: ${res.status} ${res.statusText}`)
            }
            return []
          } catch (err) {
            handlerErrorSubject.next()
            throw err
          }
        }
      }
    })

    // error$ — emitted by RxDB when replication encounters an error.
    // Also tracks lastErrorTime so active$ can gate the recovery transition.
    if (replicationState && 'error$' in replicationState) {
      const error$ = (replicationState as any).error$
      if (error$ && typeof error$.subscribe === 'function') {
        error$.subscribe((err: any) => {
          console.log('[Replication] error$ emitted:', err)
          lastErrorTime = Date.now()
          if (status.value !== 'offline') {
            status.value = 'offline'
            onStatusChange?.('offline')
          }
        })
      }
    }

    // handlerErrorSubject — fires when our fetch handlers fail (server unreachable).
    // This is more reliable than error$ for HTTP-level failures.
    handlerErrorSubject.subscribe(() => {
      lastErrorTime = Date.now()
      if (status.value !== 'offline') {
        status.value = 'offline'
        onStatusChange?.('offline')
      }
    })

    // active$ — when replication becomes active again AFTER being offline,
    // transition back to 'synced' only if no error has occurred in the last 5s.
    if (replicationState && 'active$' in replicationState) {
      const active$ = (replicationState as any).active$
      if (active$ && typeof active$.subscribe === 'function') {
        active$.subscribe((isActive: boolean) => {
          console.log('[Replication] active$ emitted:', isActive)
          if (isActive && status.value === 'offline' && Date.now() - lastErrorTime > 5000) {
            status.value = 'synced'
            onStatusChange?.('synced')
          }
        })
      }
    }

    await replicationState.start()
    isRunning = true
    status.value = 'synced'
    console.log('[Replication] status set to synced, calling onStatusChange')
    onStatusChange?.('synced')
  }

  return {
    get isRunning() {
      return isRunning
    },
    get status() {
      return status
    },
    get statusValue() {
      return status.value
    },
    start,
    set onStatusChange(cb: (newStatus: 'synced' | 'offline') => void) {
      console.log('[Replication] onStatusChange setter called')
      onStatusChange = cb
    }
  }
}
