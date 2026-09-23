<template>
  <v-app class="trendspek-app">
    <!-- Top App Bar -->
    <AppHeader
      :replication-status="replicationStatus"
      @toggle-online-override="toggleOnlineOverride"
    />

    <!-- Main Viewport Area -->
    <v-main class="main-viewport-container">
      <!-- Left Panel: Annotations for current 3D Model asset -->
      <LeftAnnotationPanel
        :annotations="filteredAnnotations"
        :templates="templates"
        :total-for-asset="totalForAsset"
        @fly-to-annotation="handleFlyToAnnotation"
        @visible-ids="setVisibleIds"
      />

      <!-- Center 3D Viewport: CesiumJS Canvas with Demo Building Structure -->
      <CesiumViewer
      ref="cesiumViewerRef"
      :annotations="filteredAnnotations"
      @add-annotation-at="handleAddAnnotationAtPosition"
      />

      <!-- Right Panel: Template and metadata for current selected annotation -->
      <RightTemplatePanel
        :selected-annotation="selectedAnnotation"
        :templates="templates"
        @update-annotation="handleUpdateAnnotation"
        @delete-annotation="handleDeleteAnnotation"
        @fly-to-annotation="handleFlyToAnnotation"
      />
    </v-main>

    <!-- New Annotation Dialog (when dropping pin on 3D surface) -->
    <v-dialog v-model="showNewDefectDialog" max-width="500">
      <v-card color="surface" class="border">
        <v-card-title class="d-flex align-center pt-4 px-5">
          <v-icon icon="mdi-map-marker-plus" color="primary" class="mr-2"></v-icon>
          <span class="font-weight-bold text-h6">Record New Defect</span>
        </v-card-title>
        <v-card-text class="px-5 pt-2">
          <div class="text-caption text-medium-emphasis mb-3">
            Surface coordinate captured from Cesium 3D depth buffer:
            <code class="text-primary d-block mt-1 font-mono text-caption">
              [{{ pendingCoords?.map(n => n.toFixed(1)).join(', ') }}]
            </code>
          </div>

          <v-text-field
            v-model="newDefectTitle"
            label="Defect Title / Summary"
            placeholder="e.g., Concrete Cracking on South Pier"
            variant="outlined"
            density="compact"
            class="mb-3"
            autofocus
          ></v-text-field>

          <v-select
            v-model="newDefectTemplateId"
            :items="templateSelectOptions"
            label="Select Inspection Template"
            variant="outlined"
            density="compact"
            class="mb-3"
          ></v-select>

          <v-select
            v-model="newDefectSeverity"
            :items="[
              { title: 'Critical', value: 'critical' },
              { title: 'High', value: 'high' },
              { title: 'Medium', value: 'medium' },
              { title: 'Low', value: 'low' }
            ]"
            label="Initial Severity"
            variant="outlined"
            density="compact"
          ></v-select>
        </v-card-text>
        <v-card-actions class="px-5 pb-4">
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="showNewDefectDialog = false">Cancel</v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :disabled="!newDefectTitle.trim()"
            @click="confirmAddDefect"
          >
            Create Defect & Open Template
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Global Notification Snackbar -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      timeout="3000"
      location="bottom right"
      rounded="lg"
    >
      <div class="d-flex align-center">
        <v-icon :icon="snackbar.icon" class="mr-2" size="18"></v-icon>
        <span class="text-body-2 font-weight-medium">{{ snackbar.text }}</span>
      </div>
    </v-snackbar>
  </v-app>
</template>

<script setup lang="ts">
import { ref, computed, watch, type Ref } from 'vue'
import { type TrendspekDatabase } from '@/database'
import { type ReplicationService } from '@/services/replication.service'
import { useUiStore } from '@/stores/ui.store'
import type { ReplicationStatus, DefectAnnotation, Severity } from '@/types'
import { useDb } from '@/composables/database'
import { useReplicationService } from '@/composables/replicationService'

import AppHeader from '@/components/layout/AppHeader.vue'
import LeftAnnotationPanel from '@/components/panels/LeftAnnotationPanel.vue'
import RightTemplatePanel from '@/components/panels/RightTemplatePanel.vue'
import CesiumViewer from '@/components/cesium/CesiumViewer.vue'

const uiStore = useUiStore()
const cesiumViewerRef = ref<InstanceType<typeof CesiumViewer> | null>(null)

// Replication service
let replicationService: ReplicationService | null = null
let replicationStatus: Ref<ReplicationStatus>

// RxDB Database instance & reactive datasets
const dbComposition = useDb(notify)
const { annotations, ready, templates } = dbComposition
let db: TrendspekDatabase | null = null

watch(ready, (dbReady: boolean) => {
  if (dbReady) {
    db = dbComposition.db()

    const replSvc = useReplicationService(db!, notify)
    replicationService = replSvc.replicationService
    replicationStatus = replSvc.replicationStatus
  }
}, { immediate: true })

// Selected annotation for Right Panel
const selectedAnnotation = computed(() => {
  if (!uiStore.selectedAnnotationId) return null
  return annotations.value.find((a) => a.id === uiStore.selectedAnnotationId) || null
})

