// ═══════════════════════════════════════════════════
// generate-profile-json.ts
// Generates a JSON-LD profile document from Activate state
// Schema: Search Star v1.3 with per-field provenance,
// full photo metadata, and access policy block
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
  confidenceScore?: number
}

export type AccessTier = 'public' | 'private' | 'marketing'

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
  accessTier: AccessTier
  hash: string
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

// ── Per-field provenance builder ──────────────────

function buildProvenance(field: SeededField) {
  const now = new Date().toISOString()
  const prov: Record<string, unknown> = {
    status: field.provenance,
    source: field.source,
  }

  if (field.sourceUrl) {
    prov.sourceUrl = field.sourceUrl
  }

  if (field.discoveredAt) {
    prov.seededAt = field.discoveredAt
  }

  if (field.confidenceScore !== undefined) {
    prov.confidenceScore = field.confidenceScore
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
      if (!prov.seededAt) prov.seededAt = now
      break
  }

  return prov
}

// ── Photo metadata builder (Section 3.9 schema) ──

function buildPhotoMetadata(photo: NarrativePhoto) {
  return {
    type: 'photo' as const,
    url: photo.previewUrl?.startsWith('data:')
      ? `photos/${photo.id}.webp`
      : (photo.previewUrl || `photos/${photo.id}.webp`),
    hash: photo.hash || `sha256:placeholder-${photo.id}`,
    accessTier: photo.accessTier || 'private',
    narrative: {
      chapter: photo.chapter,
      caption: photo.caption,
      date: photo.date,
      location: photo.location,
      relatedFields: photo.relatedFields || [],
    },
    provenance: {
      status: 'confirmed' as const,
      source: photo.sourceLabel || photo.source,
      discoveredAt: new Date().toISOString(),
    },
    validation: {
      validatedBy: [] as string[],
      stake: 0,
    },
  }
}

// ── Effective value helper ────────────────────────

function effectiveValue(field: SeededField): string {
  if (field.provenance === 'corrected' && field.correctedValue) {
    return field.correctedValue
  }
  return field.value
}

// ── Main generator ────────────────────────────────

export function generateProfileJson(input: ProfileInput): object {
  const { fullName, employer, city, fields, photos, pricing } = input
  const activeFields = fields.filter(f => f.provenance !== 'removed')
  const now = new Date().toISOString()

  // ── Identity fields ──
  const identityFields = activeFields.filter(f => f.section === 'Identity')
  const titleField = identityFields.find(f => f.label.toLowerCase().includes('title'))
  const locationField = identityFields.find(f => f.label.toLowerCase().includes('location'))
  const taglineField = identityFields.find(f => f.label.toLowerCase().includes('tagline'))

  // ── Skills ──
  const skillFields = activeFields.filter(f => f.section === 'Skills')
  const skills = skillFields.map(f => ({
    name: f.label,
    detail: effectiveValue(f),
    provenance: buildProvenance(f),
  }))

  // ── Interests (by category) ──
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
        detail: effectiveValue(f),
        provenance: buildProvenance(f),
      })
    }
  }

  // ── Professional history ──
  const professionalFields = activeFields.filter(f =>
    f.section.toLowerCase().includes('professional') ||
    f.section.toLowerCase().includes('experience') ||
    f.section.toLowerCase().includes('education')
  )
  const professional = professionalFields.map(f => ({
    label: f.label,
    detail: effectiveValue(f),
    provenance: buildProvenance(f),
  }))

  // ── Media array (full Section 3.9 schema) ──
  const media = photos.map(p => buildPhotoMetadata(p))

  // ── Narrative chapter counts ──
  const chapters = ['intellectual', 'social', 'athletic', 'professional', 'aesthetic', 'family'] as const
  const narrativeChapters: Record<string, number> = {}
  for (const ch of chapters) {
    narrativeChapters[ch] = photos.filter(p => p.chapter === ch).length
  }

  // ── Remaining ungrouped sections ──
  const groupedSections = new Set([
    'Skills', 'Identity',
    ...activeFields.filter(f => f.section.toLowerCase().includes('interests')).map(f => f.section),
    ...professionalFields.map(f => f.section),
  ])
  const otherFields = activeFields.filter(f => !groupedSections.has(f.section))
  const additionalSections: Record<string, Array<{ label: string; value: string; provenance: object }>> = {}
  for (const f of otherFields) {
    const key = f.section
    if (!additionalSections[key]) additionalSections[key] = []
    additionalSections[key].push({
      label: f.label,
      value: effectiveValue(f),
      provenance: buildProvenance(f),
    })
  }

  // ── Access policy with user-set pricing ──
  const accessPolicy = {
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
  }

  // ── Provenance breakdown ──
  const provenanceBreakdown = {
    confirmed: activeFields.filter(f => f.provenance === 'confirmed').length,
    corrected: activeFields.filter(f => f.provenance === 'corrected').length,
    self_reported: activeFields.filter(f => f.provenance === 'self_reported').length,
    seeded: activeFields.filter(f => f.provenance === 'seeded').length,
  }

  // ── Build the JSON-LD document ──
  const profile = {
    '@context': 'https://schema.searchstar.org/v1.3',
    '@type': 'SearchStarProfile',
    version: '1.3.0',
    updated: now,

    identity: {
      displayName: fullName,
      handle: `@${fullName.toLowerCase().replace(/\s+/g, '.')}`,
      tagline: taglineField ? effectiveValue(taglineField) : '',
      location: locationField ? effectiveValue(locationField) : city,
      currentTitle: titleField ? effectiveValue(titleField) : (employer ? `at ${employer}` : ''),
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

    narrativeChapters,

    accessPolicy,

    ...(Object.keys(additionalSections).length > 0 ? { additionalSections } : {}),

    _meta: {
      generatedBy: 'Search Star Activate',
      generatedAt: now,
      schemaVersion: '1.3',
      totalFields: activeFields.length,
      totalPhotos: photos.length,
      provenanceBreakdown,
    },
  }

  return profile
}
