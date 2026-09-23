import { replicateRxCollection } from 'rxdb/plugins/replication'
import type { RxReplicationState } from 'rxdb/plugins/replication'
import type { TrendspekDatabase } from '@/database'
import type { DefectAnnotation, ReplicationStatus } from '@/types'
import type { WithDeleted, RxReplicationWriteToMasterRow } from 'rxdb'
import { ref } from 'vue'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

type CheckpointType = string

interface PushSuccessCallback {
  (docs: WithDeleted<DefectAnnotation>[]): void
}

interface StatusChangeCallback {
  (newStatus: ReplicationStatus): void
}

type PullServerResponse = { documents: WithDeleted<DefectAnnotation>[]; checkpoint: string }
type PushServerResponse = WithDeleted<DefectAnnotation>[]

export type ReplicationService = ReturnType<typeof createReplicationService>

export function createReplicationService(db: TrendspekDatabase) {
  let replicationState: RxReplicationState<DefectAnnotation, CheckpointType> | null = null
  let isRunning = false
  const status = ref<ReplicationStatus>('unsynced')
  let onStatusChange: StatusChangeCallback | null = null
  let onPushSuccess: PushSuccessCallback | null = null
  let lastErrorTime: number = -1
  let errorSub: { unsubscribe: () => void } | null = null
  let sentSub: { unsubscribe: () => void } | null = null
  let onlineHandler: (() => void) | null = null
  let offlineHandler: (() => void) | null = null
  let pendingPush: { docs: WithDeleted<DefectAnnotation>[]; expected: number } = { docs: [], expected: 0 }

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
        handler: handlePull,
        batchSize: 10
      },
      push: {
        handler: handlePush
      }
    })
    console.log('[Replication] replicateRxCollection resolved')

    subscribeToErrors(replicationState)
    subscribeToSent(replicationState)

    if (typeof window !== 'undefined' && window.addEventListener) {
      const getNavOnline = () => ((typeof window !== 'undefined' && window.navigator?.onLine) ?? true)
      onlineHandler = () => {
        console.log('[Replication] navigator online event — navOnline:', getNavOnline())
        if (status.value === 'unsynced' && Date.now() - lastErrorTime > 2000) {
          status.value = 'synced'
          onStatusChange?.('synced')
        }
      }
      offlineHandler = () => {
        console.log('[Replication] navigator offline event — navOnline:', getNavOnline())
        if (status.value !== 'unsynced') {
          status.value = 'unsynced'
          onStatusChange?.('unsynced')
        }
      }
      window.addEventListener('online', onlineHandler)
      window.addEventListener('offline', offlineHandler)
    }

    await replicationState.start()
    isRunning = true
    console.log('[Replication] replicationState.start() complete')
  }

  async function handlePull(lastPulledCheckpoint: CheckpointType | undefined): Promise<PullServerResponse> {
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

      const data = await res.json() as PullServerResponse
      console.log('[Pull] got', data.documents.length, 'documents, checkpoint:', data.checkpoint)

      if (status.value === 'unsynced' && Date.now() - lastErrorTime > 2000) {
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
      if (status.value !== 'unsynced') {
        status.value = 'unsynced'
        onStatusChange?.('unsynced')
      }
      throw err
    }
  }

  async function handlePush(docs: RxReplicationWriteToMasterRow<DefectAnnotation>[]): Promise<PushServerResponse> {
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

      pendingPush = { docs: [], expected: docs.length }

      if (status.value === 'unsynced' && Date.now() - lastErrorTime > 2000) {
        status.value = 'synced'
        onStatusChange?.('synced')
      }

      const data = await res.json()
      return data
    } catch (err) {
      console.log('[Push] handler error:', err)
      lastErrorTime = Date.now()
      if (status.value !== 'unsynced') {
        status.value = 'unsynced'
        onStatusChange?.('unsynced')
      }
      throw err
    }
  }

  function subscribeToErrors(replicationState: RxReplicationState<DefectAnnotation, string>) {
    if (!replicationState) {
      return
    }

    const { error$ } = replicationState
    if (error$ && typeof error$.subscribe === 'function') {
      errorSub = error$.subscribe((err: unknown) => {
        console.log('[Replication] error$ emitted:', err)
        lastErrorTime = Date.now()
        status.value = 'unsynced'
        onStatusChange?.('unsynced')
      })
    }
  }

  function subscribeToSent(replicationState: RxReplicationState<DefectAnnotation, string>) {
    if (!replicationState) {
      return
    }

    const { sent$ } = replicationState
    if (sent$ && typeof sent$.subscribe === 'function') {
      sentSub = sent$.subscribe((docData: WithDeleted<DefectAnnotation>) => {
        console.log('[Replication] sent$ emitted — docId:', docData.id, 'title:', docData.title)
        pendingPush.docs.push(docData)
        if (pendingPush.docs.length >= pendingPush.expected) {
          const docs = pendingPush.docs
          pendingPush = { docs: [], expected: 0 }
          onPushSuccess?.(docs)
        }
      })
    }
  }

  function setPaused(paused: boolean) {
    if (!replicationState) return
    if (paused) {
      replicationState.pause()
      status.value = 'unsynced'
      onStatusChange?.('unsynced')
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
    start,
    destroy,
    setPaused,
    set onStatusChange(cb: StatusChangeCallback) {
      console.log('[Replication] onStatusChange setter called')
      onStatusChange = cb
    },
    set onPushSuccess(cb: PushSuccessCallback) {
      onPushSuccess = cb
    }
  }
}