// Filtered annotations: current asset + search query — shared by panel and 3D viewer
const filteredAnnotations = computed(() => {
  const q = (uiStore.searchQuery ?? '').trim().toLowerCase()
  return annotations.value.filter((a) => {
    // Asset scope
    if (a.assetId !== uiStore.currentAssetId) return false
    // Search filter
    if (q) {
      const titleMatch = a.title.toLowerCase().includes(q)
      const descMatch = a.description?.toLowerCase().includes(q)
      const authorMatch = a.author?.toLowerCase().includes(q)
      if (!titleMatch && !descMatch && !authorMatch) return false
    }
    return true
  })
})

// DB total annotations for the current asset (unfiltered by search)
const totalForAsset = computed(() =>
  annotations.value.filter((a) => a.assetId === uiStore.currentAssetId).length
)

// IDs of annotations currently rendered in the virtual scroll viewport
const visibleAnnotationIds = ref<Set<string>>(new Set())

function setVisibleIds(ids: Set<string>) {
  visibleAnnotationIds.value = ids
  cesiumViewerRef.value?.syncAnnotationsToScene(filteredAnnotations.value, ids)
}

// New defect creation state
const showNewDefectDialog = ref(false)
const pendingCoords = ref<[number, number, number] | null>(null)
const newDefectTitle = ref('')
const newDefectTemplateId = ref('tpl-facade-spalling')
const newDefectSeverity = ref<Severity>('high')

const templateSelectOptions = computed(() => {
  return templates.value.map((t) => ({
    title: t.name,
    value: t.id
  }))
})

// Snackbar notification state
const snackbar = ref({
  show: false,
  text: '',
  color: 'success',
  icon: 'mdi-check-circle-outline'
})

function notify(text: string, color: string = 'success', icon: string = 'mdi-check-circle-outline') {
  snackbar.value = { show: true, text, color, icon }
}

function handleFlyToAnnotation(coords: [number, number, number]) {
  if (cesiumViewerRef.value) {
    cesiumViewerRef.value.flyToCoordinates(coords)
  }
}

function handleAddAnnotationAtPosition(coords: [number, number, number]) {
  pendingCoords.value = coords
  newDefectTitle.value = `Defect #${annotations.value.length + 1} - Inspected Surface`
  showNewDefectDialog.value = true
}

async function confirmAddDefect() {
  if (!db || !pendingCoords.value) return

  const selectedTpl = templates.value.find((t) => t.id === newDefectTemplateId.value)
  const defaultValues: Record<string, any> = {}
  if (selectedTpl?.fields) {
    for (const f of selectedTpl.fields) {
      if (f.defaultValue !== undefined) {
        defaultValues[f.key] = f.defaultValue
      }
    }
  }

  const newId = `defect-${Date.now()}`

  const newDefect: DefectAnnotation = {
    id: newId,
    assetId: uiStore.currentAssetId,
    title: newDefectTitle.value.trim(),
    description: 'Recorded from 3D surface depth pick.',
    severity: newDefectSeverity.value,
    status: 'open',
    positionXyz: [...pendingCoords.value!],
    templateId: newDefectTemplateId.value,
    templateValues: defaultValues,
    author: 'Field Inspector',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  try {
    await db.annotations.insert(newDefect)
    showNewDefectDialog.value = false

    // Select new defect, open right template panel
    uiStore.selectAnnotation(newId)
    notify(`Added "${newDefect.title}" to local IndexedDB`, 'success', 'mdi-map-marker-check')
  } catch (err) {
    console.error('Failed to insert defect into RxDB:', err)
    notify('Failed to save defect', 'error', 'mdi-alert-circle')
  }
}

async function handleUpdateAnnotation(updated: DefectAnnotation) {
  if (!db) return
  try {
    const doc = await db.annotations.findOne(updated.id).exec()
    if (doc) {
      await doc.patch(updated)
    }
  } catch (err) {
    console.error('Failed to update defect in RxDB:', err)
    notify('Failed to save changes', 'error', 'mdi-alert-circle')
  }
}

async function handleDeleteAnnotation(id: string) {
  if (!db) return
  try {
    const doc = await db.annotations.findOne(id).exec()
    if (doc) {
      await doc.remove()
      uiStore.closeRightPanel()
      notify('Defect deleted from local database', 'info', 'mdi-trash-can')
    }
  } catch (err) {
    console.error('Failed to delete defect from RxDB:', err)
    notify('Failed to delete defect', 'error', 'mdi-alert-circle')
  }
}

function toggleOnlineOverride() {
  if (!replicationService) return
  const isUnsynced = replicationService.status.value === 'unsynced'
  replicationService.setPaused(!isUnsynced)
}
</script>

<style>
/* Global Trendspek Dark Theme Styles */
html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background-color: #0B111E;
}

.trendspek-app {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: #0B111E !important;
}

.main-viewport-container {
  position: relative;
  width: 100%;
  height: calc(100vh - 48px);
  padding: 0 !important;
  overflow: hidden;
}

/* Custom Scrollbars */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: #0B111E;
}
::-webkit-scrollbar-thumb {
  background: #24324E;
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: #38BDF8;
}
</style>
