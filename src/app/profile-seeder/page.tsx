'use client'

import { useState, useCallback } from 'react'
import { PublicHeader } from '@/components/public-header'
import { PublicFooter } from '@/components/public-footer'

// ═══════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════

type Step = 'identify' | 'results' | 'review' | 'private' | 'photos' | 'publish'
type Provenance = 'seeded' | 'confirmed' | 'corrected' | 'self_reported' | 'removed'
type PhotoChannel = 'public' | 'google' | 'upload' | 'url'
type NarrativeChapter = 'intellectual' | 'social' | 'athletic' | 'professional' | 'aesthetic' | 'family'

interface SeededField {
  id: string
  section: string
  label: string
  value: string
  source: string
  sourceUrl: string
  provenance: Provenance
  correctedValue?: string
}

interface NarrativePhoto {
  id: string
  chapter: NarrativeChapter
  caption: string
  date: string
  location: string
  source: PhotoChannel
  sourceLabel: string
  previewUrl: string
  relatedFields: string[]
}

// ═══════════════════════════════════════════════════
// Mock data — simulates scraping results
// ═══════════════════════════════════════════════════

const MOCK_SEEDED_FIELDS: SeededField[] = [
  { id: '1', section: 'Identity', label: 'Name', value: 'Jane Smith', source: 'linkedin.com', sourceUrl: 'https://linkedin.com/in/janesmith-eng', provenance: 'seeded' },
  { id: '2', section: 'Identity', label: 'Title', value: 'Staff Engineer, Datadog', source: 'linkedin.com', sourceUrl: 'https://linkedin.com/in/janesmith-eng', provenance: 'seeded' },
  { id: '3', section: 'Identity', label: 'Location', value: 'Brooklyn, NY', source: 'linkedin.com', sourceUrl: 'https://linkedin.com/in/janesmith-eng', provenance: 'seeded' },
  { id: '4', section: 'Skills', label: 'Python', value: 'Expert · 92 repos, 14k commits', source: 'github.com', sourceUrl: 'https://github.com/janesmith', provenance: 'seeded' },
  { id: '5', section: 'Skills', label: 'Go', value: 'Advanced · 31 repos', source: 'github.com', sourceUrl: 'https://github.com/janesmith', provenance: 'seeded' },
  { id: '6', section: 'Skills', label: 'Distributed Systems', value: '4 published papers', source: 'scholar.google.com', sourceUrl: 'https://scholar.google.com/citations?user=abc', provenance: 'seeded' },
  { id: '7', section: 'Interests (intellectual)', label: 'Conference Speaking', value: 'PyCon 2024, KubeCon 2023, GopherCon 2023', source: 'pycon.org', sourceUrl: 'https://pycon.org/2024/speakers', provenance: 'seeded' },
  { id: '8', section: 'Interests (athletic)', label: 'Running', value: 'Brooklyn Half 2024 — 1:42:11', source: 'athlinks.com', sourceUrl: 'https://athlinks.com/results/janesmith', provenance: 'seeded' },
  { id: '9', section: 'Interests (intellectual)', label: 'Open Source', value: 'Maintainer of 3 projects with 2.1k+ stars', source: 'github.com', sourceUrl: 'https://github.com/janesmith', provenance: 'seeded' },
]

const MOCK_PHOTOS: NarrativePhoto[] = [
  { id: 'p1', chapter: 'intellectual', caption: 'Keynote at PyCon 2024', date: '2024-05-18', location: 'Pittsburgh, PA', source: 'public', sourceLabel: 'pycon.org', previewUrl: '', relatedFields: ['skills.python', 'interests.intellectual.conference_speaking'] },
  { id: 'p2', chapter: 'intellectual', caption: 'Panel at KubeCon 2023', date: '2023-11-07', location: 'Chicago, IL', source: 'public', sourceLabel: 'kubecon.io', previewUrl: '', relatedFields: ['skills.distributed_systems'] },
  { id: 'p3', chapter: 'athletic', caption: 'Brooklyn Half Marathon finish', date: '2024-05-18', location: 'Brooklyn, NY', source: 'public', sourceLabel: 'marathonfoto.com', previewUrl: '', relatedFields: ['interests.athletic.running'] },
]

const CHAPTERS: { key: NarrativeChapter; label: string; icon: string; description: string }[] = [
  { key: 'intellectual', label: 'Intellectual life', icon: '📚', description: 'Conferences, research, teaching, published work' },
  { key: 'social', label: 'Social life', icon: '🤝', description: 'Community, travel, cultural experiences, gatherings' },
  { key: 'athletic', label: 'Athletic life', icon: '🏃', description: 'Competition, training, outdoor adventures' },
  { key: 'professional', label: 'Professional life', icon: '💼', description: 'Workspace, teams, milestones, awards' },
  { key: 'aesthetic', label: 'Aesthetic identity', icon: '✨', description: 'Style, living space, curated environments' },
  { key: 'family', label: 'Family life', icon: '🏠', description: 'Private tier by default — always optional' },
]

