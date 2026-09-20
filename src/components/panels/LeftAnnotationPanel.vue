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
              {{ currentAssetAnnotations.length }} on {{ uiStore.currentAsset.name }}
            </div>
          </div>
        </div>

        <div class="d-flex align-center">
          <v-btn
            icon="mdi-chevron-left"
            variant="text"
            size="small"
            class="ml-1"
            @click="uiStore.toggleLeftPanel"
          ></v-btn>
        </div>
      </div>


      <div class="pa-2 border-b">
        <v-text-field
          v-model="searchQuery"
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
      <div class="flex-grow-1 overflow-y-auto pa-2 list-container">
        <!-- Empty State -->
        <div
          v-if="filteredAnnotations.length === 0"
          class="d-flex flex-column align-center justify-center h-100 text-center py-10 px-4"
        >
          <v-avatar color="surface-variant" size="64" class="mb-3">
            <v-icon icon="mdi-map-marker-outline" size="32" color="medium-emphasis"></v-icon>
          </v-avatar>
          <div class="text-subtitle-2 font-weight-bold text-white mb-1">No Annotations Found</div>
          <div class="text-caption text-medium-emphasis mb-4" style="max-width: 240px;">
            {{ searchQuery ? 'No defects match the search criteria.' : 'Click "New Defect" or click anywhere on the 3D model canvas to drop an inspection marker.' }}
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

        <!-- Annotation Rows -->
        <v-list class="bg-transparent pa-0" density="compact">
          <v-slide-y-transition group>
            <v-list-item
              v-for="item in filteredAnnotations"
              :key="item.id"
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
          </v-slide-y-transition>
        </v-list>
      </div>

      <!-- Panel Footer -->
      <div class="pa-2 border-t bg-surface-variant d-flex align-center justify-space-between text-caption text-medium-emphasis">
      </div>
    </div>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import type { DefectAnnotation, Severity, DefectStatus, AnnotationTemplate } from '@/types'

const props = defineProps<{
  annotations: DefectAnnotation[]
  templates: AnnotationTemplate[]
}>()

const emit = defineEmits<{
  (e: 'fly-to-annotation', coords: [number, number, number]): void
}>()

const uiStore = useUiStore()
const searchQuery = ref('')

// Asset-scoped annotations
const currentAssetAnnotations = computed(() => {
  return props.annotations.filter((item) => item.assetId === uiStore.currentAssetId)
})

// Filtered annotations based on search
const filteredAnnotations = computed(() => {
  return currentAssetAnnotations.value.filter((item) => {
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      const titleMatch = item.title.toLowerCase().includes(q)
      const descMatch = item.description?.toLowerCase().includes(q)
      const authorMatch = item.author?.toLowerCase().includes(q)
      return titleMatch || descMatch || authorMatch
    }
    return true
  })
})

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
  // Select annotation & show inspection template
  uiStore.selectAnnotation(item.id)
  // Also show tooltip on the 3D model for this annotation
  uiStore.setHoveredAnnotation(item.id)
}

function flyToAnnotation(item: DefectAnnotation) {
  // Show tooltip on the 3D model for this annotation
  uiStore.setHoveredAnnotation(item.id)
  emit('fly-to-annotation', item.positionXyz)
}

function enableAddDefect() {
  uiStore.setActiveTool('add_annotation')
}
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
