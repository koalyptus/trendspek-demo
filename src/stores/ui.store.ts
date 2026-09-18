import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ActiveTool, Severity } from '@/types'
import { availableAssets } from '@/database/defaultData'

/**
 * Pinia Store: Strictly for transient UI view-state.
 * Per the architecture guidelines, spatial entity collections and persistence
 * are handled exclusively by RxDB and CesiumJS, NOT Pinia.
 */
export const useUiStore = defineStore('ui', () => {
  // Navigation & Drawer states
  const isLeftPanelOpen = ref(true)
  const isRightPanelOpen = ref(false)

  // Selection & Hover states
  const selectedAnnotationId = ref<string | null>(null)
  const hoveredAnnotationId = ref<string | null>(null)

  // Current active viewport tool
  const activeTool = ref<ActiveTool>('select')

  // Active digital twin asset context (defaults to real architectural building model)
  const currentAssetId = ref('asset-real-building-01')

  const currentAsset = computed(() => {
    return availableAssets.find((a) => a.id === currentAssetId.value) || availableAssets[0]
  })

  // Left panel filters
  const filterSeverity = ref<Severity | null>(null)
  const searchQuery = ref('')

  // Trigger for Cesium camera fly-to animation
  const flyToTarget = ref<[number, number, number] | null>(null)

  // Actions
  function setAsset(assetId: string) {
    currentAssetId.value = assetId
    selectedAnnotationId.value = null
    isRightPanelOpen.value = false
  }

  function selectAnnotation(id: string | null, targetCoords?: [number, number, number]) {
    selectedAnnotationId.value = id
    if (id) {
      // Automatically expand the right panel to show the inspection template!
      isRightPanelOpen.value = true
      if (targetCoords) {
        flyToTarget.value = targetCoords
      }
    } else {
      isRightPanelOpen.value = false
    }
  }

  function setHoveredAnnotation(id: string | null) {
    hoveredAnnotationId.value = id
  }

  function toggleLeftPanel() {
    isLeftPanelOpen.value = !isLeftPanelOpen.value
  }

  function toggleRightPanel() {
    isRightPanelOpen.value = !isRightPanelOpen.value
  }

  function openRightPanel() {
    isRightPanelOpen.value = true
  }

  function closeRightPanel() {
    isRightPanelOpen.value = false
    selectedAnnotationId.value = null
  }

  function setActiveTool(tool: ActiveTool) {
    activeTool.value = tool
  }

  function requestFlyTo(coords: [number, number, number]) {
    flyToTarget.value = coords
  }

  function clearFlyToTarget() {
    flyToTarget.value = null
  }

  return {
    isLeftPanelOpen,
    isRightPanelOpen,
    selectedAnnotationId,
    hoveredAnnotationId,
    activeTool,
    currentAssetId,
    currentAsset,
    availableAssets,
    filterSeverity,
    searchQuery,
    flyToTarget,
    setAsset,
    selectAnnotation,
    setHoveredAnnotation,
    toggleLeftPanel,
    toggleRightPanel,
    openRightPanel,
    closeRightPanel,
    setActiveTool,
    requestFlyTo,
    clearFlyToTarget
  }
})
