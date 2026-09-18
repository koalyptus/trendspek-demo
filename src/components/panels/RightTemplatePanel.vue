<template>
  <v-navigation-drawer
    :model-value="uiStore.isRightPanelOpen"
    location="right"
    width="440"
    color="surface"
    elevation="4"
    border="s"
    class="template-drawer"
    @update:model-value="(val) => uiStore.isRightPanelOpen = val"
  >
    <div class="d-flex flex-column h-100">
      <!-- Panel Header -->
      <div class="pa-3 border-b bg-surface-variant d-flex align-center justify-space-between">
        <div class="d-flex align-center">
          <v-icon icon="mdi-form-select" color="secondary" class="mr-2"></v-icon>
          <div>
            <div class="text-subtitle-2 font-weight-bold text-white">Inspection Template</div>
            <div class="text-caption text-medium-emphasis" style="font-size: 0.72rem !important;">
              {{ currentTemplate?.name || 'Defect Metadata & Attributes' }}
            </div>
          </div>
        </div>

        <div class="d-flex align-center">
          <v-btn
            icon="mdi-close"
            variant="text"
            size="small"
            @click="uiStore.closeRightPanel"
          ></v-btn>
        </div>
      </div>

      <!-- Main Body -->
      <div v-if="selectedAnnotation" class="flex-grow-1 overflow-y-auto pa-4">
        <!-- Template Header Card -->
        <v-card color="surface-variant" variant="flat" rounded="lg" class="pa-3 mb-4 border">
          <div class="d-flex align-center justify-space-between mb-1">
            <span class="text-caption font-weight-bold text-secondary text-uppercase" style="letter-spacing: 0.5px;">
              Active Template
            </span>
            <v-chip size="x-small" color="secondary" variant="tonal">
              v{{ currentTemplate?.version || '1.0' }}
            </v-chip>
          </div>
          <div class="text-subtitle-1 font-weight-bold text-white mb-1">
            {{ currentTemplate?.name }}
          </div>
          <div class="text-caption text-medium-emphasis mb-2">
            {{ currentTemplate?.description }}
          </div>
          <div class="d-flex align-center">
            <v-chip size="x-small" color="primary" variant="outlined" class="mr-2">
              {{ currentTemplate?.category }}
            </v-chip>
            <span class="text-caption text-disabled" style="font-size: 0.7rem !important;">
              Schema ID: {{ currentTemplate?.id }}
            </span>
          </div>
        </v-card>

        <!-- Core Defect Fields Form -->
        <div class="text-caption font-weight-bold text-white text-uppercase mb-2" style="letter-spacing: 0.5px;">
          1. General Defect Information
        </div>

        <v-text-field
          v-model="formTitle"
          label="Defect Title"
          density="compact"
          variant="outlined"
          class="mb-3"
          hide-details="auto"
        ></v-text-field>

        <v-textarea
          v-model="formDescription"
          label="Detailed Defect Description"
          density="compact"
          variant="outlined"
          rows="2"
          class="mb-3"
          hide-details="auto"
        ></v-textarea>

        <div class="d-flex gap-2 mb-3">
          <!-- Severity Select -->
          <v-select
            v-model="formSeverity"
            :items="severityOptions"
            label="Severity"
            density="compact"
            variant="outlined"
            class="flex-1"
            hide-details
          >
            <template #selection="{ item }">
              <v-chip size="x-small" :color="getSeverityColor(item.value)" variant="flat" class="font-weight-bold">
                {{ item.title }}
              </v-chip>
            </template>
          </v-select>

          <!-- Status Select -->
          <v-select
            v-model="formStatus"
            :items="statusOptions"
            label="Status"
            density="compact"
            variant="outlined"
            class="flex-1"
            hide-details
          ></v-select>
        </div>

        <v-divider class="my-4"></v-divider>

        <!-- Spatial 3D Coordinates -->
        <div class="text-caption font-weight-bold text-white text-uppercase mb-2 d-flex align-center justify-space-between" style="letter-spacing: 0.5px;">
          <span>2. 3D Spatial Position (CesiumJS)</span>
          <v-btn
            size="x-small"
            variant="text"
            color="secondary"
            prepend-icon="mdi-crosshairs-gps"
            @click="flyToCurrent"
          >
            Fly To Point
          </v-btn>
        </div>

        <v-card color="background" variant="flat" rounded="lg" class="pa-3 mb-4 border font-mono text-caption">
          <div class="d-flex justify-space-between mb-1">
            <span class="text-disabled">Cartesian X:</span>
            <span class="text-white">{{ selectedAnnotation.positionXyz[0].toFixed(2) }}</span>
          </div>
          <div class="d-flex justify-space-between mb-1">
            <span class="text-disabled">Cartesian Y:</span>
            <span class="text-white">{{ selectedAnnotation.positionXyz[1].toFixed(2) }}</span>
          </div>
          <div class="d-flex justify-space-between">
            <span class="text-disabled">Cartesian Z:</span>
            <span class="text-white">{{ selectedAnnotation.positionXyz[2].toFixed(2) }}</span>
          </div>
        </v-card>

        <v-divider class="my-4"></v-divider>

        <!-- Dynamic Template Attributes Form -->
        <div class="text-caption font-weight-bold text-white text-uppercase mb-2" style="letter-spacing: 0.5px;">
          3. {{ currentTemplate?.name }} Fields
        </div>

        <div v-if="currentTemplate?.fields && currentTemplate.fields.length > 0">
          <div v-for="field in currentTemplate.fields" :key="field.key" class="mb-3">
            <!-- Text input -->
            <v-text-field
              v-if="field.type === 'text'"
              v-model="formTemplateValues[field.key]"
              :label="field.label + (field.unit ? ` (${field.unit})` : '')"
              density="compact"
              variant="outlined"
              hide-details="auto"
            ></v-text-field>

            <!-- Number input -->
            <v-text-field
              v-else-if="field.type === 'number'"
              v-model.number="formTemplateValues[field.key]"
              :label="field.label + (field.unit ? ` (${field.unit})` : '')"
              type="number"
              step="any"
              density="compact"
              variant="outlined"
              hide-details="auto"
            ></v-text-field>

            <!-- Select dropdown -->
            <v-select
              v-else-if="field.type === 'select'"
              v-model="formTemplateValues[field.key]"
              :items="field.options || []"
              :label="field.label"
              density="compact"
              variant="outlined"
              hide-details="auto"
            ></v-select>

            <!-- Textarea -->
            <v-textarea
              v-else-if="field.type === 'textarea'"
              v-model="formTemplateValues[field.key]"
              :label="field.label"
              density="compact"
              variant="outlined"
              rows="2"
              hide-details="auto"
            ></v-textarea>

            <!-- Boolean Switch -->
            <v-switch
              v-else-if="field.type === 'boolean'"
              v-model="formTemplateValues[field.key]"
              :label="field.label"
              color="primary"
              density="compact"
              hide-details
            ></v-switch>
          </div>
        </div>

        <div v-else class="text-caption text-medium-emphasis">
          No custom template fields specified for this template.
        </div>

        <v-divider class="my-4"></v-divider>

        <!-- Audit Details -->
        <div class="text-caption text-medium-emphasis mb-4" style="font-size: 0.72rem !important;">
          <div><strong>Inspector:</strong> {{ selectedAnnotation.author || 'Unknown' }}</div>
          <div><strong>Recorded:</strong> {{ formatDate(selectedAnnotation.createdAt) }}</div>
          <div><strong>Last Update:</strong> {{ formatDate(selectedAnnotation.updatedAt) }}</div>
        </div>

        <!-- Action Buttons -->
        <div class="d-flex gap-2 mb-4">
          <v-btn
            color="primary"
            variant="flat"
            block
            prepend-icon="mdi-content-save-outline"
            :loading="isSaving"
            @click="saveChanges"
          >
            Save to Local IndexedDB
          </v-btn>
        </div>

        <div class="d-flex justify-center">
          <v-btn
            color="error"
            variant="text"
            size="small"
            prepend-icon="mdi-trash-can-outline"
            @click="confirmDelete"
          >
            Delete Annotation
          </v-btn>
        </div>
      </div>

      <!-- Empty State if no annotation is selected -->
      <div v-else class="flex-grow-1 d-flex flex-column align-center justify-center pa-6 text-center">
        <v-avatar color="surface-variant" size="64" class="mb-3">
          <v-icon icon="mdi-card-text-outline" size="32" color="medium-emphasis"></v-icon>
        </v-avatar>
        <div class="text-subtitle-2 font-weight-bold text-white mb-1">No Annotation Selected</div>
        <div class="text-caption text-medium-emphasis" style="max-width: 260px;">
          Select any annotation from the left panel or click a pin on the 3D Cesium model to load its inspection template.
        </div>
      </div>

      <!-- Panel Footer -->
      <div class="pa-2 border-t bg-surface-variant d-flex align-center justify-space-between text-caption text-medium-emphasis">
        <span style="font-size: 0.7rem;">RxDB Schema Replication Ready</span>
        <v-icon icon="mdi-shield-check" color="success" size="16"></v-icon>
      </div>
    </div>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import type { DefectAnnotation, AnnotationTemplate, Severity, DefectStatus } from '@/types'

