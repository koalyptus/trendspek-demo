# Trendspek Demo: 3D Digital Twin Inspection Platform

A local-first, 60 FPS 3D asset inspection platform built with **Vue 3**, **Vuetify 3 (Dark Mode)**, **Pinia**, **CesiumJS**, and **RxDB + IndexedDB (Dexie)**.

Inspired by [Trendspek](https://trendspek.com/) and architectural discussions on local-first digital twins.

---

## Architectural Principles

Following high-performance 60 FPS WebGL frontend architecture guidelines:

```
┌────────────────────────────────────────────────────────┐
│                   RxDB / IndexedDB                     │
│  Persistence & Domain Single Source of Truth (SSOT)    │
│  • Stores Cartesian [x, y, z], defects, & templates    │
│  • Emits reactive RxJS streams (db.annotations.find().$)│
└───────────────────────────┬────────────────────────────┘
                            │ RxJS Observable Stream
                            ▼
┌────────────────────────────────────────────────────────┐
│                   CesiumJS Viewport                    │
│  Spatial Projection & WebGL Render Pipeline             │
│  • Un-proxied (bypasses Vue deep reactivity)           │
│  • GPU Depth Picking (scene.pickPosition)              │
│  • 3D Building Demo Model & SVG Billboards             │
└───────────────────────────┬────────────────────────────┘
                            │ User Picks & Viewport Events
                            ▼
┌────────────────────────────────────────────────────────┐
│                      Pinia Store                       │
│  Transient UI View-State Only                          │
│  • selectedAnnotationId, isLeftPanelOpen, isRightPanel │
│  • activeTool ('select' | 'add_annotation')            │
└────────────────────────────────────────────────────────┘
```

1. **RxDB + IndexedDB (Dexie)**: Serves as the persistence engine and single source of truth for all spatial entities and inspection templates. Works completely offline.
2. **CesiumJS Engine**: Kept un-proxied (outside of Vue's `reactive()` proxies) to eliminate garbage collection churn and guarantee a smooth 60 FPS viewport.
3. **Pinia Store**: Exclusively manages transient UI view-state (active tool, selected annotation ID, drawer visibility), never storing heavy spatial collections.
4. **Vuetify 3 (Dark Mode)**: Styled in a dark theme with cyan/teal primary accents, custom severity badges (Critical, High, Medium, Low), and collapsible inspector panels.

---

## Key Features

- **Expandable Left Panel (Annotations & Defects)**:
  - Lists defects recorded on the active 3D model asset.
  - Real-time search and severity filters (Critical, High, Medium, Low).
  - Clean empty state with quick pin-drop action.
  - Selecting an annotation highlights it, triggers a Cesium camera fly-to, and **automatically expands the Right Panel**.
- **CesiumJS 3D Viewport**:
  - Realistic multi-story architectural demo building structure (plinth, podium, curtain wall facade ribs, floor slabs, rooftop plant room, service core).
  - 3D Billboard defect pins dynamically color-coded by severity.
  - **GPU Depth Picking**: Switch to "Drop Defect Pin" mode and click anywhere on the 3D building surface to capture surface coordinates and record a new defect.
  - Interactive hover tooltips and viewport controls (Reset View, Focus Tower, Wireframe).
- **Expandable Right Panel (Inspection Template)**:
  - Dynamically displays the template used for the selected annotation.
  - Pre-seeded with industry inspection templates:
    - *Façade Concrete Spalling & Delamination* (depth mm, area m², drop hazard, remedial action).
    - *Protective Coating & Corrosion Assessment* (coating type, failure mode, water ingress risk, specs).
    - *Crack & Structural Displacement Monitoring* (crack type, width mm, length m, tell-tale gauge).
  - Editing fields immediately persists to IndexedDB via RxDB.

---

## Getting Started

### Prerequisites
- Node.js >= 18
- npm >= 9

### Installation
```bash
npm install
```

### Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Production Build
```bash
npm run build
```
Preview the production build:
```bash
npm run preview
```