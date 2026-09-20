<template>
  <div class="cesium-wrapper">
    <!-- 3D WebGL Canvas Container -->
    <div ref="cesiumContainer" class="cesium-container"></div>

    <!-- Floating Top Viewport Tool Overlay -->
    <div class="viewport-overlay-top d-flex align-center gap-2">
      <v-chip
        size="small"
        :color="uiStore.activeTool === 'add_annotation' ? 'warning' : 'surface'"
        variant="elevated"
        class="font-weight-medium border px-3"
      >
        <v-icon
          :icon="uiStore.activeTool === 'add_annotation' ? 'mdi-map-marker-plus' : 'mdi-axis-arrow'"
          size="16"
          class="mr-1"
        ></v-icon>
        <span v-if="uiStore.activeTool === 'add_annotation'">
          Click anywhere on 3D Building surface to drop defect pin
        </span>
        <span v-else>
          {{ uiStore.currentAsset.name }} • Left-Click to Orbit, Right-Click to Zoom
        </span>
      </v-chip>

      <v-btn
        v-if="uiStore.activeTool === 'add_annotation'"
        size="x-small"
        color="error"
        variant="tonal"
        prepend-icon="mdi-close"
        @click="uiStore.setActiveTool('select')"
      >
        Cancel
      </v-btn>
    </div>

    <!-- Floating Bottom Controls Overlay -->
    <div class="viewport-overlay-bottom d-flex align-center gap-2">
      <v-btn
        size="small"
        color="surface"
        variant="elevated"
        class="border"
        prepend-icon="mdi-home"
        @click="resetCameraHome"
      >
        Reset View
      </v-btn>

      <v-btn
        size="small"
        color="surface"
        variant="elevated"
        class="border"
        prepend-icon="mdi-camera-retake-outline"
        @click="focusCurrentAsset"
      >
        Focus Model
      </v-btn>

      <v-btn
        size="small"
        :color="wireframeEnabled ? 'primary' : 'surface'"
        variant="elevated"
        class="border"
        icon="mdi-grid"
        title="Toggle Wireframe Rendering"
        @click="toggleWireframe"
      ></v-btn>
    </div>

    <!-- Tooltip on Marker Click -->
    <div
      v-if="hoveredAnnotation"
      class="marker-tooltip elevation-6 rounded-lg pa-2 text-caption"
      :style="{ left: tooltipPos.x + 'px', top: tooltipPos.y + 'px' }"
    >
      <div class="d-flex align-center mb-1">
        <v-chip size="x-small" :color="getSeverityColor(hoveredAnnotation.severity)" variant="flat" class="mr-1 font-weight-bold">
          {{ hoveredAnnotation.severity }}
        </v-chip>
        <span class="font-weight-bold text-white">{{ hoveredAnnotation.title }}</span>
      </div>
      <div class="text-disabled" style="font-size: 0.7rem;">Click to view inspection template</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import * as Cesium from 'cesium'
import { useUiStore } from '@/stores/ui.store'
import type { DefectAnnotation, Severity } from '@/types'

const props = defineProps<{
  annotations: DefectAnnotation[]
}>()

const emit = defineEmits<{
  (e: 'add-annotation-at', coords: [number, number, number]): void
}>()

const uiStore = useUiStore()
const cesiumContainer = ref<HTMLDivElement | null>(null)

// Non-reactive Cesium viewer and primitives to maintain 60 FPS (per architecture specs)
let viewer: Cesium.Viewer | null = null
let handler: Cesium.ScreenSpaceEventHandler | null = null
let markerEntities: Map<string, Cesium.Entity> = new Map()

// Scene elements
let realBuildingEntity: Cesium.Entity | null = null
const proceduralEntities: Cesium.Entity[] = []
let activeTileset: Cesium.Cesium3DTileset | null = null

// UI Overlays
const wireframeEnabled = ref(false)
const tooltipPos = ref({ x: -9999, y: -9999 })
const hoveredAnnotation = computed(() => {
  if (!uiStore.hoveredAnnotationId) return null
  return props.annotations.find((a) => a.id === uiStore.hoveredAnnotationId) || null
})

