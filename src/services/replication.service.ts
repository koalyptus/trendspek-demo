import { replicateRxCollection } from 'rxdb/plugins/replication'
import type { RxReplicationState } from 'rxdb/plugins/replication'
import type { TrendspekDatabase } from '@/database'
import type { DefectAnnotation } from '@/types'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

type CheckpointType = string

export function createReplicationService(db: TrendspekDatabase) {
  let replicationState: RxReplicationState<DefectAnnotation, CheckpointType> | null = null
  let isRunning = false
  let status: 'synced' | 'offline' = 'offline'

  async function start() {
    if (replicationState && !replicationState.isStoppedOrPaused()) {
      await replicationState.start()
      isRunning = true
      status = 'synced'
      return
    }

    const currentState = replicationState
    if (currentState) {
      await currentState.remove()
    }

    replicationState = replicateRxCollection<DefectAnnotation, CheckpointType>({
      replicationIdentifier: 'trendspek-annotations-replication',
      collection: db.annotations,
      deletedField: '_deleted',
      live: true,
      pull: {
        handler: async (lastPulledCheckpoint: CheckpointType | undefined, batchSize: number) => {
          const res = await fetch(`${API_BASE}/pull`, {
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
        }
      },
      push: {
        handler: async (docs: any[]) => {
          const res = await fetch(`${API_BASE}/push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documents: docs })
          })
          if (!res.ok) {
            throw new Error(`Push failed: ${res.status} ${res.statusText}`)
          }
          const data = await res.json() as { status: string }
          if (data.status !== 'success') {
            throw new Error(`Push returned non-success status: ${data.status}`)
          }
          return []
        }
      }
    })

    replicationState.subjects.error.subscribe(() => {
      status = 'offline'
    })

    await replicationState.start()
    isRunning = true
    status = 'synced'
  }

  async function stop() {
    if (replicationState && !replicationState.isStoppedOrPaused()) {
      await replicationState.pause()
    }
    isRunning = false
    status = 'offline'
  }

  return {
    get replicationState() {
      return replicationState
    },
    get isRunning() {
      return isRunning
    },
    get status() {
      return status
    },
    start,
    stop
  }
}
