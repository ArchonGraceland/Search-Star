// ═══════════════════════════════════════════════════
// generate-profile-json.ts
// Generates a JSON-LD profile document from Activate state
// Schema: Search Star v1.3 with per-field provenance
// ═══════════════════════════════════════════════════

export interface SeededField {
  id: string
  section: string
  label: string
  value: string
  source: string
  sourceUrl: string
  provenance: 'seeded' | 'confirmed' | 'corrected' | 'self_reported' | 'removed'
  correctedValue?: string
  discoveredAt?: string
}

export interface NarrativePhoto {
  id: string
  chapter: 'intellectual' | 'social' | 'athletic' | 'professional' | 'aesthetic' | 'family'
  caption: string
  date: string
  location: string
  source: 'public' | 'google' | 'upload' | 'url'
  sourceLabel: string
  previewUrl: string
  relatedFields: string[]
}

export interface PricingConfig {
  publicPrice: string
  privatePrice: string
  marketingPrice: string
}

export interface ProfileInput {
  fullName: string
  employer: string
  city: string
  fields: SeededField[]
  photos: NarrativePhoto[]
  pricing: PricingConfig
}

function buildProvenance(field: SeededField) {
  const now = new Date().toISOString()
  const prov: Record<string, string> = {
    status: field.provenance,
    source: field.source,
  }

  if (field.discoveredAt) {
    prov.seededAt = field.discoveredAt
  }

  switch (field.provenance) {
    case 'confirmed':
      prov.confirmedAt = now
      break
    case 'corrected':
      prov.correctedAt = now
      if (field.value) prov.originalValue = field.value
      break
    case 'self_reported':
      prov.addedAt = now
      break
    case 'seeded':
      // Still unreviewed — just seededAt
      if (!prov.seededAt) prov.seededAt = now
      break
  }

  return prov
}

function groupFieldsBySection(fields: SeededField[]) {
  const groups: Record<string, SeededField[]> = {}
  for (const f of fields) {
    if (f.provenance === 'removed') continue
    const key = f.section.toLowerCase().replace(/[^a-z0-9]/g, '_')
    if (!groups[key]) groups[key] = []
    groups[key].push(f)
  }
  return groups
}