// Update tooltip position when hovered annotation changes (from left panel or 3D viewer click)
function updateTooltipPosition() {
  if (!viewer || !uiStore.hoveredAnnotationId) {
    tooltipPos.value = { x: -9999, y: -9999 }
    return
  }

  const annot = props.annotations.find((a) => a.id === uiStore.hoveredAnnotationId)
  if (!annot) {
    tooltipPos.value = { x: -9999, y: -9999 }
    return
  }

  // Convert annotation world position to canvas coordinates using Cesium's documented method
  const position = new Cesium.Cartesian3(
    annot.positionXyz[0],
    annot.positionXyz[1],
    annot.positionXyz[2]
  )

  const canvasPosition = new Cesium.Cartesian2()
  const success = viewer.scene.cartesianToCanvasCoordinates(position, canvasPosition)
  if (success) {
    // Position tooltip slightly above and to the right of the marker
    tooltipPos.value = {
      x: canvasPosition.x + 15,
      y: canvasPosition.y - 10
    }
  } else {
    // If conversion fails (e.g., annotation behind camera), hide tooltip
    tooltipPos.value = { x: -9999, y: -9999 }
  }
}

watch(() => uiStore.hoveredAnnotationId, (annotationId) => {
  if (annotationId) {
    startTooltipTracking()
  } else {
    stopTooltipTracking()
    tooltipPos.value = { x: -9999, y: -9999 }
  }
})

// Update tooltip position on every frame to keep it clamped to the pin during zoom/pan
let preRenderHandler: (() => void) | null = null
function startTooltipTracking() {
  if (preRenderHandler) return
  preRenderHandler = updateTooltipPosition
  viewer.scene.preRender.addEventListener(preRenderHandler)
}

function stopTooltipTracking() {
  if (preRenderHandler && viewer) {
    viewer.scene.preRender.removeEventListener(preRenderHandler)
    preRenderHandler = null
  }
}

// Pin SVG generators for high contrast pins in dark mode
function getPinSvgUrl(severity: Severity): string {
  let color = '#3B82F6'
  if (severity === 'critical') color = '#EF4444'
  else if (severity === 'high') color = '#F97316'
  else if (severity === 'medium') color = '#F59E0B'

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 48" width="36" height="48">
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.8"/>
    </filter>
    <path d="M18 2 C9.16 2 2 9.16 2 18 C2 28 18 46 18 46 C18 46 34 28.5 34 18 C34 9.16 26.84 2 18 2 Z"
          fill="${color}" stroke="#FFFFFF" stroke-width="2" filter="url(#glow)"/>
    <circle cx="18" cy="18" r="8" fill="#0B111E"/>
    <circle cx="18" cy="18" r="5" fill="${color}"/>
  </svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function getSeverityColor(sev: string): string {
  switch (sev) {
    case 'critical': return 'error'
    case 'high': return 'warning'
    case 'medium': return 'info'
    case 'low': return 'success'
    default: return 'primary'
  }
}

onMounted(async () => {
  if (!cesiumContainer.value) return

  // 1. Initialize un-proxied Cesium Viewer with clean CAD/Twin viewport defaults
  viewer = new Cesium.Viewer(cesiumContainer.value, {
    animation: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    sceneModePicker: false,
    selectionIndicator: false,
    timeline: false,
    navigationHelpButton: false,
    scene3DOnly: true,
    requestRenderMode: false,
    maximumRenderTimeChange: Infinity,
    terrainProvider: undefined
  })

  // Configure Scene lighting & atmosphere for modern digital twin look
  viewer.scene.globe.enableLighting = true
  viewer.scene.globe.depthTestAgainstTerrain = true
  viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0B111E')

  // Remove default credit container styling clutter for clean UI
  const creditContainer = viewer.bottomContainer as HTMLElement
  if (creditContainer) {
    creditContainer.style.display = 'none'
  }

  // 2. Initialize the Real Textured Architectural Building Model
  createRealBuildingModel(viewer)

  // 3. Initialize the Procedural High-Rise Tower
  createProceduralTowerModel(viewer)

  // 4. Load initial active asset (defaults to real architectural building)
  await loadAssetModel(uiStore.currentAssetId)

  // 5. Sync initial annotations from RxDB onto the 3D scene
  syncAnnotationsToScene(props.annotations)

  // 6. Setup Screen Space Event Handler for interaction & depth picking
  setupEventHandlers(viewer)
})

onBeforeUnmount(() => {
  if (handler) {
    handler.destroy()
    handler = null
  }
  if (viewer) {
    viewer.destroy()
    viewer = null
  }
})

/**
 * Loads the Real-World Architectural Building Model (building_real.glb)
 */
function createRealBuildingModel(v: Cesium.Viewer) {
  const origin = uiStore.availableAssets[0].coordinates
  const position = Cesium.Cartesian3.fromDegrees(origin.lon, origin.lat, 24.0)
  const hpr = new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(15.0), 0, 0)
  const orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr)

  realBuildingEntity = v.entities.add({
    name: 'Real Architectural Building Facility',
    position: position,
    orientation: orientation,
    model: {
      uri: '/models/building_real.glb',
      scale: 0.12,
      minimumPixelSize: 128,
      maximumScale: 20000,
      shadows: Cesium.ShadowMode.ENABLED
    }
  })
}

