import { createReplicationService } from '@/services/replication.service'
import { type TrendspekDatabase } from '@/database'
import type { NotifyFn } from '@/types'

export function useReplicationService(db: TrendspekDatabase, notify: NotifyFn) {
  const replicationService = createReplicationService(db)

  replicationService.onStatusChange = (newStatus: 'synced' | 'unsynced') => {
    console.log(`[Replication Status] ${newStatus}`)
    if (newStatus === 'unsynced') {
      notify('Backend unreachable - not syncing', { color: 'warning', icon: 'mdi-cloud-off-outline' })
    }
  }

  replicationService.onPushSuccess = (docs: any[]) => {
    console.log('[Push] push success - docs:', docs.length)
    const titles = docs.map(d => `"${(d as any).title ?? d.id}"`).join(', ')
    notify(`${docs.length} annotation${docs.length !== 1 ? 's' : ''} persisted on server: ${titles}`, { color: 'success', icon: 'mdi-cloud-check' })
  }

  replicationService.onMergeResult = () => {
    notify('Property level merge successful - changes persisted on server', { color: 'success', icon: 'mdi-cloud-check', timeout: 0, closable: true })
  }

  const start = async () => {
    try {
      await replicationService.start()
      notify('Replication active - synced with server', { color: 'success', icon: 'mdi-cloud-check' })
    } catch (err) {
      console.error('[Replication Init Error]:', err)
      notify('Backend unreachable - running offline', { color: 'warning', icon: 'mdi-cloud-off-outline' })
    }
  }

  start()

  return { replicationService, replicationStatus: replicationService.status }
}
