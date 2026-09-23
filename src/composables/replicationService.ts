import { onBeforeUnmount } from 'vue'
import { createReplicationService } from '@/services/replication.service'
import { type TrendspekDatabase } from '@/database'

export function useReplicationService(db: TrendspekDatabase, notify: (text: string, color?: string, icon?: string) => void) {
  const replicationService = createReplicationService(db)

  replicationService.onStatusChange = (newStatus: 'synced' | 'unsynced') => {
    console.log(`[Replication Status] ${newStatus}`)
    if (newStatus === 'unsynced') {
      notify('Backend unreachable — not syncing', 'warning', 'mdi-cloud-off-outline')
    }
  }

  replicationService.onPushSuccess = (docs: any[]) => {
    console.log('[Push] push success — docs:', docs.length)
    const titles = docs.map(d => `"${(d as any).title ?? d.id}"`).join(', ')
    notify(`${docs.length} annotation${docs.length !== 1 ? 's' : ''} persisted on server: ${titles}`, 'success', 'mdi-cloud-check')
  }

  const start = async () => {
    try {
      await replicationService.start()
      notify('Replication active — synced with server', 'success', 'mdi-cloud-check')
    } catch (err) {
      console.error('[Replication Init Error]:', err)
      notify('Backend unreachable — running offline', 'warning', 'mdi-cloud-off-outline')
    }
  }

  start()

  onBeforeUnmount(() => {
    if (replicationService) {
      replicationService.destroy()
    }
  })

  return { replicationService, replicationStatus: replicationService.status }
}
