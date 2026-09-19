export type Severity = 'low' | 'medium' | 'high' | 'critical'
export type DefectStatus = 'open' | 'in_progress' | 'resolved'

export interface TemplateField {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'textarea' | 'boolean'
  options?: string[]
  unit?: string
  defaultValue?: any
  required?: boolean
  description?: string
}

export interface AnnotationTemplate {
  id: string
  name: string
  category: string
  version: string
  description: string
  fields: TemplateField[]
  createdAt?: string
  updatedAt?: string
}

export interface DefectAnnotation {
  id: string
  assetId: string
  title: string
  description?: string
  severity: Severity
  status: DefectStatus
  positionXyz: [number, number, number] // Cartesian3 coordinates
  templateId: string
  templateValues: Record<string, any>
  author: string
  createdAt: string
  updatedAt: string
}

export interface InspectionAsset {
  id: string
  name: string
  type: 'gltf_building' | 'procedural_tower' | 'tileset_building' | 'osm_city'
  locationName: string
  coordinates: { lon: number; lat: number; height: number }
  modelUrl?: string
  tilesetUrl?: string
  description: string
}

export type ActiveTool = 'select' | 'add_annotation' | 'measure'
