import { replicateRxCollection } from 'rxdb/plugins/replication'
import type { RxReplicationState } from 'rxdb/plugins/replication'
import type { TrendspekDatabase } from '@/database'
import type { DefectAnnotation, ReplicationStatus, SimulatePushMode } from '@/types'
import type { WithDeleted, RxReplicationWriteToMasterRow } from 'rxdb'
import { ref, shallowRef, computed } from 'vue'

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
  // Browser network connectivity (navigator.onLine). Drives the header
  // Online/Offline switch by default; the user can override it to Offline.
  // Distinct from `status` (backend reachability): an offline browser makes
  // the backend unreachable, but an online browser does not imply the
  // backend is up — only fetch outcomes decide that.
  const browserOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)
  let onStatusChange: StatusChangeCallback | null = null
  let onPushSuccess: PushSuccessCallback | null = null
  let onMergeResult: (() => void) | null = null
  // Timestamp of the last pull/push handler failure (any exception, including
  // HTTP errors). error$ emissions deliberately do NOT update it. Success
  // paths use it as a 2s debounce so a single failure doesn't flap the status.
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
      // Status (backend health) is NOT forced here — the resumed fetches
      // decide it (network error → 'unsynced', success → 'synced').
      console.log('[Replication] resuming replication')
      return
    }

    if (replicationState) {
      await replicationState.remove()
    }

    replicationState = await replicateRxCollection<DefectAnnotation, CheckpointType>({
      collection: db.annotations,
      replicationIdentifier: 'trendspek-annotations-replication',
      live: true,
      // Critical: with the default (true), RxDB auto-calls start() whenever the
      // tab becomes visible, silently un-pausing a deliberately paused
      // replication and flushing queued pushes. We own pause/resume.
      toggleOnDocumentVisible: false,
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
      onlineHandler = () => {
        console.log('[Replication] navigator online event')
        browserOnline.value = true
        // Optimistically mark synced; a failing fetch will flip it back.
        if (status.value === 'unsynced' && Date.now() - lastErrorTime > 2000) {
          status.value = 'synced'
          onStatusChange?.('synced')
        }
      }
      offlineHandler = () => {
        console.log('[Replication] navigator offline event')
        browserOnline.value = false
        // Browser offline => backend is unreachable by definition.
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
    // Never hit the network while deliberately paused.
    if (userPaused.value === true) {
      return { documents: [], checkpoint: lastPulledCheckpoint ?? new Date().toISOString() }
    }
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
    // Never hit the network while deliberately paused. Returning an empty
    // conflicts array tells RxDB the push "succeeded"; the docs remain in the
    // local fork and are re-pushed on resume (RxDB re-syncs from checkpoints).
    if (userPaused.value === true) {
      console.log('[Push] paused — skipping network, docs stay local:', docs.length)
      return []
    }
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

    // Drop any previous subscription first: start() builds a fresh replication
    // state on every non-resume start, and overwriting conflictSub without
    // unsubscribing would leak the old one (duplicate conflict dialogs).
    if (conflictSub) {
      conflictSub.unsubscribe()
      conflictSub = null
    }

    // NOTE (verified against rxdb@16.4.0): RxDB 16 has no public conflict$ on
    // RxReplicationState. Resolved conflicts are emitted on the internal
    // replication state's events.resolvedConflicts as
    // { input: { realMasterState, newDocumentState, assumedMasterState },
    //   output: resolvedDocumentState }.
    // This is private API — if it disappears on upgrade, the failure mode is a
    // silent no-op (no dialog ever appears), hence the warn below.
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
    } else {
      console.warn('[Replication] resolvedConflicts stream not found — push conflicts will not surface in the UI (rxdb version mismatch?)')
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
        // a connectivity loss. Log it; do not flip the online/offline status
        // and do not touch lastErrorTime (that tracks pull/push handler
        // failures only — see the 2s debounce in handlePull/handlePush).
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

  // User override: when set, it wins over navigator.onLine for the switch.
  // null = follow the browser (default). true = user forced Offline.
  // This is the ONLY place navigator.onLine is read (plus the online/offline
  // event listeners above) — consumers use the computed below, never the
  // navigator API directly.
  const userPaused = ref<null | boolean>(null)

  // Effective switch state, single source of truth for the header button.
  const effectivePaused = computed(() => userPaused.value ?? !browserOnline.value)

  function setPaused(paused: boolean) {
    if (!replicationState) return
    // true = user forces Offline; null = follow the browser (default).
    // Clearing the override on resume lets navigator.onLine drive the
    // switch again instead of pinning it to Online.
    userPaused.value = paused ? true : null
    if (paused) {
      replicationState.pause()
    } else {
      replicationState.start()
      // Status is deliberately left as-is: resuming triggers fetches whose
      // outcome updates `status` naturally (network error → 'unsynced',
      // success → 'synced'). Pausing is a user mode, not backend health.
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
    get paused() {
      // Effective Online/Offline switch state as a computed ref: user
      // override wins, otherwise follow navigator.onLine. Exposed as a ref
      // so consumers' computeds can track it reactively.
      return effectivePaused
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
