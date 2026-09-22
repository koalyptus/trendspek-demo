<template>
  <v-navigation-drawer
    :model-value="uiStore.isLeftPanelOpen"
    location="left"
    width="380"
    color="surface"
    elevation="4"
    class="annotation-drawer"
    @update:model-value="(val) => uiStore.isLeftPanelOpen = val"
  >
    <div class="d-flex flex-column h-100">
      <!-- Panel Header -->
      <div class="pa-3 border-b bg-surface-variant d-flex align-center justify-space-between">
        <div class="d-flex align-center">
          <v-icon icon="mdi-clipboard-list-outline" color="primary" class="mr-2"></v-icon>
          <div>
            <div class="text-subtitle-2 font-weight-bold text-white">Annotations</div>
            <div class="text-caption text-medium-emphasis" style="font-size: 0.72rem !important;">
              {{ uiStore.currentAsset.name }}
            </div>
          </div>
        </div>

        <div class="d-flex align-center">
          <v-btn
            icon="mdi-chevron-left"
            variant="text"
            size="small"
            class="ml-1 text-white"
            @click="uiStore.toggleLeftPanel"
          ></v-btn>
        </div>
      </div>


      <div class="pa-2 border-b">
        <v-text-field
          v-model="uiStore.searchQuery"
          placeholder="Filter defects by title or author..."
          density="compact"
          variant="solo-filled"
          prepend-inner-icon="mdi-magnify"
          clearable
          hide-details
          class="search-field text-caption"
          rounded="lg"
        ></v-text-field>
      </div>

      <!-- Annotations List Body -->
      <div
        ref="listContainerRef"
        class="flex-grow-1 overflow-y-auto pa-2 list-container"
        @scroll="onScroll"
      >
        <!-- Empty State -->
        <div
          v-if="annotations.length === 0"
          class="d-flex flex-column align-center justify-center h-100 text-center py-10 px-4"
        >
          <v-avatar color="surface-variant" size="64" class="mb-3">
            <v-icon icon="mdi-map-marker-outline" size="32" color="medium-emphasis"></v-icon>
          </v-avatar>
          <div class="text-subtitle-2 font-weight-bold text-white mb-1">No Annotations Found</div>
          <div class="text-caption text-medium-emphasis mb-4" style="max-width: 240px;">
            {{ uiStore.searchQuery ? 'No defects match the search criteria.' : 'Click "New Defect" or click anywhere on the 3D model canvas to drop an inspection marker.' }}
          </div>
          <v-btn
            color="primary"
            variant="tonal"
            size="small"
            prepend-icon="mdi-map-marker-plus"
            @click="enableAddDefect"
          >
            Drop First Marker
          </v-btn>
        </div>

        <!-- Annotation Rows (virtualized) -->
        <v-virtual-scroll
          v-else
          :items="annotations"
          class="annotation-virtual-scroll"
        >
          <template #default="{ item }">
            <v-list-item
              :key="item.id"
              :ref="measureItemHeight"
              :class="[
                'annotation-row mb-1 cursor-pointer rounded-lg',
                { 'active-row': uiStore.selectedAnnotationId === item.id }
              ]"
              :active="uiStore.selectedAnnotationId === item.id"
              color="primary"
              @click="handleSelect(item)"
            >
              <template #prepend>
                <v-icon
                  :icon="getSeverityIcon(item.severity)"
                  :color="getSeverityColor(item.severity)"
                  size="18"
                  class="mr-2"
                ></v-icon>
              </template>

              <v-list-item-title class="text-body-2 font-weight-medium text-white text-truncate">
                {{ item.title }}
              </v-list-item-title>

              <template #append>
                <div class="d-flex align-center gap-1">
                  <v-chip
                    size="x-small"
                    variant="tonal"
                    :color="getStatusColor(item.status)"
                    class="text-capitalize font-weight-medium"
                  >
                    {{ item.status.replace('_', ' ') }}
                  </v-chip>

                  <v-tooltip text="Focus 3D Viewport on Marker" location="top">
                    <template #activator="{ props }">
                      <v-btn
                        v-bind="props"
                        icon="mdi-crosshairs-gps"
                        size="x-small"
                        variant="text"
                        color="secondary"
                        @click.stop="flyToAnnotation(item)"
                      ></v-btn>
                    </template>
                  </v-tooltip>
                </div>
              </template>
            </v-list-item>
          </template>
        </v-virtual-scroll>
      </div>

      <!-- Panel Footer -->
      <div class="pa-2 border-t bg-surface-variant d-flex align-center justify-space-between text-caption text-medium-emphasis">
        <span class="text-white">Displayed: {{ visibleCount }}</span>
        <span class="text-white">{{ totalForAsset }} total</span>
      </div>
    </div>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import type { DefectAnnotation, Severity, DefectStatus, AnnotationTemplate } from '@/types'