const STEPS: { key: Step; num: number; label: string; sub: string }[] = [
  { key: 'identify', num: 1, label: 'Identify', sub: 'Name & details' },
  { key: 'results', num: 2, label: 'Scrape', sub: 'Public sources' },
  { key: 'review', num: 3, label: 'Review', sub: 'Confirm & correct' },
  { key: 'private', num: 4, label: 'Private', sub: 'Financial, family' },
  { key: 'photos', num: 5, label: 'Photos', sub: 'Visual narrative' },
  { key: 'publish', num: 6, label: 'Publish', sub: 'Pricing & files' },
]

// ═══════════════════════════════════════════════════
// Provenance badge component
// ═══════════════════════════════════════════════════

function ProvenanceBadge({ status }: { status: Provenance }) {
  const styles: Record<Provenance, { bg: string; text: string; label: string }> = {
    seeded: { bg: '#fffbeb', text: '#92400e', label: 'seeded' },
    confirmed: { bg: '#f0fdf4', text: '#166534', label: 'confirmed' },
    corrected: { bg: '#eef2f8', text: '#1a3a6b', label: 'corrected' },
    self_reported: { bg: '#f5f3ff', text: '#5b21b6', label: 'self-reported' },
    removed: { bg: '#fef2f2', text: '#991b1b', label: 'removed' },
  }
  const s = styles[status]
  return (
    <span
      className="font-body text-[10px] font-bold tracking-[0.08em] uppercase px-2 py-[2px] rounded-[3px] inline-block"
      style={{ background: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  )
}

// ═══════════════════════════════════════════════════
// Photo card component
// ═══════════════════════════════════════════════════

function PhotoCard({ photo, onRemove }: { photo: NarrativePhoto; onRemove: (id: string) => void }) {
  const chapterObj = CHAPTERS.find(c => c.key === photo.chapter)
  return (
    <div className="bg-white border border-[#d4d4d4] rounded-[3px] overflow-hidden">
      <div className="aspect-[4/3] bg-[#eef2f8] flex items-center justify-center relative">
        <span className="text-3xl">{chapterObj?.icon || '📷'}</span>
        <div className="absolute bottom-2 left-2 font-body text-[9px] font-bold tracking-[0.08em] uppercase bg-white/90 text-[#5a5a5a] px-2 py-[2px] rounded-[2px] border border-[#d4d4d4]">
          {photo.source === 'public' ? '🌐 ' : photo.source === 'google' ? '📸 ' : photo.source === 'upload' ? '📁 ' : '🔗 '}
          {photo.sourceLabel}
        </div>
      </div>
      <div className="p-3">
        <div className="font-body text-[13px] font-medium text-[#1a1a1a] leading-tight">{photo.caption}</div>
        <div className="font-body text-[11px] text-[#767676] mt-1">{photo.date} · {photo.location}</div>
        <div className="flex items-center justify-between mt-2">
          <span className="font-body text-[10px] font-bold tracking-[0.08em] uppercase px-2 py-[2px] rounded-[3px]"
            style={{ background: '#eef2f8', color: '#1a3a6b' }}>
            {chapterObj?.label}
          </span>
          <button
            onClick={() => onRemove(photo.id)}
            className="font-body text-[10px] text-[#991b1b] hover:text-[#7f1d1d] cursor-pointer bg-transparent border-none"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════

export default function ProfileSeeder() {
  const [step, setStep] = useState<Step>('identify')
  const [scraping, setScraping] = useState(false)

  // Step 1 — Identify
  const [fullName, setFullName] = useState('')
  const [employer, setEmployer] = useState('')
  const [city, setCity] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')

  // Step 2/3 — Seeded fields
  const [fields, setFields] = useState<SeededField[]>([])

  // Step 3 — correction editing
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  // Step 3 — add new field
  const [addingField, setAddingField] = useState(false)
  const [newFieldSection, setNewFieldSection] = useState('Skills')
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [newFieldValue, setNewFieldValue] = useState('')

  // Step 5 — Photos
  const [photos, setPhotos] = useState<NarrativePhoto[]>([])
  const [showUrlImport, setShowUrlImport] = useState(false)
  const [importUrl, setImportUrl] = useState('')
  const [importChapter, setImportChapter] = useState<NarrativeChapter>('intellectual')
  const [importCaption, setImportCaption] = useState('')

  // Step 6 — Pricing
  const [publicPrice, setPublicPrice] = useState('0.02')
  const [privatePrice, setPrivatePrice] = useState('0.50')
  const [marketingPrice, setMarketingPrice] = useState('5.00')

  const currentStepIndex = STEPS.findIndex(s => s.key === step)

  // ═══ Handlers ═══

  const handleScrape = useCallback(() => {
    setScraping(true)
    // Simulate scraping delay
    setTimeout(() => {
      setFields(MOCK_SEEDED_FIELDS)
      setPhotos(MOCK_PHOTOS)
      setScraping(false)
      setStep('results')
    }, 2400)
  }, [])

  const handleConfirmField = (id: string) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, provenance: 'confirmed' as Provenance } : f))
  }

  const handleStartCorrection = (id: string) => {
    const field = fields.find(f => f.id === id)
    if (field) {
      setEditingField(id)
      setEditValue(field.value)
    }
  }

  const handleSaveCorrection = (id: string) => {
    setFields(prev => prev.map(f => f.id === id ? {
      ...f,
      provenance: 'corrected' as Provenance,
      correctedValue: editValue,
    } : f))
    setEditingField(null)
    setEditValue('')
  }

  const handleRemoveField = (id: string) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, provenance: 'removed' as Provenance } : f))
  }

  const handleAddField = () => {
    if (!newFieldLabel.trim() || !newFieldValue.trim()) return
    const newField: SeededField = {
      id: `custom-${Date.now()}`,
      section: newFieldSection,
      label: newFieldLabel,
      value: newFieldValue,
      source: 'self',
      sourceUrl: '',
      provenance: 'self_reported',
    }
    setFields(prev => [...prev, newField])
    setNewFieldLabel('')
    setNewFieldValue('')
    setAddingField(false)
  }

  const handleRemovePhoto = (id: string) => {
    setPhotos(prev => prev.filter(p => p.id !== id))
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, chapter: NarrativeChapter) => {
    const fileList = e.target.files
    if (!fileList) return
    const chapterObj = CHAPTERS.find(c => c.key === chapter)
    Array.from(fileList).forEach((file, i) => {
      const newPhoto: NarrativePhoto = {
        id: `upload-${Date.now()}-${i}`,
        chapter,
        caption: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
        date: new Date().toISOString().split('T')[0],
        location: '',
        source: 'upload',
        sourceLabel: 'Uploaded',
        previewUrl: URL.createObjectURL(file),
        relatedFields: [],
      }
      setPhotos(prev => [...prev, newPhoto])
    })
    // Reset the input
    e.target.value = ''
    // Show a prompt for the user to update caption/metadata
    alert(`${fileList.length} photo${fileList.length > 1 ? 's' : ''} added to "${chapterObj?.label}." Edit captions and metadata after import.`)
  }

  const handleUrlImport = () => {
    if (!importUrl.trim() || !importCaption.trim()) return
    const newPhoto: NarrativePhoto = {
      id: `url-${Date.now()}`,
      chapter: importChapter,
      caption: importCaption,
      date: new Date().toISOString().split('T')[0],
      location: '',
      source: 'url',
      sourceLabel: new URL(importUrl).hostname,
      previewUrl: importUrl,
      relatedFields: [],
    }
    setPhotos(prev => [...prev, newPhoto])
    setImportUrl('')
    setImportCaption('')
    setShowUrlImport(false)
  }

  const handleGooglePhotosConnect = () => {
    // In production: create a Picker API session, redirect to pickerUri
    // For now, simulate
    alert('Google Photos Picker integration: In production, this opens the Google Photos picker where you select photos from your library. The selected photos are imported with full metadata (date, location) and assigned to narrative chapters.')
  }

  // ═══ Derived data ═══

  const activeFields = fields.filter(f => f.provenance !== 'removed')
  const confirmedCount = activeFields.filter(f => f.provenance === 'confirmed').length
  const correctedCount = activeFields.filter(f => f.provenance === 'corrected').length
  const selfReportedCount = activeFields.filter(f => f.provenance === 'self_reported').length
  const seededCount = activeFields.filter(f => f.provenance === 'seeded').length

  const sections = [...new Set(activeFields.map(f => f.section))]

  const completeness = Math.min(100, Math.round(
    (activeFields.length * 4 + photos.length * 6 + (confirmedCount + correctedCount) * 2) / 1.5
  ))

  const trustEstimate = Math.min(30, Math.round(
    confirmedCount * 2 + correctedCount * 3 + (photos.length > 0 ? 5 : 0)
  ))

  const chaptersWithPhotos = [...new Set(photos.map(p => p.chapter))]

  // ═══════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col">
      <PublicHeader />

      {/* Hero */}
      <div className="bg-[#1a3a6b] px-8 pt-8 pb-14">
        <div className="max-w-[860px] mx-auto text-center">
          <div className="font-body text-[11px] font-bold tracking-[0.2em] uppercase text-white/40 mb-3">
            Profile Seeder
          </div>
          <h1 className="font-heading font-bold text-white text-[clamp(1.75rem,4vw,2.5rem)] leading-[1.15] mb-3">
            We find you. You take control.
          </h1>
          <p className="font-body text-sm text-white/60 max-w-[580px] mx-auto leading-relaxed">
            Enter your name and a few details. We scrape public sources, assemble a draft profile, and hand it to you to correct, enrich, and own.
          </p>
        </div>
      </div>

      <main className="max-w-[860px] mx-auto px-8 py-8 flex-1 -mt-6 w-full">

        {/* Step progress */}
        <div className="flex items-center gap-1 mb-6 overflow-x-auto">
          {STEPS.map((s, i) => (
            <button
              key={s.key}
              onClick={() => {
                // Only allow going back to completed steps
                if (i <= currentStepIndex) setStep(s.key)
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-[3px] border transition-all cursor-pointer font-body text-[11px] tracking-[0.05em] shrink-0 ${
                s.key === step
                  ? 'bg-[#1a3a6b] text-white border-[#1a3a6b]'
                  : i < currentStepIndex
                  ? 'bg-[#f0fdf4] text-[#166534] border-[#c6e7c6]'
                  : 'bg-white text-[#767676] border-[#d4d4d4]'
              }`}
            >
              <span className="font-bold">{s.num}</span>
              <span className="font-medium hidden sm:inline">{s.label}</span>
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════ */}
        {/* STEP 1: Identify */}
        {/* ═══════════════════════════════════════════ */}
        {step === 'identify' && (
          <div className="card-grace p-8">
            <h2 className="font-heading text-xl font-bold mb-1">Find your public footprint</h2>
            <p className="font-body text-sm text-[#5a5a5a] mb-6 leading-relaxed">
              Enter your name and 2–3 identifying details so we can find you across public sources.
              We search LinkedIn, GitHub, Google Scholar, conference archives, race results, and professional directories.
            </p>

            <div className="space-y-3">
              <div>
                <label className="label-grace text-[#767676] block mb-1">Full name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full px-4 py-3 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#1a3a6b] bg-white"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="label-grace text-[#767676] block mb-1">Employer or university</label>
                  <input
                    type="text"
                    value={employer}
                    onChange={e => setEmployer(e.target.value)}
                    placeholder="Datadog"
                    className="w-full px-4 py-3 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#1a3a6b] bg-white"
                  />
                </div>
                <div>
                  <label className="label-grace text-[#767676] block mb-1">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="Brooklyn, NY"
                    className="w-full px-4 py-3 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#1a3a6b] bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="label-grace text-[#767676] block mb-1">LinkedIn URL <span className="font-normal normal-case tracking-normal">(optional, speeds up matching)</span></label>
                <input
                  type="text"
                  value={linkedinUrl}
                  onChange={e => setLinkedinUrl(e.target.value)}
                  placeholder="linkedin.com/in/janesmith-eng"
                  className="w-full px-4 py-3 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#1a3a6b] bg-white"
                />
              </div>
            </div>

            <div className="mt-4 p-3 bg-[#eef2f8] border-l-[3px] border-[#1a3a6b] rounded-[3px]">
              <p className="font-body text-[13px] text-[#5a5a5a] m-0 leading-relaxed">
                <strong className="text-[#1a3a6b]">Privacy:</strong> We only search publicly accessible sources. No passwords, no private accounts, no financial data. You review everything before it becomes part of your profile.
              </p>
            </div>

            <button
              onClick={handleScrape}
              disabled={!fullName.trim() || scraping}
              className="btn-primary mt-6 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {scraping ? 'Searching public sources...' : 'Find my profile →'}
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* STEP 2: Scraping results */}
        {/* ═══════════════════════════════════════════ */}
        {step === 'results' && (
          <div className="card-grace p-8">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-heading text-xl font-bold">What we found</h2>
              <span className="font-mono text-sm text-[#1a3a6b] font-medium">{fields.length} fields · {photos.length} photos</span>
            </div>
            <p className="font-body text-sm text-[#5a5a5a] mb-6 leading-relaxed">
              Every field shows exactly where it came from. Nothing is published without your approval.
            </p>

            {sections.map(section => (
              <div key={section} className="mb-5">
                <div className="label-grace text-[#767676] mb-2 pb-1 border-b border-[#e8e8e8]">{section}</div>
                {fields.filter(f => f.section === section && f.provenance !== 'removed').map(field => (
                  <div key={field.id} className="flex items-start justify-between py-3 border-b border-[#f0f0f0] last:border-0">
                    <div className="min-w-0 flex-1">
                      <div className="font-body text-[13px] text-[#767676]">{field.label}</div>
                      <div className="font-body text-[14px] font-medium text-[#1a1a1a]">{field.value}</div>
                      <div className="font-body text-[11px] text-[#999] mt-1">
                        <a href={field.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[#1a3a6b] no-underline hover:underline">
                          {field.source}
                        </a>
                      </div>
                    </div>
                    <ProvenanceBadge status={field.provenance} />
                  </div>
                ))}
              </div>
            ))}

            {/* Not found */}
            <div className="mt-6 p-4 bg-[#fafafa] border border-[#e8e8e8] rounded-[3px]">
              <div className="label-grace text-[#999] mb-2">Not found — requires your direct input</div>
              <p className="font-body text-[13px] text-[#999] m-0 leading-relaxed">
                Financial percentiles · Presence Composite · Family &amp; household · Dating profile · Social interests · Advertising profile
              </p>
              <p className="font-body text-[12px] text-[#b0b0b0] m-0 mt-2">
                The seeder never guesses at private data. These sections remain empty until you choose to populate them.
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep('identify')} className="btn-secondary">← Back</button>
              <button onClick={() => setStep('review')} className="btn-primary">Review &amp; correct →</button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* STEP 3: Review & correct */}
        {/* ═══════════════════════════════════════════ */}
        {step === 'review' && (
          <div className="card-grace p-8">
            <h2 className="font-heading text-xl font-bold mb-1">Review &amp; correct</h2>
            <p className="font-body text-sm text-[#5a5a5a] mb-6 leading-relaxed">
              Confirm each field is accurate, correct anything the scraper got wrong, or remove fields entirely. Add information the scraper missed.
            </p>

            {sections.map(section => (
              <div key={section} className="mb-5">
                <div className="label-grace text-[#767676] mb-2 pb-1 border-b border-[#e8e8e8]">{section}</div>
                {fields.filter(f => f.section === section && f.provenance !== 'removed').map(field => (
                  <div key={field.id} className="py-3 border-b border-[#f0f0f0] last:border-0">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="font-body text-[13px] text-[#767676]">{field.label}</div>
                        {field.provenance === 'corrected' ? (
                          <>
                            <div className="font-body text-[14px] text-[#999] line-through">{field.value}</div>
                            <div className="font-body text-[14px] font-medium text-[#1a3a6b]">{field.correctedValue}</div>
                          </>
                        ) : (
                          <div className="font-body text-[14px] font-medium text-[#1a1a1a]">
                            {field.value}
                          </div>
                        )}
                      </div>
                      <ProvenanceBadge status={field.provenance} />
                    </div>

                    {/* Correction edit mode */}
                    {editingField === field.id ? (
                      <div className="mt-3 flex gap-2">
                        <input
                          type="text"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          className="flex-1 px-3 py-2 border border-[#1a3a6b] rounded-[3px] font-body text-sm outline-none bg-white"
                          autoFocus
                        />
                        <button onClick={() => handleSaveCorrection(field.id)} className="btn-primary text-[10px] px-4 py-2">Save</button>
                        <button onClick={() => setEditingField(null)} className="btn-secondary text-[10px] px-4 py-2">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex gap-2 mt-2">
                        {field.provenance === 'seeded' && (
                          <>
                            <button onClick={() => handleConfirmField(field.id)}
                              className="font-body text-[10px] font-bold tracking-[0.08em] uppercase px-3 py-[4px] rounded-[3px] cursor-pointer border"
                              style={{ background: '#f0fdf4', color: '#166534', borderColor: '#c6e7c6' }}>
                              ✓ Confirm
                            </button>
                            <button onClick={() => handleStartCorrection(field.id)}
                              className="font-body text-[10px] font-bold tracking-[0.08em] uppercase px-3 py-[4px] rounded-[3px] cursor-pointer border"
                              style={{ background: '#eef2f8', color: '#1a3a6b', borderColor: '#b8cfe8' }}>
                              ✎ Correct
                            </button>
                            <button onClick={() => handleRemoveField(field.id)}
                              className="font-body text-[10px] font-bold tracking-[0.08em] uppercase px-3 py-[4px] rounded-[3px] cursor-pointer border"
                              style={{ background: '#fef2f2', color: '#991b1b', borderColor: '#f5c4c4' }}>
                              ✕ Remove
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}

            {/* Add new field */}
            <div className="mt-6 p-4 border border-dashed border-[#b8cfe8] rounded-[3px] bg-[#fafcff]">
              {addingField ? (
                <div className="space-y-3">
                  <div className="label-grace text-[#1a3a6b]">Add a field the scraper missed</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <select
                      value={newFieldSection}
                      onChange={e => setNewFieldSection(e.target.value)}
                      className="px-3 py-2 border border-[#d4d4d4] rounded-[3px] font-body text-sm bg-white outline-none"
                    >
                      <option>Skills</option>
                      <option>Identity</option>
                      <option>Interests (intellectual)</option>
                      <option>Interests (athletic)</option>
                      <option>Interests (social)</option>
                    </select>
                    <input
                      type="text" value={newFieldLabel} onChange={e => setNewFieldLabel(e.target.value)}
                      placeholder="Field name" className="px-3 py-2 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none bg-white"
                    />
                    <input
                      type="text" value={newFieldValue} onChange={e => setNewFieldValue(e.target.value)}
                      placeholder="Value" className="px-3 py-2 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none bg-white"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAddField} className="btn-primary text-[10px] px-4 py-2">Add field</button>
                    <button onClick={() => setAddingField(false)} className="btn-secondary text-[10px] px-4 py-2">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddingField(true)}
                  className="font-body text-sm text-[#1a3a6b] cursor-pointer bg-transparent border-none hover:underline">
                  + Add a field the scraper missed
                </button>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep('results')} className="btn-secondary">← Back</button>
              <button onClick={() => setStep('private')} className="btn-primary">Add private sections →</button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* STEP 4: Private sections */}
        {/* ═══════════════════════════════════════════ */}
        {step === 'private' && (
          <div className="card-grace p-8">
            <h2 className="font-heading text-xl font-bold mb-1">Private sections</h2>
            <p className="font-body text-sm text-[#5a5a5a] mb-6 leading-relaxed">
              These sections contain data the scraper never touches. Everything here is optional — add what you want, skip what you don&apos;t.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { icon: '📊', title: 'Financial Percentiles', desc: 'Net worth, income, savings, credit — expressed as age-cohort percentiles. No raw dollar amounts.', color: '#166534', bg: '#f0fdf4' },
                { icon: '✨', title: 'Presence Composite', desc: 'Rizz, Vibe, Drip — scored from photos, peer reviews, and taste signals. Requires photos.', color: '#1a3a6b', bg: '#eef2f8' },
                { icon: '🏠', title: 'Family & Household', desc: 'Family structure, caregiving roles, family intentions. Private tier by default.', color: '#92400e', bg: '#fffbeb' },
                { icon: '💕', title: 'Dating Profile', desc: 'Relationship goals, physical attributes, lifestyle compatibility. Exposed only to dating platforms.', color: '#991b1b', bg: '#fef2f2' },
                { icon: '🎯', title: 'Advertising Profile', desc: 'Life stage signals, consumption categories, professional openness. You approve every signal.', color: '#5b21b6', bg: '#f5f3ff' },
                { icon: '📝', title: 'Content Feed', desc: 'Sovereign publishing channel — essays, analysis, photos, podcasts, video, newsletters.', color: '#0d9488', bg: '#f0fdfa' },
              ].map(section => (
                <div key={section.title} className="p-5 border border-[#d4d4d4] rounded-[3px] bg-white">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{section.icon}</span>
                    <div className="font-body text-sm font-bold" style={{ color: section.color }}>{section.title}</div>
                  </div>
                  <p className="font-body text-[13px] text-[#5a5a5a] leading-relaxed m-0 mb-3">{section.desc}</p>
                  <div className="inline-block px-3 py-[6px] rounded-[3px] font-body text-[10px] font-bold tracking-[0.08em] uppercase cursor-pointer border border-[#d4d4d4] text-[#767676] hover:border-[#1a3a6b] hover:text-[#1a3a6b] transition-colors"
                    style={{ background: section.bg }}>
                    Add {section.title.toLowerCase().split(' ')[0]} data
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 p-3 bg-[#eef2f8] border-l-[3px] border-[#1a3a6b] rounded-[3px]">
              <p className="font-body text-[13px] text-[#5a5a5a] m-0 leading-relaxed">
                <strong className="text-[#1a3a6b]">Skip for now?</strong> You can always add these sections later from your dashboard. Your profile will work without them — it just won&apos;t have financial or lifestyle data for platforms to query.
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep('review')} className="btn-secondary">← Back</button>
              <button onClick={() => setStep('photos')} className="btn-primary">Build visual narrative →</button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* STEP 5: Visual narrative / Photos */}
        {/* ═══════════════════════════════════════════ */}
        {step === 'photos' && (
          <div className="card-grace p-8">
            <h2 className="font-heading text-xl font-bold mb-1">Visual narrative</h2>
            <p className="font-body text-sm text-[#5a5a5a] mb-4 leading-relaxed">
              Photos organized by meaning, not chronology. Each chapter maps to a section of your profile.
              Validators can vouch for individual photos — &ldquo;yes, she gave that keynote.&rdquo;
            </p>

            {/* Photo source buttons */}
            <div className="flex flex-wrap gap-2 mb-6 p-4 bg-[#fafafa] border border-[#e8e8e8] rounded-[3px]">
              <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] w-full mb-2">
                Import photos from
              </div>
              <button onClick={handleGooglePhotosConnect}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-[#d4d4d4] rounded-[3px] font-body text-[12px] font-medium text-[#1a1a1a] cursor-pointer hover:border-[#1a3a6b] transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24"><path d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z" fill="#4285f4"/></svg>
                Google Photos
              </button>
              <label className="flex items-center gap-2 px-4 py-2 bg-white border border-[#d4d4d4] rounded-[3px] font-body text-[12px] font-medium text-[#1a1a1a] cursor-pointer hover:border-[#1a3a6b] transition-colors">
                <span>📁</span> Upload from device
                <input type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => {
                    // Default to intellectual chapter — user can reassign
                    handleFileUpload(e, 'intellectual')
                  }}
                />
              </label>
              <button onClick={() => setShowUrlImport(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-[#d4d4d4] rounded-[3px] font-body text-[12px] font-medium text-[#1a1a1a] cursor-pointer hover:border-[#1a3a6b] transition-colors">
                <span>🔗</span> Import from URL
              </button>
            </div>

            {/* URL import form */}
            {showUrlImport && (
              <div className="mb-6 p-4 border border-[#1a3a6b] rounded-[3px] bg-[#fafcff]">
                <div className="label-grace text-[#1a3a6b] mb-3">Import photo from URL</div>
                <div className="space-y-2">
                  <input type="url" value={importUrl} onChange={e => setImportUrl(e.target.value)}
                    placeholder="https://pycon.org/speakers/janesmith.jpg"
                    className="w-full px-3 py-2 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#1a3a6b] bg-white" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input type="text" value={importCaption} onChange={e => setImportCaption(e.target.value)}
                      placeholder="Caption (e.g., Keynote at PyCon 2024)"
                      className="px-3 py-2 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#1a3a6b] bg-white" />
                    <select value={importChapter} onChange={e => setImportChapter(e.target.value as NarrativeChapter)}
                      className="px-3 py-2 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none bg-white">
                      {CHAPTERS.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleUrlImport} className="btn-primary text-[10px] px-4 py-2">Import</button>
                    <button onClick={() => setShowUrlImport(false)} className="btn-secondary text-[10px] px-4 py-2">Cancel</button>
                  </div>
                </div>
              </div>
            )}

            {/* Chapter grids */}
            {CHAPTERS.map(chapter => {
              const chapterPhotos = photos.filter(p => p.chapter === chapter.key)
              return (
                <div key={chapter.key} className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{chapter.icon}</span>
                      <span className="label-grace text-[#1a1a1a]">{chapter.label}</span>
                      <span className="font-mono text-[11px] text-[#767676]">{chapterPhotos.length}</span>
                    </div>
                    <label className="font-body text-[11px] text-[#1a3a6b] cursor-pointer hover:underline">
                      + Add
                      <input type="file" accept="image/*" multiple className="hidden"
                        onChange={(e) => handleFileUpload(e, chapter.key)} />
                    </label>
                  </div>
                  {chapterPhotos.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {chapterPhotos.map(photo => (
                        <PhotoCard key={photo.id} photo={photo} onRemove={handleRemovePhoto} />
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 border border-dashed border-[#d4d4d4] rounded-[3px] text-center">
                      <p className="font-body text-[13px] text-[#999] m-0">{chapter.description}</p>
                      <label className="inline-block mt-2 font-body text-[12px] text-[#1a3a6b] cursor-pointer hover:underline">
                        Upload photos
                        <input type="file" accept="image/*" multiple className="hidden"
                          onChange={(e) => handleFileUpload(e, chapter.key)} />
                      </label>
                    </div>
                  )}
                </div>
              )
            })}

            <div className="mt-4 p-3 bg-[#f0fdf4] border-l-[3px] border-[#166534] rounded-[3px]">
              <p className="font-body text-[13px] text-[#166534] m-0 leading-relaxed">
                <strong>Your photos never touch Search Star servers.</strong> Selected photos are hosted by you on your own infrastructure and referenced by URL in your profile JSON-LD. Search Star stores only the URL and the hash.
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep('private')} className="btn-secondary">← Back</button>
              <button onClick={() => setStep('publish')} className="btn-primary">Set pricing &amp; publish →</button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* STEP 6: Publish */}
        {/* ═══════════════════════════════════════════ */}
        {step === 'publish' && (
          <div className="card-grace p-8">
            <h2 className="font-heading text-xl font-bold mb-1">Review &amp; publish</h2>
            <p className="font-body text-sm text-[#5a5a5a] mb-6 leading-relaxed">
              Set your per-query pricing, review your profile summary, and download the files to host.
            </p>

            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="p-3 bg-[#fafafa] rounded-[3px]">
                <div className="font-body text-[11px] text-[#767676] font-bold tracking-[0.08em] uppercase">Fields</div>
                <div className="font-mono text-xl font-medium text-[#1a1a1a] mt-1">{activeFields.length}</div>
              </div>
              <div className="p-3 bg-[#fafafa] rounded-[3px]">
                <div className="font-body text-[11px] text-[#767676] font-bold tracking-[0.08em] uppercase">Photos</div>
                <div className="font-mono text-xl font-medium text-[#1a1a1a] mt-1">{photos.length}</div>
              </div>
              <div className="p-3 bg-[#fafafa] rounded-[3px]">
                <div className="font-body text-[11px] text-[#767676] font-bold tracking-[0.08em] uppercase">Chapters</div>
                <div className="font-mono text-xl font-medium text-[#1a1a1a] mt-1">{chaptersWithPhotos.length}/6</div>
              </div>
              <div className="p-3 bg-[#fafafa] rounded-[3px]">
                <div className="font-body text-[11px] text-[#767676] font-bold tracking-[0.08em] uppercase">Completeness</div>
                <div className="font-mono text-xl font-medium text-[#1a1a1a] mt-1">{completeness}%</div>
              </div>
            </div>

            {/* Provenance breakdown */}
            <div className="mb-6">
              <div className="label-grace text-[#767676] mb-2">Provenance breakdown</div>
              <div className="flex flex-wrap gap-3">
                {confirmedCount > 0 && <span className="font-body text-[12px]"><ProvenanceBadge status="confirmed" /> {confirmedCount} fields</span>}
                {correctedCount > 0 && <span className="font-body text-[12px]"><ProvenanceBadge status="corrected" /> {correctedCount} fields</span>}
                {selfReportedCount > 0 && <span className="font-body text-[12px]"><ProvenanceBadge status="self_reported" /> {selfReportedCount} fields</span>}
                {seededCount > 0 && <span className="font-body text-[12px]"><ProvenanceBadge status="seeded" /> {seededCount} unreviewed</span>}
              </div>
            </div>

            {/* Trust estimate */}
            <div className="mb-6">
              <div className="label-grace text-[#767676] mb-2">Estimated trust score at launch</div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-2xl font-medium text-[#1a1a1a]">{trustEstimate}</span>
                <span className="font-body text-[13px] text-[#767676]">/ 100 — rises as validators stake money on your claims</span>
              </div>
              <div className="h-[6px] bg-[#e8e8e8] rounded-full mt-2 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${trustEstimate}%`, background: trustEstimate < 20 ? '#92400e' : trustEstimate < 50 ? '#b45309' : '#166534' }}
                />
              </div>
            </div>

            {/* Pricing */}
            <div className="mb-6">
              <div className="label-grace text-[#767676] mb-3">Set your per-query pricing</div>
              <div className="space-y-3">
                <div className="flex items-center gap-4 p-4 bg-[#eef2f8] rounded-[3px]">
                  <div className="flex-1">
                    <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#1a3a6b]">Public Tier</div>
                    <div className="font-body text-[12px] text-[#767676]">Identity, skills, interests, headline scores</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-sm text-[#767676]">$</span>
                    <input type="number" step="0.01" min="0.01" value={publicPrice} onChange={e => setPublicPrice(e.target.value)}
                      className="w-24 px-3 py-2 border border-[#d4d4d4] rounded-[3px] font-mono text-sm outline-none focus:border-[#1a3a6b] bg-white" />
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-[#f5f5f5] rounded-[3px]">
                  <div className="flex-1">
                    <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#1a1a1a]">Private Tier</div>
                    <div className="font-body text-[12px] text-[#767676]">Full profile — financials, Presence breakdown, all data</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-sm text-[#767676]">$</span>
                    <input type="number" step="0.01" min="0.01" value={privatePrice} onChange={e => setPrivatePrice(e.target.value)}
                      className="w-24 px-3 py-2 border border-[#d4d4d4] rounded-[3px] font-mono text-sm outline-none focus:border-[#1a3a6b] bg-white" />
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-[#fffbeb] rounded-[3px]">
                  <div className="flex-1">
                    <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#92400e]">Marketing Tier</div>
                    <div className="font-body text-[12px] text-[#767676]">Pay to message you directly. No refunds.</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-sm text-[#767676]">$</span>
                    <input type="number" step="0.01" min="0.01" value={marketingPrice} onChange={e => setMarketingPrice(e.target.value)}
                      className="w-24 px-3 py-2 border border-[#d4d4d4] rounded-[3px] font-mono text-sm outline-none focus:border-[#1a3a6b] bg-white" />
                  </div>
                </div>
              </div>
              <div className="mt-3 p-3 bg-[#f0fdf4] border-l-[3px] border-[#166534] rounded-[3px]">
                <p className="font-body text-[13px] text-[#166534] m-0">
                  <strong>Revenue split:</strong> You keep 90% of every query and message. Search Star takes 10%.
                </p>
              </div>
            </div>

            {/* Output files */}
            <div className="mb-6">
              <div className="label-grace text-[#767676] mb-3">Output files</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 border border-[#d4d4d4] rounded-[3px] bg-white">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm font-medium text-[#1a3a6b]">profile.json</span>
                  </div>
                  <p className="font-body text-[12px] text-[#767676] m-0">JSON-LD with per-field provenance tags, photo metadata with narrative chapters, access policy, and pricing.</p>
                </div>
                <div className="p-4 border border-[#d4d4d4] rounded-[3px] bg-white">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm font-medium text-[#1a3a6b]">index.html</span>
                  </div>
                  <p className="font-body text-[12px] text-[#767676] m-0">Graceland design system, visual narrative gallery, score visualizations, &ldquo;Contact via Search Star&rdquo; button.</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep('photos')} className="btn-secondary">← Back</button>
              <button className="btn-primary flex-1">
                Download files &amp; register with Search Star →
              </button>
            </div>
          </div>
        )}

      </main>

      <PublicFooter />
    </div>
  )
}