const props = defineProps<{
  selectedAnnotation: DefectAnnotation | null
  templates: AnnotationTemplate[]
}>()

const emit = defineEmits<{
  (e: 'update-annotation', updated: DefectAnnotation): void
  (e: 'delete-annotation', id: string): void
  (e: 'fly-to-annotation', coords: [number, number, number]): void
}>()

const uiStore = useUiStore()
const isSaving = ref(false)

// Form fields
const formTitle = ref('')
const formDescription = ref('')
const formSeverity = ref<Severity>('medium')
const formStatus = ref<DefectStatus>('open')
const formTemplateValues = ref<Record<string, any>>({})

const severityOptions = [
  { title: 'Critical', value: 'critical' },
  { title: 'High', value: 'high' },
  { title: 'Medium', value: 'medium' },
  { title: 'Low', value: 'low' }
]

const statusOptions = [
  { title: 'Open', value: 'open' },
  { title: 'In Progress', value: 'in_progress' },
  { title: 'Resolved', value: 'resolved' }
]

// Current active template
const currentTemplate = computed(() => {
  if (!props.selectedAnnotation) return null
  return props.templates.find((t) => t.id === props.selectedAnnotation?.templateId) || props.templates[0]
})

// Sync form values when selected annotation changes
watch(
  () => props.selectedAnnotation,
  (newVal) => {
    if (newVal) {
      formTitle.value = newVal.title
      formDescription.value = newVal.description || ''
      formSeverity.value = newVal.severity
      formStatus.value = newVal.status
      formTemplateValues.value = JSON.parse(JSON.stringify(newVal.templateValues || {}))
    }
  },
  { immediate: true }
)

