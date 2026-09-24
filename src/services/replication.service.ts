import { replicateRxCollection } from 'rxdb/plugins/replication'
import type { RxReplicationState } from 'rxdb/plugins/replication'
import type { TrendspekDatabase } from '@/database'
import type { DefectAnnotation, ReplicationStatus, SimulatePushMode } from '@/types'
import type { WithDeleted, RxReplicationWriteToMasterRow } from 'rxdb'
import { ref, shallowRef } from 'vue'

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

export type ReplicationService = ReturnType<typeof createReplicationService> & {
  onMergeResult?: () => void
}

export function createReplicationService(db: TrendspekDatabase) {
  let replicationState: RxReplicationState<DefectAnnotation, CheckpointType> | null = null
  let isRunning = false
  const status = ref<ReplicationStatus>('unsynced')
  let onStatusChange: StatusChangeCallback | null = null
  let onPushSuccess: PushSuccessCallback | null = null
  let onMergeResult: (() => void) | null = null
  let lastErrorTime: number = -1
  let errorSub: { unsubscribe: () => void } | null = null
  let sentSub: { unsubscribe: () => void } | null = null
  let conflictSub: { unsubscribe: () => void } | null = null
  let onlineHandler: (() => void) | null = null
  let offlineHandler: (() => void) | null = null
  let pendingPush: { docs: WithDeleted<DefectAnnotation>[]; expected: number } = { docs: [], expected: 0 }

  // Exposed reactive stream for conflict-resolution UI
  const conflictEvent = shallowRef<{
    serverState: DefectAnnotation
    localState: DefectAnnotation
    resolvedState: DefectAnnotation | null
  } | null>(null)

  // Session-only simulation mode, settable from outside (e.g. UI store changes)
  let simulationMode: SimulatePushMode = 'none'

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
    // NOTE: subscribeToConflicts is called AFTER start() — internalReplicationState
    // is only assigned inside _start(), so subscribing earlier is a silent no-op.

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
    // Subscribe to resolved conflicts only after start(): RxDB assigns
    // internalReplicationState inside _start(), so this must come after.
    subscribeToConflicts(replicationState)
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
      // Network-level failure (fetch rejected) means the backend is unreachable.
      // HTTP errors are still "reachable" — keep the online status.
      const isNetworkError = err instanceof TypeError
      if (isNetworkError && status.value !== 'unsynced') {
        status.value = 'unsynced'
        onStatusChange?.('unsynced')
      }
      throw err
    }
  }

  async function handlePush(docs: RxReplicationWriteToMasterRow<DefectAnnotation>[]): Promise<PushServerResponse> {
    try {
      console.log('[Push] handler called — docs:', docs.length, 'mode:', simulationMode)
      const res = await fetch(`${API_BASE}/sync/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Simulation-Mode': simulationMode
        },
        body: JSON.stringify({ documents: docs })
      })
      console.log('[Push] response status:', res.status)

      if (!res.ok) {
        throw new Error(`Push failed: ${res.status} ${res.statusText}`)
      }

      // Check for server-side merge result signal (successful-merge simulation)
      const mergeResult = res.headers.get('X-Merge-Result')
      if (mergeResult === 'success') {
        console.log('[Push] Server reported successful property level merge')
        onMergeResult?.()
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
      // Network-level failure (fetch rejected) means the backend is unreachable.
      // HTTP errors are still "reachable" — keep the online status.
      const isNetworkError = err instanceof TypeError
      if (isNetworkError && status.value !== 'unsynced') {
        status.value = 'unsynced'
        onStatusChange?.('unsynced')
      }
      throw err
    }
  }

  function subscribeToConflicts(replicationState: RxReplicationState<DefectAnnotation, string>) {
    if (!replicationState) {
      return
    }

    // RxDB 16 has no public conflict$ on RxReplicationState. Resolved conflicts
    // are emitted on the internal replication state's events.resolvedConflicts
    // as { input: { realMasterState, newDocumentState, assumedMasterState },
    //       output: resolvedDocumentState }.
    const internal = replicationState as unknown as {
      internalReplicationState?: {
        events: {
          resolvedConflicts: {
            subscribe: (fn: (v: unknown) => void) => { unsubscribe: () => void }
          }
        }
      }
    }
    const resolvedConflicts = internal.internalReplicationState?.events?.resolvedConflicts
    if (resolvedConflicts && typeof resolvedConflicts.subscribe === 'function') {
      conflictSub = resolvedConflicts.subscribe((conflict: unknown) => {
        console.log('[Replication] resolvedConflicts emitted:', JSON.stringify(conflict, null, 2))
        const c = conflict as {
          input?: {
            realMasterState?: DefectAnnotation
            newDocumentState?: DefectAnnotation
            assumedMasterState?: DefectAnnotation
          }
          output?: DefectAnnotation
        } | null
        if (c?.input?.realMasterState && c?.input?.newDocumentState) {
          conflictEvent.value = {
            serverState: c.input.realMasterState,
            localState: c.input.newDocumentState,
            resolvedState: c.output ?? null
          }
        }
      })
    }
  }

  function subscribeToErrors(replicationState: RxReplicationState<DefectAnnotation, string>) {
    if (!replicationState) {
      return
    }

    const { error$ } = replicationState
    if (error$ && typeof error$.subscribe === 'function') {
      errorSub = error$.subscribe((err: unknown) => {
        // A replication error (HTTP error, conflict handling failure, …) is NOT
        // a connectivity loss. Log it; do not flip the online/offline status.
        console.log('[Replication] error$ emitted:', err)
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
    if (conflictSub) {
      conflictSub.unsubscribe()
      conflictSub = null
    }
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
    get conflictEvent() {
      return conflictEvent
    },
    get simulationMode() {
      return simulationMode
    },
    start,
    destroy,
    setPaused,
    setSimulationMode(mode: SimulatePushMode) {
      simulationMode = mode
      console.log('[Replication] simulationMode set to:', mode)
    },
    set onStatusChange(cb: StatusChangeCallback) {
      console.log('[Replication] onStatusChange setter called')
      onStatusChange = cb
    },
    set onPushSuccess(cb: PushSuccessCallback) {
      console.log('[Replication] onPushSuccess setter called')
      onPushSuccess = cb
    },
    set onMergeResult(cb: () => void) {
      console.log('[Replication] onMergeResult setter called')
      onMergeResult = cb
    }
  }
}