export function generateProfileJson(input: ProfileInput): object {
  const { fullName, employer, city, fields, photos, pricing } = input
  const activeFields = fields.filter(f => f.provenance !== 'removed')
  const now = new Date().toISOString()

  // Build skills array from Skills section fields
  const skillFields = activeFields.filter(f => f.section === 'Skills')
  const skills = skillFields.map(f => ({
    name: f.label,
    detail: f.correctedValue || f.value,
    provenance: buildProvenance(f),
  }))

  // Build interests from Interests sections
  const interestCategories: Record<string, Array<{ name: string; detail: string; provenance: object }>> = {
    athletic: [],
    social: [],
    intellectual: [],
  }
  for (const f of activeFields) {
    const sectionLower = f.section.toLowerCase()
    if (sectionLower.includes('interests')) {
      let cat = 'intellectual'
      if (sectionLower.includes('athletic')) cat = 'athletic'
      else if (sectionLower.includes('social')) cat = 'social'
      interestCategories[cat].push({
        name: f.label,
        detail: f.correctedValue || f.value,
        provenance: buildProvenance(f),
      })
    }
  }

  // Build identity fields from Identity section
  const identityFields = activeFields.filter(f => f.section === 'Identity')
  const titleField = identityFields.find(f => f.label.toLowerCase().includes('title'))
  const locationField = identityFields.find(f => f.label.toLowerCase().includes('location'))
  const taglineField = identityFields.find(f => f.label.toLowerCase().includes('tagline'))

  // Build professional history fields
  const professionalFields = activeFields.filter(f =>
    f.section.toLowerCase().includes('professional') ||
    f.section.toLowerCase().includes('experience') ||
    f.section.toLowerCase().includes('education')
  )
  const professional = professionalFields.map(f => ({
    label: f.label,
    detail: f.correctedValue || f.value,
    provenance: buildProvenance(f),
  }))

  // Build media array from photos
  const media = photos.map(p => ({
    type: 'photo' as const,
    url: p.previewUrl || `photos/${p.id}.webp`,
    label: p.caption,
    chapter: p.chapter,
    date: p.date,
    location: p.location,
    source: p.sourceLabel,
    accessTier: 'private',
    relatedFields: p.relatedFields,
    hash: `sha256:placeholder-${p.id}`,
  }))

  // Build the remaining ungrouped fields
  const groupedSections = new Set([
    'Skills', 'Identity',
    ...activeFields.filter(f => f.section.toLowerCase().includes('interests')).map(f => f.section),
    ...activeFields.filter(f =>
      f.section.toLowerCase().includes('professional') ||
      f.section.toLowerCase().includes('experience') ||
      f.section.toLowerCase().includes('education')
    ).map(f => f.section),
  ])
  const otherFields = activeFields.filter(f => !groupedSections.has(f.section))
  const additionalData: Record<string, Array<{ label: string; value: string; provenance: object }>> = {}
  for (const f of otherFields) {
    const key = f.section
    if (!additionalData[key]) additionalData[key] = []
    additionalData[key].push({
      label: f.label,
      value: f.correctedValue || f.value,
      provenance: buildProvenance(f),
    })
  }

  // Build the full JSON-LD document
  const profile = {
    '@context': 'https://schema.searchstar.org/v1.3',
    '@type': 'SearchStarProfile',
    version: '1.3.0',
    updated: now,

    identity: {
      displayName: fullName,
      handle: `@${fullName.toLowerCase().replace(/\s+/g, '.')}`,
      tagline: taglineField ? (taglineField.correctedValue || taglineField.value) : '',
      location: locationField ? (locationField.correctedValue || locationField.value) : city,
      currentTitle: titleField ? (titleField.correctedValue || titleField.value) : (employer ? `at ${employer}` : ''),
    },

    skills,

    interests: {
      athletic: interestCategories.athletic,
      social: interestCategories.social,
      intellectual: interestCategories.intellectual,
    },

    professional,

    presenceComposite: {
      score: null,
      note: 'Presence Composite requires explicit participation and photo scoring — not populated during Activate.',
    },

    media,

    narrativeChapters: {
      intellectual: photos.filter(p => p.chapter === 'intellectual').length,
      social: photos.filter(p => p.chapter === 'social').length,
      athletic: photos.filter(p => p.chapter === 'athletic').length,
      professional: photos.filter(p => p.chapter === 'professional').length,
      aesthetic: photos.filter(p => p.chapter === 'aesthetic').length,
      family: photos.filter(p => p.chapter === 'family').length,
    },

    accessPolicy: {
      tiers: {
        public: {
          pricePerQuery: parseFloat(pricing.publicPrice) || 0.02,
          includes: ['identity', 'skills', 'interests', 'presenceComposite.score'],
        },
        private: {
          pricePerQuery: parseFloat(pricing.privatePrice) || 0.50,
          includes: ['*'],
        },
        marketing: {
          pricePerMessage: parseFloat(pricing.marketingPrice) || 5.00,
        },
      },
      revenueSplit: {
        profileOwner: 0.90,
        searchStar: 0.10,
      },
    },

    // Additional ungrouped data sections
    ...(Object.keys(additionalData).length > 0 ? { additionalSections: additionalData } : {}),

    _meta: {
      generatedBy: 'Search Star Activate',
      generatedAt: now,
      schemaVersion: '1.3',
      totalFields: activeFields.length,
      totalPhotos: photos.length,
      provenanceBreakdown: {
        confirmed: activeFields.filter(f => f.provenance === 'confirmed').length,
        corrected: activeFields.filter(f => f.provenance === 'corrected').length,
        self_reported: activeFields.filter(f => f.provenance === 'self_reported').length,
        seeded: activeFields.filter(f => f.provenance === 'seeded').length,
      },
    },
  }

  return profile
}
