<template>
  <v-app-bar density="compact" color="surface" elevation="2" border="b" class="px-2">
    <!-- Brand / Title -->
    <div class="d-flex align-center mr-3">
      <v-avatar color="primary" size="32" class="mr-2 elevation-2">
        <v-icon icon="mdi-cube-scan" color="#0B111E" size="20"></v-icon>
      </v-avatar>
      <div>
        <div class="text-subtitle-1 font-weight-bold text-white d-flex align-center" style="letter-spacing: 0.5px; line-height: 1.2;">
          TRENDSPEK
          <v-chip size="x-small" color="primary" variant="flat" class="ml-2 font-weight-bold" style="color: #0B111E;">
            DIGITAL TWIN
          </v-chip>
        </div>
        <div class="text-caption text-medium-emphasis" style="font-size: 0.7rem !important; line-height: 1;">
          Asset Inspection
        </div>
      </div>
    </div>

    <v-divider vertical inset class="mx-2"></v-divider>

    <!-- Asset Selector Menu -->
    <div class="d-flex align-center ml-1">
      <v-menu location="bottom start" transition="slide-y-transition">
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            variant="tonal"
            color="secondary"
            size="small"
            class="text-body-2 font-weight-medium text-capitalize px-3"
            append-icon="mdi-chevron-down"
          >
            <v-icon
              :icon="uiStore.currentAsset.type === 'procedural_tower' ? 'mdi-office-building-cog' : (uiStore.currentAsset.type === 'tileset_building' ? 'mdi-home-city' : 'mdi-city-variant')"
              size="18"
              class="mr-2"
            ></v-icon>
            <span class="text-truncate" style="max-width: 250px;">
              {{ uiStore.currentAsset.name }}
            </span>
          </v-btn>
        </template>

        <v-list density="compact" color="surface" class="border elevation-8" rounded="lg" width="340">
          <v-list-subheader class="font-weight-bold text-uppercase text-caption text-primary">
            Select Inspection Asset Model
          </v-list-subheader>
          <v-list-item
            v-for="asset in uiStore.availableAssets"
            :key="asset.id"
            :active="uiStore.currentAssetId === asset.id"
            color="primary"
            class="mb-1"
            @click="handleAssetSelect(asset.id)"
          >
            <template #prepend>
              <v-icon
                :icon="asset.type === 'procedural_tower' ? 'mdi-office-building-cog' : (asset.type === 'tileset_building' ? 'mdi-home-city' : 'mdi-city-variant')"
                :color="uiStore.currentAssetId === asset.id ? 'primary' : 'secondary'"
              ></v-icon>
            </template>
            <v-list-item-title class="font-weight-bold text-body-2">
              {{ asset.name }}
            </v-list-item-title>
            <v-list-item-subtitle class="text-caption text-medium-emphasis">
              {{ asset.locationName }} • {{ asset.type === 'tileset_building' ? 'Real 3D Tiles' : (asset.type === 'procedural_tower' ? 'Procedural Tower' : 'OSM Buildings') }}
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-menu>
    </div>

    <!-- Active Tool Buttons -->
    <div class="d-flex align-center ml-3">
      <v-btn-toggle
        :model-value="uiStore.activeTool"
        mandatory
        density="compact"
        color="primary"
        variant="outlined"
        rounded="lg"
        @update:model-value="(val) => uiStore.setActiveTool(val)"
      >
        <v-btn value="select" size="small" prepend-icon="mdi-cursor-default-outline">
          Navigate
        </v-btn>
        <v-btn value="add_annotation" size="small" prepend-icon="mdi-map-marker-plus" color="warning">
          Drop Defect Pin
        </v-btn>
      </v-btn-toggle>
    </div>

    <v-spacer></v-spacer>
    <v-tooltip :text="props.replicationStatus === 'synced' ? 'Replication active — changes synced with server' : 'Replication offline — running locally only'" location="bottom">
      <template #activator="{ props: tooltipProps }">
        <div v-bind="tooltipProps" class="d-flex align-center px-2 py-1 rounded-pill cursor-pointer" :style="props.replicationStatus === 'synced' ? 'background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3);' : 'background: rgba(100, 100, 100, 0.12); border: 1px solid rgba(100, 100, 100, 0.3);'">
          <v-icon :icon="props.replicationStatus === 'synced' ? 'mdi-cloud-check' : 'mdi-cloud-off-outline'" :color="props.replicationStatus === 'synced' ? 'success' : 'disabled'" size="16" class="mr-1"></v-icon>
          <span class="text-caption font-weight-medium" :style="props.replicationStatus === 'synced' ? 'color: #10B981;' : 'color: #888888;'" style="font-size: 0.72rem !important;">
            {{ props.replicationStatus === 'synced' ? 'Synced' : 'Offline' }}
          </span>
        </div>
      </template>
    </v-tooltip>

    <!-- Architecture Info Dialog Button -->
    <v-btn
      icon="mdi-information-outline"
      size="small"
      variant="text"
      color="secondary"
      class="mr-1"
      @click="showInfoDialog = true"
    ></v-btn>

    <v-divider vertical inset class="mx-2"></v-divider>

    <!-- Left Panel Toggle (Annotations) -->
    <v-tooltip :text="uiStore.isLeftPanelOpen ? 'Collapse Left Annotations Panel' : 'Expand Left Annotations Panel'" location="bottom">
      <template #activator="{ props }">
        <v-btn
          v-bind="props"
          :color="uiStore.isLeftPanelOpen ? 'primary' : 'medium-emphasis'"
          :variant="uiStore.isLeftPanelOpen ? 'tonal' : 'text'"
          size="small"
          icon="mdi-dock-left"
          class="mr-1"
          @click="uiStore.toggleLeftPanel"
        ></v-btn>
      </template>
    </v-tooltip>

    <!-- Right Panel Toggle (Template / Details) -->
    <v-tooltip :text="uiStore.isRightPanelOpen ? 'Collapse Right Inspection Template Panel' : 'Expand Right Inspection Template Panel'" location="bottom">
      <template #activator="{ props }">
        <v-btn
          v-bind="props"
          :color="uiStore.isRightPanelOpen ? 'secondary' : 'medium-emphasis'"
          :variant="uiStore.isRightPanelOpen ? 'tonal' : 'text'"
          size="small"
          icon="mdi-dock-right"
          @click="uiStore.toggleRightPanel"
        ></v-btn>
      </template>
    </v-tooltip>
  </v-app-bar>

  <!-- Architecture Dialog -->
  <v-dialog v-model="showInfoDialog" max-width="680">
    <v-card color="surface" class="border">
      <v-card-title class="d-flex align-center pt-4 px-5">
        <v-icon icon="mdi-layers-triple-outline" color="primary" class="mr-2"></v-icon>
        <span class="font-weight-bold text-h6">Trendspek Local-First Architecture</span>
        <v-spacer></v-spacer>
        <v-btn icon="mdi-close" variant="text" size="small" @click="showInfoDialog = false"></v-btn>
      </v-card-title>
      <v-card-text class="px-5 pt-2 pb-4">
        <v-alert density="compact" color="primary" variant="tonal" class="mb-4">
          <div class="text-subtitle-2 font-weight-bold">Three-Tier State Separation</div>
          <div class="text-caption">Engineered according to senior frontend 60 FPS Digital Twin guidelines:</div>
        </v-alert>

        <v-timeline density="compact" side="end">
          <v-timeline-item dot-color="success" size="small">
            <div class="font-weight-bold text-body-2 text-white">1. RxDB & IndexedDB (Dexie) — Single Source of Truth</div>
            <div class="text-caption text-medium-emphasis">
              Owns offline domain data and persistence (position_xyz, status, template values). Provides reactive RxJS streams (<code class="text-primary">db.annotations.find().$</code>).
            </div>
          </v-timeline-item>
          <v-timeline-item dot-color="primary" size="small">
            <div class="font-weight-bold text-body-2 text-white">2. CesiumJS Engine — 3D Spatial Math & WebGL</div>
            <div class="text-caption text-medium-emphasis">
              Kept un-proxied outside Vue reactivity. Handles 60 FPS WebGL rendering, GPU depth picking (<code class="text-secondary">scene.pickPosition</code>), and billboard markers across both procedural and real 3D Tilesets.
            </div>
          </v-timeline-item>
          <v-timeline-item dot-color="secondary" size="small">
            <div class="font-weight-bold text-body-2 text-white">3. Pinia Store — Transient UI View-State Only</div>
            <div class="text-caption text-medium-emphasis">
              Tracks active selection, hover state, tool modes, active asset model, and drawer visibility without polluting reactivity with heavy 3D collections.
            </div>
          </v-timeline-item>
        </v-timeline>
      </v-card-text>
      <v-card-actions class="px-5 pb-4">
        <v-spacer></v-spacer>
        <v-btn color="primary" variant="tonal" @click="showInfoDialog = false">Got it</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useUiStore } from '@/stores/ui.store'

const uiStore = useUiStore()
const showInfoDialog = ref(false)

const props = defineProps<{
  replicationStatus?: 'synced' | 'offline'
}>()

const emit = defineEmits<{
  (e: 'reset-demo'): void
  (e: 'change-asset', assetId: string): void
}>()

function handleAssetSelect(assetId: string) {
  uiStore.setAsset(assetId)
  emit('change-asset', assetId)
}
</script>

<style scoped>
.status-pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #10B981;
  box-shadow: 0 0 0 rgba(16, 185, 129, 0.4);
  animation: pulse-ring 2s infinite cubic-bezier(0.455, 0.03, 0.515, 0.955);
}

@keyframes pulse-ring {
  0% {
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  }
  70% {
    box-shadow: 0 0 0 8px rgba(16, 185, 129, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
  }
}
</style>
