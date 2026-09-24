<template>
  <v-dialog
    :model-value="!!activeConflict"
    persistent
    no-click-animation
    scrollable
    width="50%"
  >
    <v-card v-if="activeConflict" color="surface" rounded="lg" elevation="12" class="conflict-card border">
      <!-- Header -->
      <v-card-title class="d-flex align-center pt-4 px-5 pb-2">
        <v-icon icon="mdi-alert-circle-outline" color="warning" size="26" class="mr-3" />
        <div class="d-flex flex-column">
          <span class="font-weight-bold text-h6">Merge conflict — manual resolution required</span>
          <span class="text-caption text-medium-emphasis">
            The server rejected your push — a conflicting version exists remotely
          </span>
        </div>
        <v-spacer />
        <v-chip size="small" color="warning" variant="flat" class="font-weight-bold">
          Conflict
        </v-chip>
      </v-card-title>

      <v-divider />

      <v-card-text class="px-5 pt-4">
        <!-- Annotation identity -->
        <div class="d-flex align-center mb-4 pb-3" style="border-bottom: 1px solid rgba(255,255,255,0.08);">
          <v-icon icon="mdi-text-box-outline" size="18" class="mr-2 text-medium-emphasis" />
          <span class="text-body-1 font-weight-bold text-white">{{ activeConflict.serverState.title }}</span>
          <span class="text-caption ml-auto text-medium-emphasis">
            ID: {{ activeConflict.serverState.id }}
          </span>
        </div>

        <!-- Two-column comparison: server vs local -->
        <div class="d-flex flex-row flex-wrap gap-4">
          <!-- Server version (conflicting) -->
          <div class="d-flex flex-column conflict-col">
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
          <div class="d-flex flex-column conflict-col">
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
      </v-card-text>

      <v-divider />

      <!-- Action buttons -->
      <v-card-actions class="px-5 py-3">
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
        <v-spacer />
        <v-btn
          size="small"
          variant="text"
          color="medium-emphasis"
          @click="dismiss"
        >
          Dismiss
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
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
/* Width is set via the dialog's width prop (50% of viewport) — the card
   stretches to fill it. Do NOT set width on the card: the dialog's
   .v-overlay__content wrapper is full-width and a narrower card inside it
   left-aligns instead of centering. */
.conflict-col {
  flex: 1 1 320px;
}
</style>
