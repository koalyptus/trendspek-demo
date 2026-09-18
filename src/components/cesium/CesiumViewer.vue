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

    <!-- Tooltip on Marker Hover -->
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
  (e: 'select-annotation', annotation: DefectAnnotation): void
  (e: 'add-annotation-at', coords: [number, number, number]): void
}>()

const uiStore = useUiStore()
const cesiumContainer = ref<HTMLDivElement | null>(null)

// Non-reactive Cesium viewer and primitives to maintain 60 FPS (per architecture specs)
let viewer: Cesium.Viewer | null = null
let handler: Cesium.ScreenSpaceEventHandler | null = null
let markerEntities: Map<string, Cesium.Entity> = new Map()

// Scene elements
const proceduralEntities: Cesium.Entity[] = []
let activeTileset: Cesium.Cesium3DTileset | null = null
let osmBuildingsTileset: Cesium.Cesium3DTileset | null = null

// UI Overlays
const wireframeEnabled = ref(false)
const tooltipPos = ref({ x: 0, y: 0 })

const hoveredAnnotation = computed(() => {
  if (!uiStore.hoveredAnnotationId) return null
  return props.annotations.find((a) => a.id === uiStore.hoveredAnnotationId) || null
})

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

  // 2. Build our procedural 3D High-Rise Tower (Asset 1)
  createBuildingDemoModel(viewer)

  // 3. Load initial asset model (based on currentAssetId)
  await loadAssetModel(uiStore.currentAssetId)

  // 4. Sync initial annotations from RxDB onto the 3D scene
  syncAnnotationsToScene(props.annotations)

  // 5. Setup Screen Space Event Handler for interaction & depth picking
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
 * Creates the procedural architectural demo building structure directly in Cesium
 * (commercial high-rise tower with podium, facade panels, floor slabs, and rooftop plant equipment).
 */
