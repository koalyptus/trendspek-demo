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
          <v-tooltip text="Activate 3D Pin Drop Mode" location="bottom">
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                size="small"
                color="primary"
                variant="flat"
                prepend-icon="mdi-plus"
                class="font-weight-bold text-caption text-uppercase"
                style="color: #0B111E !important;"
                @click="enableAddDefect"
              >
                New Defect
              </v-btn>
            </template>
          </v-tooltip>

          <v-btn
            icon="mdi-chevron-left"
            variant="text"
            size="small"
            class="ml-1"
            @click="uiStore.toggleLeftPanel"
          ></v-btn>
        </div>
      </div>

      <!-- Search & Severity Filter Bar -->
      <div class="pa-2 border-b">
        <v-text-field
          v-model="searchQuery"
          placeholder="Filter defects by title or author..."
          density="compact"
          variant="solo-filled"
          prepend-inner-icon="mdi-magnify"
          clearable
          hide-details
          class="mb-2 search-field text-caption"
          rounded="lg"
        ></v-text-field>

        <!-- Severity Chips Filter -->
        <div class="d-flex gap-1 overflow-x-auto py-1 filter-chips">
          <v-chip
            size="x-small"
            :variant="selectedSeverity === null ? 'flat' : 'outlined'"
            :color="selectedSeverity === null ? 'primary' : undefined"
            class="cursor-pointer"
            @click="selectedSeverity = null"
          >
            All ({{ annotations.length }})
          </v-chip>
          <v-chip
            size="x-small"
            :variant="selectedSeverity === 'critical' ? 'flat' : 'outlined'"
            color="error"
            class="cursor-pointer"
            @click="selectedSeverity = selectedSeverity === 'critical' ? null : 'critical'"
          >
            Critical ({{ counts.critical }})
          </v-chip>
          <v-chip
            size="x-small"
            :variant="selectedSeverity === 'high' ? 'flat' : 'outlined'"
            color="warning"
            class="cursor-pointer"
            @click="selectedSeverity = selectedSeverity === 'high' ? null : 'high'"
          >
            High ({{ counts.high }})
          </v-chip>
          <v-chip
            size="x-small"
            :variant="selectedSeverity === 'medium' ? 'flat' : 'outlined'"
            color="info"
            class="cursor-pointer"
            @click="selectedSeverity = selectedSeverity === 'medium' ? null : 'medium'"
          >
            Medium ({{ counts.medium }})
          </v-chip>
          <v-chip
            size="x-small"
            :variant="selectedSeverity === 'low' ? 'flat' : 'outlined'"
            color="success"
            class="cursor-pointer"
            @click="selectedSeverity = selectedSeverity === 'low' ? null : 'low'"
          >
            Low ({{ counts.low }})
          </v-chip>
        </div>
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

        <!-- Annotation Cards -->
        <v-slide-y-transition group>
          <v-card
            v-for="item in filteredAnnotations"
            :key="item.id"
            :color="uiStore.selectedAnnotationId === item.id ? 'surface-variant' : 'surface'"
            :class="[
              'mb-2 annotation-card cursor-pointer border transition-swing',
              { 'active-card elevation-4': uiStore.selectedAnnotationId === item.id }
            ]"
            variant="elevated"
            rounded="lg"
            @click="handleSelect(item)"
            @mouseenter="uiStore.setHoveredAnnotation(item.id)"
            @mouseleave="uiStore.setHoveredAnnotation(null)"
          >
            <div class="pa-3">
              <!-- Top Row: Severity & Status Chips -->
              <div class="d-flex align-center justify-space-between mb-1">
                <v-chip
                  size="x-small"
                  :color="getSeverityColor(item.severity)"
                  variant="flat"
                  class="font-weight-bold text-uppercase"
                  label
                >
                  <v-icon start icon="mdi-alert-circle-outline" size="12"></v-icon>
                  {{ item.severity }}
                </v-chip>

                <div class="d-flex align-center gap-1">
                  <v-chip
                    size="x-small"
                    variant="tonal"
                    :color="getStatusColor(item.status)"
                    class="text-capitalize font-weight-medium"
                  >
                    {{ item.status.replace('_', ' ') }}
                  </v-chip>

                  <!-- Quick Fly Button -->
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
              </div>

              <!-- Title -->
              <div class="text-body-2 font-weight-bold text-white mb-1 line-clamp-2">
                {{ item.title }}
              </div>

              <!-- Description Preview -->
              <div v-if="item.description" class="text-caption text-medium-emphasis mb-2 line-clamp-2">
                {{ item.description }}
              </div>

              <!-- Meta Row: Template info & coordinates -->
              <div class="d-flex align-center justify-space-between text-caption pt-1 border-t" style="font-size: 0.7rem !important;">
                <div class="d-flex align-center text-medium-emphasis">
                  <v-icon icon="mdi-file-document-outline" size="12" class="mr-1"></v-icon>
                  <span class="text-truncate" style="max-width: 160px;">
                    {{ getTemplateName(item.templateId) }}
                  </span>
                </div>

                <div class="text-primary font-weight-medium d-flex align-center">
                  <span>Template & Details</span>
                  <v-icon icon="mdi-chevron-right" size="14"></v-icon>
                </div>
              </div>
            </div>
          </v-card>
        </v-slide-y-transition>
      </div>

      <!-- Panel Footer -->
      <div class="pa-2 border-t bg-surface-variant d-flex align-center justify-space-between text-caption text-medium-emphasis">
        <span style="font-size: 0.7rem;">Live IndexedDB Sync</span>
        <v-chip size="x-small" variant="text" color="primary" class="font-weight-medium">
          60 FPS Main Thread Safe
        </v-chip>
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
  (e: 'select-annotation', annotation: DefectAnnotation): void
  (e: 'fly-to-annotation', coords: [number, number, number]): void
}>()

