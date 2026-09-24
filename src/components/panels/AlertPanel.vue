<template>
  <v-alert
    v-if="activeConflict"
    variant="tonal"
    color="warning"
    density="compact"
    class="conflict-alert border mb-4"
    closable
    @click:close="dismiss"
  >
    <template #prepend>
      <v-icon icon="mdi-alert-circle-outline" color="warning" size="20" class="mr-2" />
    </template>

    <div class="d-flex flex-column">
      <!-- Header -->
      <div class="d-flex align-center justify-space-between mb-2">
        <span class="text-caption font-weight-bold text-uppercase text-medium-emphasis">
          Merge conflict — manual resolution required
        </span>
        <v-chip
          size="x-small"
          color="warning"
          variant="flat"
          class="font-weight-bold"
        >
          Conflict
        </v-chip>
      </div>

      <!-- Annotation identity -->
      <div class="d-flex align-center mb-3 pb-2" style="border-bottom: 1px solid rgba(255,255,255,0.08);">
        <v-icon icon="mdi-text-box-outline" size="16" class="mr-2 text-medium-emphasis" />
        <span class="text-body-2 font-weight-bold text-white">{{ activeConflict.serverState.title }}</span>
        <span class="text-caption ml-auto text-medium-emphasis">
          ID: {{ activeConflict.serverState.id }}
        </span>
      </div>

      <!-- Two-column comparison: server vs local -->
      <div class="d-flex flex-row flex-wrap gap-3">
        <!-- Server version (conflicting) -->
        <div class="d-flex flex-column flex-grow-1 min-width-200" style="max-width: 360px;">
          <div
            class="d-flex align-center px-3 py-1 rounded-lg"
            style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.25);"
          >
            <v-icon icon="mdi-cloud-off-outline" size="14" class="mr-1" color="error" />
            <span class="text-caption font-weight-bold text-error">Server version (conflict)</span>
          </div>
          <div class="px-3 pb-3 d-flex flex-column gap-1 text-caption">
            <div class="d-flex justify-space-between">
              <span class="text-medium-emphasis">Severity</span>
              <v-chip
                size="x-small"
                :color="severityColor(activeConflict.serverState.severity)"
                variant="flat"
                class="font-weight-bold"
              >
                {{ activeConflict.serverState.severity }}
              </v-chip>
            </div>
            <div class="d-flex justify-space-between">
              <span class="text-medium-emphasis">Status</span>
              <span class="font-weight-medium text-white">{{ activeConflict.serverState.status }}</span>
            </div>
            <div v-if="activeConflict.serverState.description" class="mt-1">
              <span class="text-medium-emphasis d-block">Description</span>
              <span class="text-white">{{ activeConflict.serverState.description }}</span>
            </div>
            <div v-if="activeConflict.serverState.templateValues && Object.keys(activeConflict.serverState.templateValues).length" class="mt-1">
              <span class="text-medium-emphasis d-block">Template values</span>
              <div
                class="d-flex flex-column gap-0"
                style="font-family: 'JetBrains Mono', monospace; font-size: 0.7rem;"
              >
                <div
                  v-for="(val, key) in activeConflict.serverState.templateValues"
                  :key="key"
                  class="d-flex justify-space-between"
                >
                  <span class="text-medium-emphasis">{{ key }}</span>
                  <span class="text-white break-all">{{ val }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Local version (what you tried to push) -->
        <div class="d-flex flex-column flex-grow-1 min-width-200" style="max-width: 360px;">
          <div
            class="d-flex align-center px-3 py-1 rounded-lg"
            style="background: rgba(59, 130, 246, 0.12); border: 1px solid rgba(59, 130, 246, 0.25);"
          >
            <v-icon icon="mdi-cloud-upload-outline" size="14" class="mr-1" color="info" />
            <span class="text-caption font-weight-bold text-info">Local version (your push)</span>
          </div>
          <div class="px-3 pb-3 d-flex flex-column gap-1 text-caption">
            <div class="d-flex justify-space-between">
              <span class="text-medium-emphasis">Severity</span>
              <v-chip
                size="x-small"
                :color="severityColor(activeConflict.localState.severity)"
                variant="flat"
                class="font-weight-bold"
              >
                {{ activeConflict.localState.severity }}
              </v-chip>
            </div>
            <div class="d-flex justify-space-between">
              <span class="text-medium-emphasis">Status</span>
              <span class="font-weight-medium text-white">{{ activeConflict.localState.status }}</span>
            </div>
            <div v-if="activeConflict.localState.description" class="mt-1">
              <span class="text-medium-emphasis d-block">Description</span>
              <span class="text-white">{{ activeConflict.localState.description }}</span>
            </div>
            <div v-if="activeConflict.localState.templateValues && Object.keys(activeConflict.localState.templateValues).length" class="mt-1">
              <span class="text-medium-emphasis d-block">Template values</span>
              <div
                class="d-flex flex-column gap-0"
                style="font-family: 'JetBrains Mono', monospace; font-size: 0.7rem;"
              >
                <div
                  v-for="(val, key) in activeConflict.localState.templateValues"
                  :key="key"
                  class="d-flex justify-space-between"
                >
                  <span class="text-medium-emphasis">{{ key }}</span>
                  <span class="text-white break-all">{{ val }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="d-flex align-center justify-space-between mt-3 pt-2" style="border-top: 1px solid rgba(255,255,255,0.08);">
        <div class="d-flex align-center gap-2">
          <v-btn
            size="small"
            variant="tonal"
            color="error"
            @click="useServerVersion"
          >
            <v-icon icon="mdi-cloud-check-outline" size="16" class="mr-1" />
            Use server version
          </v-btn>
          <v-btn
            size="small"
            variant="tonal"
            color="info"
            @click="keepLocalVersion"
          >
            <v-icon icon="mdi-content-save-outline" size="16" class="mr-1" />
            Keep local version
          </v-btn>
        </div>
        <v-btn
          size="small"
          variant="text"
          color="medium-emphasis"
          @click="dismiss"
        >
          Dismiss
        </v-btn>
      </div>
    </div>
  </v-alert>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DefectAnnotation } from '@/types'

interface ConflictData {
  serverState: DefectAnnotation
  localState: DefectAnnotation
  resolvedState: DefectAnnotation | null
}

const props = defineProps<{
  activeConflict: ConflictData | null
}>()

const emit = defineEmits<{
  (e: 'dismiss'): void
  (e: 'use-server', serverState: DefectAnnotation): void
  (e: 'keep-local', localState: DefectAnnotation): void
}>()

function dismiss() {
  emit('dismiss')
}

function useServerVersion() {
  if (!props.activeConflict) return
  emit('use-server', props.activeConflict.serverState)
}

function keepLocalVersion() {
  if (!props.activeConflict) return
  emit('keep-local', props.activeConflict.localState)
}

function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'error'
    case 'high': return 'error'
    case 'medium': return 'warning'
    case 'low': return 'info'
    default: return 'default'
  }
}
</script>

<style scoped>
.conflict-alert {
  position: absolute !important;
  bottom: 16px;
  right: 16px;
  left: 16px;
  z-index: 999;
}
</style>
