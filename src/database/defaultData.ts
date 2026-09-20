import type { AnnotationTemplate, DefectAnnotation, InspectionAsset } from '@/types'

export const availableAssets: InspectionAsset[] = [
  {
    id: 'asset-real-building-01',
    name: 'Real Architectural Facility (Textured 3D Model)',
    type: 'gltf_building',
    locationName: 'Heritage & Commercial Precinct',
    coordinates: { lon: 151.2093, lat: -33.8688, height: 18 },
    modelUrl: '/models/building_real.glb',
    description: 'High-detail textured architectural digital twin featuring multi-level facades, balconies, structural beams, stairs, and roof plant.'
  },
  {
    id: 'asset-tower-02',
    name: 'Tower 02 - Commercial High-Rise (Procedural BIM)',
    type: 'procedural_tower',
    locationName: 'Sydney Harbour Business District',
    coordinates: { lon: 151.2093, lat: -33.8688, height: 0 },
    description: 'Procedural 24-story commercial office tower with curtain wall facades, podium, and rooftop plant equipment.'
  },
  {
    id: 'asset-tileset-03',
    name: 'Campus Facility (Batched 3D Tileset)',
    type: 'tileset_building',
    locationName: 'Exton Regional Campus',
    coordinates: { lon: -75.615, lat: 40.041, height: 20 },
    tilesetUrl: '/sample-tileset/tileset.json',
    description: 'Batched 3D Tileset building complex featuring brick facades, pitched roof sections, and site terrain.'
  }
]

export const defaultTemplates: AnnotationTemplate[] = [
  {
    id: 'tpl-facade-spalling',
    name: 'Façade Concrete Spalling & Delamination',
    category: 'Structural Concrete',
    version: '2.3',
    description: 'Inspection template for identifying concrete deterioration, carbonation spalling, and rebar corrosion.',
    fields: [
      {
        key: 'defectClassification',
        label: 'Defect Classification',
        type: 'select',
        options: [
          'Minor Surface Delamination',
          'Active Concrete Spall',
          'Exposed Oxidized Rebar',
          'Efflorescence & Salt Leaching',
          'Honeycombing'
        ],
        defaultValue: 'Active Concrete Spall',
        required: true
      },
      {
        key: 'defectDepthMm',
        label: 'Estimated Depth',
        type: 'number',
        unit: 'mm',
        defaultValue: 25,
        required: true
      },
      {
        key: 'defectAreaM2',
        label: 'Affected Surface Area',
        type: 'number',
        unit: 'm²',
        defaultValue: 0.45
      },
      {
        key: 'dropHazard',
        label: 'Immediate Drop Hazard',
        type: 'boolean',
        defaultValue: true
      },
      {
        key: 'urgencyLevel',
        label: 'Priority Level',
        type: 'select',
        options: [
          'Priority 1 - Urgent (< 14 days)',
          'Priority 2 - Scheduled (< 60 days)',
          'Priority 3 - Routine Maintenance',
          'Monitor Only'
        ],
        defaultValue: 'Priority 1 - Urgent (< 14 days)',
        required: true
      },
      {
        key: 'remedialAction',
        label: 'Remedial Action',
        type: 'textarea',
        defaultValue: 'Make-safe scaling required. Excavate concrete to 20mm behind rebar, apply zinc-rich primer, and patch with polymer-modified structural mortar.'
      }
    ]
  },
  {
    id: 'tpl-coating-failure',
    name: 'Protective Coating & Corrosion Assessment',
    category: 'Coatings & Finishes',
    version: '1.8',
    description: 'Assessment of architectural paint, membrane seals, and anti-corrosive barrier coatings.',
    fields: [
      {
        key: 'coatingType',
        label: 'Substrate & Coating System',
        type: 'select',
        options: [
          'Elastomeric Waterproof Membrane',
          'Polyurethane Topcoat',
          'Epoxy Barrier',
          'Anodized Aluminium Cladding',
          'Galvanized Structural Steel'
        ],
        defaultValue: 'Elastomeric Waterproof Membrane'
      },
      {
        key: 'failureMode',
        label: 'Failure Mechanism',
        type: 'select',
        options: [
          'Blistering & Delamination',
          'Chalking & UV Degradation',
          'Inter-coat Adhesion Failure',
          'Substrate Rust Bleed',
          'Mechanical Abrasion'
        ],
        defaultValue: 'Blistering & Delamination'
      },
      {
        key: 'waterIngressRisk',
        label: 'Water Ingress Risk',
        type: 'boolean',
        defaultValue: true
      },
      {
        key: 'approximateAreaM2',
        label: 'Affected Area',
        type: 'number',
        unit: 'm²',
        defaultValue: 1.2
      },
      {
        key: 'remedialAction',
        label: 'Specification Notes',
        type: 'textarea',
        defaultValue: 'Strip degraded membrane, pressure wash substrate at 3000 PSI, apply primer and 2-coat high-build waterproofing system.'
      }
    ]
  },
  {
    id: 'tpl-crack-monitoring',
    name: 'Crack & Structural Displacement Monitoring',
    category: 'Structural Integrity',
    version: '3.0',
    description: 'Structural crack mapping, shear line tracking, and building settlement analysis.',
    fields: [
      {
        key: 'crackType',
        label: 'Crack Morphology',
        type: 'select',
        options: [
          'Hairline Thermal (< 0.5mm)',
          'Moderate Structural (0.5mm - 2.5mm)',
          'Severe Shear / Diagonal (> 2.5mm)',
          'Step-joint Mortar Separation'
        ],
        defaultValue: 'Moderate Structural (0.5mm - 2.5mm)'
      },
      {
        key: 'crackWidthMm',
        label: 'Measured Width',
        type: 'number',
        unit: 'mm',
        defaultValue: 2.1
      },
      {
        key: 'crackLengthM',
        label: 'Total Length',
        type: 'number',
        unit: 'm',
        defaultValue: 1.85
      },
      {
        key: 'gaugeInstalled',
        label: 'Tell-Tale Gauge Installed',
        type: 'boolean',
        defaultValue: false
      },
      {
        key: 'monitoringInterval',
        label: 'Recommended Monitoring Interval',
        type: 'select',
        options: ['Bi-Weekly', 'Monthly', 'Quarterly', 'Semi-Annual'],
        defaultValue: 'Monthly'
      },
      {
        key: 'remedialAction',
        label: 'Structural Engineering Review',
        type: 'textarea',
        defaultValue: 'Install calibrated optical tell-tale crack gauge. If active displacement exceeds 0.5mm over 30 days, commission full structural load assessment.'
      }
    ]
  }
]