const uiStore = useUiStore()
const searchQuery = ref('')
const selectedSeverity = ref<Severity | null>(null)

// Asset-scoped annotations
const currentAssetAnnotations = computed(() => {
  return props.annotations.filter((item) => item.assetId === uiStore.currentAssetId)
})

// Counts by severity for current asset
const counts = computed(() => {
  const result = { critical: 0, high: 0, medium: 0, low: 0 }
  for (const item of currentAssetAnnotations.value) {
    if (item.severity in result) {
      result[item.severity as Severity]++
    }
  }
  return result
})

// Filtered annotations based on search & severity
const filteredAnnotations = computed(() => {
  return currentAssetAnnotations.value.filter((item) => {
    if (selectedSeverity.value && item.severity !== selectedSeverity.value) {
      return false
    }
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

function getStatusColor(status: DefectStatus): string {
  switch (status) {
    case 'open': return 'error'
    case 'in_progress': return 'warning'
    case 'resolved': return 'success'
    default: return 'medium-emphasis'
  }
}

function getTemplateName(templateId: string): string {
  const tpl = props.templates.find((t) => t.id === templateId)
  return tpl ? tpl.name : 'Standard Inspection'
}

function handleSelect(item: DefectAnnotation) {
  // Select annotation in Pinia store & request camera fly
  uiStore.selectAnnotation(item.id, item.positionXyz)
  emit('select-annotation', item)
}

function flyToAnnotation(item: DefectAnnotation) {
  emit('fly-to-annotation', item.positionXyz)
}

function enableAddDefect() {
  uiStore.setActiveTool('add_annotation')
}
</script>

<style scoped>
.annotation-card {
  border-color: rgba(255, 255, 255, 0.08) !important;
  transition: all 0.2s ease-in-out;
}

.annotation-card:hover {
  border-color: rgba(0, 210, 181, 0.4) !important;
  transform: translateY(-1px);
}

.active-card {
  border-color: #00D2B5 !important;
  box-shadow: 0 0 12px rgba(0, 210, 181, 0.25) !important;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.filter-chips {
  gap: 4px;
}
</style>
