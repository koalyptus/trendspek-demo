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

export const initialDemoAnnotations: DefectAnnotation[] = [
  // --- Asset 1: Real Architectural Facility (Textured 3D Model) ---
  {
    id: 'defect-real-balcony-01',
    assetId: 'asset-real-building-01',
    title: 'Reinforced Concrete Spalling - Level 2 Balcony Soffit',
    description: 'Delamination of concrete cover under balcony slab with exposed oxidized reinforcement bars. High drop hazard over entrance walkway.',
    severity: 'critical',
    status: 'open',
    positionXyz: [-4646062.3, 2553204.0, -3534384.8],
    templateId: 'tpl-facade-spalling',
    templateValues: {
      defectClassification: 'Active Concrete Spall',
      defectDepthMm: 35,
      defectAreaM2: 0.75,
      dropHazard: true,
      urgencyLevel: 'Priority 1 - Urgent (< 14 days)',
      remedialAction: 'Install immediate pedestrian protective canopy. Mechanical concrete breakout to 25mm behind rebar, apply zinc sacrificial anodes and structural repair mortar.'
    },
    author: 'Senior Inspector J. Vance',
    createdAt: new Date(Date.now() - 3600000 * 24 * 1).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 3).toISOString()
  },
  {
    id: 'defect-real-wall-02',
    assetId: 'asset-real-building-01',
    title: 'Protective Membrane Delamination - West Brick Façade',
    description: 'Thermal blistering and peeling of external waterproof membrane coating along structural column interface.',
    severity: 'high',
    status: 'in_progress',
    positionXyz: [-4646076.2, 2553226.4, -3534382.9],
    templateId: 'tpl-coating-failure',
    templateValues: {
      coatingType: 'Elastomeric Waterproof Membrane',
      failureMode: 'Blistering & Delamination',
      waterIngressRisk: true,
      approximateAreaM2: 2.4,
      remedialAction: 'High pressure wash, strip failed sections, apply vapor-permeable primer and 2-coat polyurethane barrier.'
    },
    author: 'Façade Specialist R. Torres',
    createdAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 12).toISOString()
  },
  {
    id: 'defect-real-roof-03',
    assetId: 'asset-real-building-01',
    title: 'Structural Parapet Shear Crack - Rooftop Plant Level',
    description: 'Continuous diagonal crack propagating through parapet brickwork adjacent to mechanical rooftop chiller mounting.',
    severity: 'medium',
    status: 'open',
    positionXyz: [-4646091.1, 2553226.1, -3534399.5],
    templateId: 'tpl-crack-monitoring',
    templateValues: {
      crackType: 'Moderate Structural (0.5mm - 2.5mm)',
      crackWidthMm: 2.4,
      crackLengthM: 1.6,
      gaugeInstalled: true,
      monitoringInterval: 'Monthly',
      remedialAction: 'Calibrated crack gauge monitoring active. Low pressure epoxy structural injection scheduled.'
    },
    author: 'Lead Structural Eng. M. Chen',
    createdAt: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 18).toISOString()
  },

  // --- Asset 2: Procedural Commercial High-Rise ---
  {
    id: 'defect-tower-spall-001',
    assetId: 'asset-tower-02',
    title: 'Spalling & Exposed Rebar - Level 8 East Façade',
    description: 'Severe concrete delamination with visible rust staining and loose aggregate.',
    severity: 'critical',
    status: 'open',
    positionXyz: [-4492850.5, 2673050.2, -3678500.0],
    templateId: 'tpl-facade-spalling',
    templateValues: {
      defectClassification: 'Active Concrete Spall',
      defectDepthMm: 35,
      defectAreaM2: 0.65,
      dropHazard: true,
      urgencyLevel: 'Priority 1 - Urgent (< 14 days)',
      remedialAction: 'Immediate safety netting installation. Hand-scale loose concrete and patch with structural mortar.'
    },
    author: 'Senior Inspector J. Vance',
    createdAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 5).toISOString()
  },
  {
    id: 'defect-tower-crack-002',
    assetId: 'asset-tower-02',
    title: 'Shear Crack along Parapet Beam - Roof Level',
    description: 'Continuous diagonal crack running from corner column junction across parapet beam.',
    severity: 'high',
    status: 'in_progress',
    positionXyz: [-4492835.0, 2673070.0, -3678460.0],
    templateId: 'tpl-crack-monitoring',
    templateValues: {
      crackType: 'Severe Shear / Diagonal (> 2.5mm)',
      crackWidthMm: 3.2,
      crackLengthM: 2.4,
      gaugeInstalled: true,
      monitoringInterval: 'Bi-Weekly',
      remedialAction: 'Monitor with optical tell-tale.'
    },
    author: 'Lead Structural Eng. M. Chen',
    createdAt: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 18).toISOString()
  }
]