/**
 * Creates the alternative procedural architectural commercial tower
 */
function createProceduralTowerModel(v: Cesium.Viewer) {
  const origin = uiStore.availableAssets[1].coordinates
  const originCartesian = Cesium.Cartesian3.fromDegrees(origin.lon, origin.lat, origin.height)

  // Plinth / Plaza Base
  const base = v.entities.add({
    name: 'Inspection Asset Base Plinth',
    position: originCartesian,
    show: false,
    box: {
      dimensions: new Cesium.Cartesian3(90.0, 70.0, 4.0),
      material: Cesium.Color.fromCssColorString('#1E293B')
    }
  })
  proceduralEntities.push(base)

  // Podium Structure (Levels 1 - 3)
  const podiumPos = Cesium.Cartesian3.fromDegrees(origin.lon, origin.lat, 12.0)
  const podium = v.entities.add({
    name: 'Building Podium (L1-L3)',
    position: podiumPos,
    show: false,
    box: {
      dimensions: new Cesium.Cartesian3(70.0, 50.0, 20.0),
      material: Cesium.Color.fromCssColorString('#24324E')
    }
  })
  proceduralEntities.push(podium)

  // Main High-Rise Commercial Tower (Levels 4 - 24)
  const towerHeight = 90.0
  const towerPos = Cesium.Cartesian3.fromDegrees(origin.lon, origin.lat, 22.0 + towerHeight / 2)
  const tower = v.entities.add({
    name: 'Tower Primary Structure (L4-L24)',
    position: towerPos,
    show: false,
    box: {
      dimensions: new Cesium.Cartesian3(46.0, 36.0, towerHeight),
      material: Cesium.Color.fromCssColorString('#1B273E')
    }
  })
  proceduralEntities.push(tower)

  // Glass Curtain Wall Facade Ribs
  const numFloors = 18
  for (let i = 0; i < numFloors; i++) {
    const floorZ = 24.0 + i * 5.0
    const slabPos = Cesium.Cartesian3.fromDegrees(origin.lon, origin.lat, floorZ)

    const slab = v.entities.add({
      name: `Floor Slab L${i + 4}`,
      position: slabPos,
      show: false,
      box: {
        dimensions: new Cesium.Cartesian3(47.2, 37.2, 0.6),
        material: Cesium.Color.fromCssColorString('#38BDF8').withAlpha(0.7)
      }
    })
    proceduralEntities.push(slab)
  }

  // Rooftop Plant Room & Parapet
  const roofPos = Cesium.Cartesian3.fromDegrees(origin.lon, origin.lat, 22.0 + towerHeight + 6.0)
  const roof = v.entities.add({
    name: 'Rooftop Mechanical Plant & Parapet',
    position: roofPos,
    show: false,
    box: {
      dimensions: new Cesium.Cartesian3(28.0, 22.0, 12.0),
      material: Cesium.Color.fromCssColorString('#0F172A')
    }
  })
  proceduralEntities.push(roof)
}

/**
 * Loads or toggles between real architectural building model, procedural tower, or 3D Tileset
 */
