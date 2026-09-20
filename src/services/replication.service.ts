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
  let onPushSuccess: ((docId: string) => void) | null = null
  let lastErrorTime: number = -1
  let errorSub: any = null
  let sentSub: any = null
  let onlineHandler: ((...args: any[]) => void) | null = null
  let offlineHandler: ((...args: any[]) => void) | null = null

  async function start() {
    if (replicationState && !replicationState.isStoppedOrPaused()) {
      await replicationState.start()
      isRunning = true
      status.value = 'synced'
      onStatusChange?.('synced')
      console.log('[Replication] setPaused(false) — resuming replication')
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
            console.log('[Pull] handler called — checkpoint:', lastPulledCheckpoint)
            const res = await fetch(`${API_BASE}/sync/pull`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ checkpoint: lastPulledCheckpoint })
            })
            console.log('[Pull] response status:', res.status)
            if (!res.ok) {
              throw new Error(`Pull failed: ${res.status} ${res.statusText}`)
            }
            const data = await res.json() as { documents: DefectAnnotation[]; checkpoint: string }
            console.log('[Pull] got', data.documents.length, 'documents, checkpoint:', data.checkpoint)

            if (status.value === 'offline' && Date.now() - lastErrorTime > 2000) {
              status.value = 'synced'
              onStatusChange?.('synced')
            }

            return {
              documents: data.documents.map(d => ({ ...d, _deleted: false })),
              checkpoint: data.checkpoint
            }
          } catch (err) {
            console.log('[Pull] handler error:', err)
            lastErrorTime = Date.now()
            if (status.value !== 'offline') {
              status.value = 'offline'
              onStatusChange?.('offline')
            }
            throw err
          }
        },
        batchSize: 10
      },
      push: {
        handler: async (docs: any[]) => {
          try {
            console.log('[Push] handler called — docs:', docs.length)
            const res = await fetch(`${API_BASE}/sync/push`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ documents: docs })
            })
            console.log('[Push] response status:', res.status)
            if (!res.ok) {
              throw new Error(`Push failed: ${res.status} ${res.statusText}`)
            }

            if (status.value === 'offline' && Date.now() - lastErrorTime > 2000) {
              status.value = 'synced'
              onStatusChange?.('synced')
            }

            return []
          } catch (err) {
            console.log('[Push] handler error:', err)
            lastErrorTime = Date.now()
            if (status.value !== 'offline') {
              status.value = 'offline'
              onStatusChange?.('offline')
            }
            throw err
          }
        }
      }
    })
    console.log('[Replication] replicateRxCollection resolved')

    if (replicationState && 'error$' in replicationState) {
      const error$ = (replicationState as any).error$
      if (error$ && typeof error$.subscribe === 'function') {
        errorSub = error$.subscribe((err: any) => {
          console.log('[Replication] error$ emitted:', err)
          lastErrorTime = Date.now()
          if (status.value !== 'offline') {
            status.value = 'offline'
            onStatusChange?.('offline')
          }
        })
      }
    }

    if (replicationState && 'sent$' in replicationState) {
      const sent$ = (replicationState as any).sent$
      if (sent$ && typeof sent$.subscribe === 'function') {
        sentSub = sent$.subscribe((docData: any) => {
          console.log('[Replication] push sent — docId:', docData.id)
          onPushSuccess?.(docData.id)
        })
      }
    }

    if (typeof window !== 'undefined' && window.addEventListener) {
      const getNavOnline = () => ((typeof window !== 'undefined' && window.navigator?.onLine) ?? true)
      onlineHandler = () => {
        console.log('[Replication] navigator online event — navOnline:', getNavOnline())
        if (status.value === 'offline' && Date.now() - lastErrorTime > 2000) {
          status.value = 'synced'
          onStatusChange?.('synced')
        }
      }
      offlineHandler = () => {
        console.log('[Replication] navigator offline event — navOnline:', getNavOnline())
        if (status.value !== 'offline') {
          status.value = 'offline'
          onStatusChange?.('offline')
        }
      }
      window.addEventListener('online', onlineHandler)
      window.addEventListener('offline', offlineHandler)
    }

    await replicationState.start()
    isRunning = true
    console.log('[Replication] replicationState.start() complete')
  }

  function setPaused(paused: boolean) {
    if (!replicationState) return
    if (paused) {
      replicationState.pause()
      status.value = 'offline'
      onStatusChange?.('offline')
    } else {
      replicationState.start()
      status.value = 'synced'
      onStatusChange?.('synced')
    }
  }

  function destroy() {
    if (errorSub) {
      errorSub.unsubscribe()
      errorSub = null
    }
    if (sentSub) {
      sentSub.unsubscribe()
      sentSub = null
    }
    if (typeof window !== 'undefined' && window.removeEventListener) {
      if (onlineHandler) window.removeEventListener('online', onlineHandler)
      if (offlineHandler) window.removeEventListener('offline', offlineHandler)
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
    destroy,
    setPaused,
    set onStatusChange(cb: (newStatus: 'synced' | 'offline') => void) {
      console.log('[Replication] onStatusChange setter called')
      onStatusChange = cb
    },
    set onPushSuccess(cb: (docId: string) => void) {
      onPushSuccess = cb
    }
  }
}