function createBuildingDemoModel(v: Cesium.Viewer) {
  const origin = uiStore.availableAssets[0].coordinates
  const originCartesian = Cesium.Cartesian3.fromDegrees(origin.lon, origin.lat, origin.height)

  // Plinth / Plaza Base
  const base = v.entities.add({
    name: 'Inspection Asset Base Plinth',
    position: originCartesian,
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
    box: {
      dimensions: new Cesium.Cartesian3(46.0, 36.0, towerHeight),
      material: Cesium.Color.fromCssColorString('#1B273E')
    }
  })
  proceduralEntities.push(tower)

  // Glass Curtain Wall Facade Ribs (Trendspek-style CAD inspection view)
  const numFloors = 18
  for (let i = 0; i < numFloors; i++) {
    const floorZ = 24.0 + i * 5.0
    const slabPos = Cesium.Cartesian3.fromDegrees(origin.lon, origin.lat, floorZ)

    const slab = v.entities.add({
      name: `Floor Slab L${i + 4}`,
      position: slabPos,
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
    box: {
      dimensions: new Cesium.Cartesian3(28.0, 22.0, 12.0),
      material: Cesium.Color.fromCssColorString('#0F172A')
    }
  })
  proceduralEntities.push(roof)

  // Exterior Elevator / Core Column Accent
  const corePos = Cesium.Cartesian3.fromDegrees(origin.lon + 0.00015, origin.lat, 22.0 + towerHeight / 2)
  const core = v.entities.add({
    name: 'Service Core Spine',
    position: corePos,
    box: {
      dimensions: new Cesium.Cartesian3(8.0, 14.0, towerHeight + 16.0),
      material: Cesium.Color.fromCssColorString('#00D2B5').withAlpha(0.5)
    }
  })
  proceduralEntities.push(core)
}

/**
 * Loads or toggles between procedural tower, real-world 3D Tileset building, or OSM City buildings
 */
async function loadAssetModel(assetId: string) {
  if (!viewer) return

  // 1. Procedural Tower Entities
  const isProcedural = assetId === 'asset-tower-01'
  for (const ent of proceduralEntities) {
    ent.show = isProcedural
  }

  // 2. Real-World 3D Tileset Facility
  if (assetId === 'asset-real-building-02') {
    if (!activeTileset) {
      try {
        activeTileset = await Cesium.Cesium3DTileset.fromUrl('/sample-tileset/tileset.json')
        viewer.scene.primitives.add(activeTileset)
      } catch (err) {
        console.error('Failed to load local sample 3D tileset:', err)
      }
    }
    if (activeTileset) {
      activeTileset.show = true
    }
  } else if (activeTileset) {
    activeTileset.show = false
  }

  // 3. OSM City Buildings (Sydney CBD)
  if (assetId === 'asset-city-osm-03') {
    if (!osmBuildingsTileset) {
      try {
        osmBuildingsTileset = await Cesium.createOsmBuildingsAsync()
        viewer.scene.primitives.add(osmBuildingsTileset)
      } catch (err) {
        console.warn('OSM Buildings requires Cesium Ion token or online access:', err)
      }
    }
    if (osmBuildingsTileset) {
      osmBuildingsTileset.show = true
    }
  } else if (osmBuildingsTileset) {
    osmBuildingsTileset.show = false
  }

  // 4. Focus camera on the chosen building
  focusCurrentAsset()

  // 5. Re-sync annotation pins for this asset
  syncAnnotationsToScene(props.annotations)
}

/**
 * Setup mouse events: Picking annotation markers and dropping new defect pins
 */
function setupEventHandlers(v: Cesium.Viewer) {
  handler = new Cesium.ScreenSpaceEventHandler(v.scene.canvas)

  // 1. Mouse Move: Hover detection & cursor update
  handler.setInputAction((movement: any) => {
    if (!v) return

    const picked = v.scene.pick(movement.endPosition)
    if (Cesium.defined(picked) && picked.id && picked.id.properties?.annotationId) {
      const annotId = picked.id.properties.annotationId.getValue()
      uiStore.setHoveredAnnotation(annotId)
      tooltipPos.value = { x: movement.endPosition.x + 15, y: movement.endPosition.y + 10 }
      v.scene.canvas.style.cursor = 'pointer'
    } else {
      if (uiStore.hoveredAnnotationId) {
        uiStore.setHoveredAnnotation(null)
      }
      v.scene.canvas.style.cursor = uiStore.activeTool === 'add_annotation' ? 'crosshair' : 'default'
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

  // 2. Left Click: Either select marker OR drop defect pin on building surface
  handler.setInputAction((movement: any) => {
    if (!v) return

    // If in "Add Defect Pin" tool mode:
    if (uiStore.activeTool === 'add_annotation') {
      // Pick 3D position directly from depth buffer
      const pickedPosition = v.scene.pickPosition(movement.position)
      if (Cesium.defined(pickedPosition)) {
        const coords: [number, number, number] = [
          pickedPosition.x,
          pickedPosition.y,
          pickedPosition.z
        ]
        emit('add-annotation-at', coords)
        uiStore.setActiveTool('select')
      }
      return
    }

    // Default select mode: Check if an annotation marker was clicked
    const picked = v.scene.pick(movement.position)
    if (Cesium.defined(picked) && picked.id && picked.id.properties?.annotationId) {
      const annotId = picked.id.properties.annotationId.getValue()
      const annot = props.annotations.find((a) => a.id === annotId)
      if (annot) {
        uiStore.selectAnnotation(annot.id, annot.positionXyz)
        emit('select-annotation', annot)
      }
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
          scaleByDistance: new Cesium.NearFarScalar(50.0, 1.2, 500.0, 0.7),
          disableDepthTestDistance: 50 // Keep pin visible without model clipping
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
  const dest = new Cesium.Cartesian3(coords[0], coords[1], coords[2])

  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.add(
      dest,
      new Cesium.Cartesian3(25, -25, 18),
      new Cesium.Cartesian3()
    ),
    orientation: {
      heading: Cesium.Math.toRadians(45.0),
      pitch: Cesium.Math.toRadians(-25.0),
      roll: 0.0
    },
    duration: 1.5
  })
}

function focusCurrentAsset() {
  if (!viewer) return
  const asset = uiStore.currentAsset

  if (asset.id === 'asset-tower-01') {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        asset.coordinates.lon + 0.0012,
        asset.coordinates.lat - 0.0014,
        130
      ),
      orientation: {
        heading: Cesium.Math.toRadians(320.0),
        pitch: Cesium.Math.toRadians(-22.0),
        roll: 0.0
      },
      duration: 1.2
    })
  } else if (asset.id === 'asset-real-building-02') {
    // Fly to real 3D tileset building
    if (activeTileset) {
      viewer.zoomTo(activeTileset, new Cesium.HeadingPitchRange(
        Cesium.Math.toRadians(45.0),
        Cesium.Math.toRadians(-30.0),
        110.0
      ))
    } else {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          asset.coordinates.lon + 0.0006,
          asset.coordinates.lat - 0.0006,
          50
        ),
        orientation: {
          heading: Cesium.Math.toRadians(330.0),
          pitch: Cesium.Math.toRadians(-28.0),
          roll: 0.0
        },
        duration: 1.2
      })
    }
  } else if (asset.id === 'asset-city-osm-03') {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        asset.coordinates.lon + 0.003,
        asset.coordinates.lat - 0.004,
        350
      ),
      orientation: {
        heading: Cesium.Math.toRadians(330.0),
        pitch: Cesium.Math.toRadians(-25.0),
        roll: 0.0
      },
      duration: 1.5
    })
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