async function loadAssetModel(assetId: string) {
  if (!viewer) return

  // 1. Real Architectural Building Model (Primary)
  const isRealBuilding = assetId === 'asset-real-building-01'
  if (realBuildingEntity) {
    realBuildingEntity.show = isRealBuilding
  }

  // 2. Procedural Tower Entities
  const isProcedural = assetId === 'asset-tower-02'
  for (const ent of proceduralEntities) {
    ent.show = isProcedural
  }

  // 3. Batched 3D Tileset Building
  if (assetId === 'asset-tileset-03') {
    if (!activeTileset) {
      try {
        activeTileset = await Cesium.Cesium3DTileset.fromUrl('/sample-tileset/tileset.json')
        viewer.scene.primitives.add(activeTileset)
      } catch (err) {
        console.error('Failed to load sample 3D tileset:', err)
      }
    }
    if (activeTileset) {
      activeTileset.show = true
    }
  } else if (activeTileset) {
    activeTileset.show = false
  }

  // 4. Focus camera on active building model
  focusCurrentAsset()

  // 5. Re-sync annotation pins for this asset
  syncAnnotationsToScene(props.annotations)
}

  /**
   * Setup mouse events: Picking annotation markers and dropping new defect pins
   */
  function setupEventHandlers(v: Cesium.Viewer) {
    handler = new Cesium.ScreenSpaceEventHandler(v.scene.canvas)

    // 1. Mouse Move: cursor update only (no hover tooltip)
    handler.setInputAction((movement: any) => {
      if (!v) return

      const picked = v.scene.pick(movement.endPosition)
      if (Cesium.defined(picked) && picked.id && picked.id.properties?.annotationId) {
        v.scene.canvas.style.cursor = 'pointer'
      } else {
        v.scene.canvas.style.cursor = uiStore.activeTool === 'add_annotation' ? 'crosshair' : 'default'
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

    // 2. Left Click: Either select marker OR drop defect pin on building surface
    handler.setInputAction((movement: any) => {
      if (!v) return

      // If in "Add Defect Pin" tool mode:
      if (uiStore.activeTool === 'add_annotation') {
        // Pick 3D position directly from depth buffer (GPU picking on 3D building surface)
        const pickedPosition = v.scene.pickPosition(movement.position)
        if (Cesium.defined(pickedPosition)) {
          const coords: [number, number, number] = [
            pickedPosition.x,
            pickedPosition.y,
            pickedPosition.z
          ]
          emit('add-annotation-at', coords)
          uiStore.setActiveTool('select')
          // Clear tooltip when switching tools
          uiStore.setHoveredAnnotation(null)
        }
        return
      }

      // Default select mode: Check if an annotation marker was clicked
      const picked = v.scene.pick(movement.position)
      if (Cesium.defined(picked) && picked.id && picked.id.properties?.annotationId) {
        const annotId = picked.id.properties.annotationId.getValue()
        const annot = props.annotations.find((a) => a.id === annotId)
        if (annot) {
          // Show tooltip on click (instead of mouseover)
          uiStore.setHoveredAnnotation(annotId)
          // Select annotation & show inspection template
          uiStore.selectAnnotation(annotId)
        } else {
          // Clicked elsewhere on the model: hide the tooltip
          uiStore.setHoveredAnnotation(null)
        }
      } else {
        // Clicked on empty space: hide the tooltip
        uiStore.setHoveredAnnotation(null)
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
  }

/**
 * Synchronizes RxDB annotations into Cesium Billboard Entities
 * filtered by the active digital twin asset!
 */
function syncAnnotationsToScene(annotations: DefectAnnotation[]) {
  if (!viewer) return

  // Filter to annotations for current asset
  const assetAnnotations = annotations.filter((a) => a.assetId === uiStore.currentAssetId)
  const currentIds = new Set(assetAnnotations.map((a) => a.id))

  // Remove stale markers
  for (const [id, entity] of markerEntities.entries()) {
    if (!currentIds.has(id)) {
      viewer.entities.remove(entity)
      markerEntities.delete(id)
    }
  }

  // Add or update markers
  for (const annot of assetAnnotations) {
    const position = new Cesium.Cartesian3(
      annot.positionXyz[0],
      annot.positionXyz[1],
      annot.positionXyz[2]
    )

    if (markerEntities.has(annot.id)) {
      // Update existing entity position & billboard icon
      const entity = markerEntities.get(annot.id)!
      entity.position = new Cesium.ConstantPositionProperty(position)
      if (entity.billboard) {
        entity.billboard.image = new Cesium.ConstantProperty(getPinSvgUrl(annot.severity))
      }
    } else {
      // Create new billboard marker entity
      const entity = viewer.entities.add({
        name: `Annotation: ${annot.title}`,
        position: position,
        billboard: {
          image: getPinSvgUrl(annot.severity),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          width: 32,
          height: 42,
          scaleByDistance: new Cesium.NearFarScalar(30.0, 1.2, 500.0, 0.7),
          disableDepthTestDistance: 50
        },
        properties: {
          annotationId: annot.id
        }
      })
      markerEntities.set(annot.id, entity)
    }
  }
}

// Watch for RxDB stream updates
watch(
  () => props.annotations,
  (newAnnotations) => {
    syncAnnotationsToScene(newAnnotations)
  },
  { deep: true }
)

// Watch for active asset change
watch(
  () => uiStore.currentAssetId,
  async (newAssetId) => {
    await loadAssetModel(newAssetId)
  }
)

// Watch for camera fly requests from store
watch(
  () => uiStore.flyToTarget,
  (target) => {
    if (target && viewer) {
      flyToCoordinates(target)
      uiStore.clearFlyToTarget()
    }
  }
)

function flyToCoordinates(coords: [number, number, number]) {
  if (!viewer) return
  const target = new Cesium.Cartesian3(coords[0], coords[1], coords[2])
  const cartographic = Cesium.Cartographic.fromCartesian(target)
  
  // Fly directly to viewing position using HeadingPitchRange (avoids space flyout)
  viewer.camera.flyTo({
    destination: target,
    orientation: new Cesium.HeadingPitchRange(
      viewer.camera.heading,
      Cesium.Math.toRadians(-45),
      80 // range in meters from target
    ),
    duration: 1.5,
    maximumHeight: cartographic.height + 200, // Limit max height to prevent space flyout
  })
}
  })
}

function focusCurrentAsset() {
  if (!viewer) return
  const asset = uiStore.currentAsset
  const lon = asset.coordinates.lon
  const lat = asset.coordinates.lat

  if (asset.id === 'asset-real-building-01') {
    // Position camera to look at the building from a 3/4 view: 80m west,
    // 80m north, 120m above the building base (24m altitude).
    const target = Cesium.Cartesian3.fromDegrees(lon, lat, 24.0)
    const offset = new Cesium.Cartesian3(-80, 80, 120)
    viewer.camera.lookAt(target, offset)
  } else if (asset.id === 'asset-tower-02') {
    // For the procedural tower: center on the tower top (67m), camera at
    // 40m west, 40m north, 80m above the tower center.
    const target = Cesium.Cartesian3.fromDegrees(lon, lat, 67.0)
    const offset = new Cesium.Cartesian3(-40, 40, 80)
    viewer.camera.lookAt(target, offset)
  } else if (asset.id === 'asset-tileset-03') {
    if (activeTileset) {
      viewer.zoomTo(activeTileset, new Cesium.HeadingPitchRange(
        Cesium.Math.toRadians(45.0),
        Cesium.Math.toRadians(-25.0),
        200.0
      ))
    }
  }
}

function resetCameraHome() {
  focusCurrentAsset()
}

function toggleWireframe() {
  if (!viewer) return
  wireframeEnabled.value = !wireframeEnabled.value
  const globeAny = viewer.scene.globe as any
  if (globeAny._surface?.tileProvider?._debug) {
    globeAny._surface.tileProvider._debug.wireframe = wireframeEnabled.value
  }
}

defineExpose({
  flyToCoordinates,
  focusCurrentAsset,
  loadAssetModel
})
</script>

<style scoped>
.cesium-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #0B111E;
}

.cesium-container {
  width: 100%;
  height: 100%;
}

.viewport-overlay-top {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  pointer-events: auto;
}

.viewport-overlay-bottom {
  position: absolute;
  bottom: 20px;
  left: 20px;
  z-index: 10;
  pointer-events: auto;
}

.marker-tooltip {
  position: absolute;
  z-index: 20;
  background-color: rgba(19, 29, 49, 0.95);
  border: 1px solid #00D2B5;
  pointer-events: none;
  backdrop-filter: blur(8px);
}

.gap-2 {
  gap: 8px;
}
</style>