const props = defineProps<{
  annotations: DefectAnnotation[]
  templates: AnnotationTemplate[]
  totalForAsset: number
}>()

const emit = defineEmits<{
  (e: 'fly-to-annotation', coords: [number, number, number]): void
  (e: 'visible-ids', ids: Set<string>): void
}>()

const uiStore = useUiStore()

const listContainerRef = ref<HTMLElement | null>(null)
const measuredItemHeight = ref(0)
const visibleCount = ref(0)

function measureItemHeight(el: any) {
  const dom = (el as any)?.$el ?? el
  if (dom && measuredItemHeight.value === 0) {
    measuredItemHeight.value = dom.offsetHeight ?? 0
  }
  return el
}

function onScroll() {
  if (!listContainerRef.value) return
  const container = listContainerRef.value
  const { scrollTop, clientHeight } = container
  const itemHeight = measuredItemHeight.value || 52
  const startIdx = Math.max(0, Math.floor(scrollTop / itemHeight) - 1)
  const endIdx = Math.min(
    props.annotations.length,
    Math.ceil((scrollTop + clientHeight) / itemHeight) + 1
  )
  const visible = new Set<string>()
  for (let i = startIdx; i < endIdx; i++) {
    visible.add(props.annotations[i].id)
  }
  visibleCount.value = visible.size
  emit('visible-ids', visible)
}

function getSeverityColor(sev: Severity): string {
  switch (sev) {
    case 'critical': return 'error'
    case 'high': return 'warning'
    case 'medium': return 'info'
    case 'low': return 'success'
    default: return 'primary'
  }
}

function getSeverityIcon(sev: Severity): string {
  switch (sev) {
    case 'critical': return 'mdi-alert-octagon'
    case 'high': return 'mdi-alert-circle'
    case 'medium': return 'mdi-alert'
    case 'low': return 'mdi-information'
    default: return 'mdi-map-marker'
  }
}

function getStatusColor(status: DefectStatus): string {
  switch (status) {
    case 'open': return 'error'
    case 'in_progress': return 'warning'
    case 'resolved': return 'success'
    default: return 'medium-emphasis'
  }
}

function handleSelect(item: DefectAnnotation) {
  uiStore.selectAnnotation(item.id)
  uiStore.setHoveredAnnotation(item.id)
}

function flyToAnnotation(item: DefectAnnotation) {
  uiStore.setHoveredAnnotation(item.id)
  emit('fly-to-annotation', item.positionXyz)
}

function enableAddDefect() {
  uiStore.setActiveTool('add_annotation')
}

// --- Visible-ID tracking for 3D model sync ---

function computeVisibleIds() {
  onScroll()
}

onMounted(async () => {
  await nextTick()
  setTimeout(computeVisibleIds, 50)
})

watch(() => props.annotations, () => {
  nextTick(() => setTimeout(computeVisibleIds, 50))
}, { deep: true })
watch(() => uiStore.searchQuery, () => {
  nextTick(() => setTimeout(computeVisibleIds, 50))
})
</script>

<style scoped>
.annotation-row {
  border: 1px solid rgba(255, 255, 255, 0.06) !important;
  transition: all 0.2s ease-in-out;
}

.annotation-row:hover {
  border-color: rgba(0, 210, 181, 0.4) !important;
  background: rgba(0, 210, 181, 0.05);
}

.active-row {
  border-color: #00D2B5 !important;
  box-shadow: 0 0 8px rgba(0, 210, 181, 0.2);
}

.filter-chips {
  gap: 4px;
}
</style>
