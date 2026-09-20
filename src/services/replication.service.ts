import { replicateRxCollection } from 'rxdb/plugins/replication'
import type { RxReplicationState } from 'rxdb/plugins/replication'
import type { TrendspekDatabase } from '@/database'
import type { DefectAnnotation } from '@/types'
import { ref } from 'vue'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

type CheckpointType = string

export function createReplicationService(db: TrendspekDatabase) {
  let replicationState: RxReplicationState<DefectAnnotation, CheckpointType> | null = null
  let isRunning = false
  const status = ref<'synced' | 'offline'>('offline')
  let onStatusChange: ((newStatus: 'synced' | 'offline') => void) | null = null

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
        handler: async (lastPulledCheckpoint: CheckpointType | undefined, batchSize: number) => {
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
        },
        live: true,
        batchSize: 10
      },
      push: {
        handler: async (docs: any[]) => {
          const res = await fetch(`${API_BASE}/sync/push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documents: docs })
          })
          if (!res.ok) {
            throw new Error(`Push failed: ${res.status} ${res.statusText}`)
          }
          return []
        }
      }
    })

    // Use the public error$ Observable — documented in RxDB v16 docs
    // (https://rxdb.info/articles/tanstack-db/sync-tanstack-db.html)
    if (replicationState && 'error$' in replicationState) {
      const error$ = (replicationState as any).error$
      if (error$ && typeof error$.subscribe === 'function') {
        error$.subscribe((err: any) => {
          console.log('[Replication] error$ emitted:', err)
          if (status.value !== 'offline') {
            status.value = 'offline'
            onStatusChange?.('offline')
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

  async function stop() {
    if (replicationState && !replicationState.isStoppedOrPaused()) {
      try {
        await (replicationState as any).stop?.()
      } catch (e) {
        console.log('[Replication] stop not available, ignoring')
      }
      isRunning = false
      status.value = 'offline'
      onStatusChange?.('offline')
    }
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
    stop,
    set onStatusChange(cb: (newStatus: 'synced' | 'offline') => void) {
      console.log('[Replication] onStatusChange setter called')
      onStatusChange = cb
    }
  }
}
