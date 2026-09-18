import type { AnnotationTemplate, DefectAnnotation, InspectionAsset } from '@/types'

export const availableAssets: InspectionAsset[] = [
  {
    id: 'asset-tower-01',
    name: 'Tower 01 - Commercial High-Rise',
    type: 'procedural_tower',
    locationName: 'Sydney Harbour Precinct',
    coordinates: { lon: 151.2093, lat: -33.8688, height: 0 },
    description: 'Custom procedural 24-story commercial office tower with curtain wall facades, podium, and rooftop plant equipment.'
  },
  {
    id: 'asset-real-building-02',
    name: 'Real 3D Tiles Facility (Batched Architecture)',
    type: 'tileset_building',
    locationName: 'Exton Campus Complex',
    coordinates: { lon: -75.615, lat: 40.041, height: 20 },
    tilesetUrl: '/sample-tileset/tileset.json',
    description: 'Real photorealistic 3D Tileset building complex featuring brick facades, pitched roof sections, and surrounding site geometry.'
  },
  {
    id: 'asset-city-osm-03',
    name: 'Real Urban Digital Twin (Sydney CBD & Barangaroo)',
    type: 'osm_city',
    locationName: 'Sydney Central Business District',
    coordinates: { lon: 151.2045, lat: -33.8638, height: 180 },
    description: 'Global 3D OpenStreetMap building geometries and heights streaming real urban structures.'
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

// Sample annotations situated across both demo assets
export const initialDemoAnnotations: DefectAnnotation[] = [
  // --- Asset 1: Procedural Commercial High-Rise ---
  {
    id: 'defect-spall-001',
    assetId: 'asset-tower-01',
    title: 'Spalling & Exposed Rebar - Level 8 East Façade',
    description: 'Severe concrete delamination with visible rust staining and loose aggregate. High drop risk over pedestrian walkway.',
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
    id: 'defect-crack-002',
    assetId: 'asset-tower-01',
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
      remedialAction: 'Monitor with optical tell-tale. Low pressure epoxy injection planned for next maintenance cycle.'
    },
    author: 'Lead Structural Eng. M. Chen',
    createdAt: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 18).toISOString()
  },
  {
    id: 'defect-coat-003',
    assetId: 'asset-tower-01',
    title: 'Waterproofing Membrane Blistering - Level 4 Balcony',
    description: 'Localized bubbling and peeling of UV protective topcoat with underlying moisture entrapment.',
    severity: 'medium',
    status: 'open',
    positionXyz: [-4492865.0, 2673040.0, -3678540.0],
    templateId: 'tpl-coating-failure',
    templateValues: {
      coatingType: 'Elastomeric Waterproof Membrane',
      failureMode: 'Blistering & Delamination',
      waterIngressRisk: true,
      approximateAreaM2: 2.1,
      remedialAction: 'Core moisture testing, peel back failed section, re-prime and apply 2 coats of elastomeric barrier.'
    },
    author: 'Façade Specialist R. Torres',
    createdAt: new Date(Date.now() - 3600000 * 24 * 7).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 48).toISOString()
  },

  // --- Asset 2: Real-World 3D Tiles Building Complex ---
  {
    id: 'defect-real-brick-01',
    assetId: 'asset-real-building-02',
    title: 'Mortar Joint Leaching & Efflorescence - North Wing Wall',
    description: 'Extensive white mineral deposits and eroded bedding mortar along ground level brick courses.',
    severity: 'high',
    status: 'open',
    positionXyz: [1214800.8, -4736484.3, 4081478.3],
    templateId: 'tpl-facade-spalling',
    templateValues: {
      defectClassification: 'Efflorescence & Salt Leaching',
      defectDepthMm: 15,
      defectAreaM2: 1.8,
      dropHazard: false,
      urgencyLevel: 'Priority 2 - Scheduled (< 60 days)',
      remedialAction: 'Rake out defective mortar to 20mm depth, neutral salt wash, and re-point with lime-based mortar.'
    },
    author: 'Senior Inspector J. Vance',
    createdAt: new Date(Date.now() - 3600000 * 24 * 1).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 3).toISOString()
  },
  {
    id: 'defect-real-roof-02',
    assetId: 'asset-real-building-02',
    title: 'Roof Flashing Separation - Pitched Gable Junction',
    description: 'Corroded lead flashing pulled away from parapet masonry, creating open ingress pathway into roof void.',
    severity: 'critical',
    status: 'open',
    positionXyz: [1214811.9, -4736493.3, 4081488.0],
    templateId: 'tpl-coating-failure',
    templateValues: {
      coatingType: 'Galvanized Structural Steel',
      failureMode: 'Substrate Rust Bleed',
      waterIngressRisk: true,
      approximateAreaM2: 0.8,
      remedialAction: 'Replace damaged flashing with code-compliant zinc-coated metal flashing and seal with high-grade polyurethane sealant.'
    },
    author: 'Roofing Consultant K. Adams',
    createdAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 12).toISOString()
  },
  {
    id: 'defect-real-crack-03',
    assetId: 'asset-real-building-02',
    title: 'Foundation Step-Joint Crack - West Elevation',
    description: 'Diagonal step crack following mortar line through 6 courses of brickwork above foundation footing.',
    severity: 'medium',
    status: 'in_progress',
    positionXyz: [1214791.7, -4736483.2, 4081490.0],
    templateId: 'tpl-crack-monitoring',
    templateValues: {
      crackType: 'Step-joint Mortar Separation',
      crackWidthMm: 1.8,
      crackLengthM: 1.2,
      gaugeInstalled: true,
      monitoringInterval: 'Monthly',
      remedialAction: 'Calibrated crack monitor affixed. Underpinning review recommended if movement continues past next quarter.'
    },
    author: 'Lead Structural Eng. M. Chen',
    createdAt: new Date(Date.now() - 3600000 * 24 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 8).toISOString()
  }
]