function getSeverityColor(sev: string): string {
  switch (sev) {
    case 'critical': return 'error'
    case 'high': return 'warning'
    case 'medium': return 'info'
    case 'low': return 'success'
    default: return 'primary'
  }
}

function formatDate(isoString?: string): string {
  if (!isoString) return 'N/A'
  try {
    return new Date(isoString).toLocaleString()
  } catch {
    return isoString
  }
}

function flyToCurrent() {
  if (props.selectedAnnotation) {
    emit('fly-to-annotation', props.selectedAnnotation.positionXyz)
  }
}

async function saveChanges() {
  if (!props.selectedAnnotation) return
  isSaving.value = true

  const updated: DefectAnnotation = {
    ...props.selectedAnnotation,
    title: formTitle.value,
    description: formDescription.value,
    severity: formSeverity.value,
    status: formStatus.value,
    templateValues: { ...formTemplateValues.value },
    updatedAt: new Date().toISOString()
  }

  emit('update-annotation', updated)
  setTimeout(() => {
    isSaving.value = false
  }, 300)
}

function confirmDelete() {
  if (!props.selectedAnnotation) return
  if (confirm(`Are you sure you want to delete defect "${props.selectedAnnotation.title}"?`)) {
    emit('delete-annotation', props.selectedAnnotation.id)
    uiStore.closeRightPanel()
  }
}
</script>

<style scoped>
.font-mono {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}

.flex-1 {
  flex: 1;
}

.gap-2 {
  gap: 8px;
}
</style>
