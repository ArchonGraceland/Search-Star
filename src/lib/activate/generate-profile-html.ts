// ═══════════════════════════════════════════════════
// generate-profile-html.ts
// Generates a standalone HTML profile page using
// the Graceland design system with visibility modes,
// narrative gallery, and presence score visualization
// Schema v1.3
// ═══════════════════════════════════════════════════

/* eslint-disable @typescript-eslint/no-explicit-any */

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function provBadge(status: string): string {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    confirmed:     { bg: '#f0fdf4', fg: '#166534', label: 'Confirmed' },
    corrected:     { bg: '#eef2f8', fg: '#1a3a6b', label: 'Corrected' },
    self_reported: { bg: '#fffbeb', fg: '#92400e', label: 'Self-reported' },
    seeded:        { bg: '#f5f5f5', fg: '#767676', label: 'Unreviewed' },
    validated:     { bg: '#f0fdf4', fg: '#166534', label: 'Validated' },
  }
  const c = map[status] || map.seeded
  return `<span class="prov-badge" style="background:${c.bg};color:${c.fg};">${c.label}</span>`
}

const CHAPTER_META: Record<string, { icon: string; label: string; color: string }> = {
  intellectual:  { icon: '📚', label: 'Intellectual Life',  color: '#1a3a6b' },
  social:        { icon: '🤝', label: 'Social Life',        color: '#0d9488' },
  athletic:      { icon: '🏃', label: 'Athletic Life',      color: '#991b1b' },
  professional:  { icon: '💼', label: 'Professional Life',  color: '#b8860b' },
  aesthetic:     { icon: '✨', label: 'Aesthetic Identity',  color: '#7c3aed' },
  family:        { icon: '🏠', label: 'Family Life',        color: '#64748b' },
}

function renderFieldRow(label: string, value: string, prov: string): string {
  return `
    <div class="field-row">
      <div class="field-label">${esc(label)}</div>
      <div class="field-prov">${provBadge(prov)}</div>
      <div class="field-value">${esc(value)}</div>
    </div>`
}

function renderPhotoCard(photo: any): string {
  const caption = esc(photo.narrative?.caption || photo.label || photo.caption || '')
  const date = esc(photo.narrative?.date || photo.date || '')
  const location = esc(photo.narrative?.location || photo.location || '')
  const chapter = photo.narrative?.chapter || photo.chapter || ''
  const chapterMeta = CHAPTER_META[chapter]
  const tier = photo.accessTier || 'private'
  const tierLabel = tier === 'public' ? '🌐 Public' : tier === 'marketing' ? '📨 Marketing' : '🔐 Private'
  const url = photo.url || ''
  const hasImage = url && !url.startsWith('photos/')
  return `
    <div class="photo-card" data-visibility="${tier === 'public' ? 'summary' : 'full'}">
      <div class="photo-img" style="background:linear-gradient(145deg, ${chapterMeta?.color || '#1a3a6b'}, ${chapterMeta?.color || '#1a3a6b'}cc);">
        ${hasImage
          ? `<img src="${esc(url)}" alt="${caption}" loading="lazy" />`
          : `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg" class="photo-placeholder"><rect width="120" height="160" rx="4" fill="rgba(255,255,255,0.1)"/><circle cx="60" cy="55" r="18" fill="rgba(255,255,255,0.15)"/><path d="M60,73 C42,73 30,90 30,115 L90,115 C90,90 78,73 60,73Z" fill="rgba(255,255,255,0.1)"/></svg>`
        }
        <span class="photo-chapter-tag">${chapterMeta?.icon || '📷'} ${esc(chapterMeta?.label || chapter)}</span>
        <span class="photo-tier-tag">${tierLabel}</span>
      </div>
      <div class="photo-meta">
        <div class="photo-caption">${caption}</div>
        <div class="photo-date">${date}${location ? ` · ${location}` : ''}</div>
      </div>
    </div>`
}

function renderTierCard(name: string, icon: string, price: string, unit: string, desc: string, featured: boolean): string {
  return `
    <div class="tier-card${featured ? ' tier-featured' : ''}">
      <div class="tier-head">
        <span class="tier-icon">${icon}</span>
        <span class="tier-name">${esc(name)}</span>
      </div>
      <div class="tier-desc">${esc(desc)}</div>
      <div class="tier-price">
        <span class="tier-dollar">$</span>
        <span class="tier-amount">${esc(price)}</span>
      </div>
      <div class="tier-unit">${esc(unit)}</div>
    </div>`
}

export function generateProfileHtml(profile: any): string {
  const identity = profile.identity || {}
  const displayName = esc(identity.displayName || 'Profile')
  const handle = esc(identity.handle || '')
  const tagline = esc(identity.tagline || '')
  const location = esc(identity.location || '')
  const currentTitle = esc(identity.currentTitle || '')
  const updated = profile.updated ? new Date(profile.updated).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : ''

  const skills = profile.skills || []
  const interests = profile.interests || {}
  const professional = profile.professional || []
  const media = profile.media || []
  const accessPolicy = profile.accessPolicy?.tiers || {}
  const meta = profile._meta || {}
  const narrativeChapters = profile.narrativeChapters || {}

  const chapterOrder = ['intellectual', 'social', 'athletic', 'professional', 'aesthetic', 'family']

  // Provenance summary counts
  const provBreakdown = meta.provenanceBreakdown || {}
  const provItems = Object.entries(provBreakdown)
    .filter(([, count]) => (count as number) > 0)
    .map(([status, count]) => `${provBadge(status)} <span class="prov-count">${count}</span>`)
    .join('')

  // Presence score visualization (radar-style placeholder)
  const totalPhotos = meta.totalPhotos || 0
  const totalFields = meta.totalFields || 0
  const chaptersPopulated = chapterOrder.filter(ch => (narrativeChapters[ch] || 0) > 0).length

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${displayName} — Search Star Profile</title>
<!--
  CACHE HEADER GUIDANCE
  =====================
  When self-hosting this profile, set the following HTTP headers:
    Cache-Control: public, max-age=3600, s-maxage=86400
    ETag: [generate from profile.json hash]
    Vary: Accept-Encoding
  For CDN deployment (Cloudflare, Vercel, Netlify):
    Cache-Control: public, max-age=300, s-maxage=86400, stale-while-revalidate=86400
  Photos should use immutable caching:
    Cache-Control: public, max-age=31536000, immutable
-->
<link href="https://fonts.googleapis.com/css2?family=Crimson+Text:wght@400;600;700&family=Roboto:wght@400;500;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  :root {
    --ink: #1a1a1a;
    --paper: #f5f5f5;
    --cream: #eef2f8;
    --navy: #1a3a6b;
    --navy-dk: #112a4f;
    --crimson: #991b1b;
    --teal: #0d9488;
    --gold: #b8860b;
    --green: #166534;
    --green-lt: #f0fdf4;
    --gold-lt: #fffbeb;
    --muted: #767676;
    --border: #d4d4d4;
    --white: #ffffff;
    --radius: 3px;
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Crimson Text', Georgia, serif;
    background: var(--paper);
    color: var(--ink);
    line-height: 1.6;
    font-size: 18px;
    -webkit-font-smoothing: antialiased;
  }

  /* ── Top Bar ── */
  .topbar {
    display:flex; align-items:center; justify-content:space-between;
    padding:16px 40px;
    border-bottom:3px solid var(--navy-dk);
    background:var(--navy);
    position:sticky; top:0; z-index:100;
  }
  .topbar-logo {
    font-family:'Crimson Text',Georgia,serif;
    font-size:20px; font-weight:700; letter-spacing:-0.3px;
    display:flex; align-items:center; gap:10px;
    color:var(--white); text-decoration:none;
  }
  .topbar-controls {
    display:flex; gap:8px; align-items:center;
  }
  .vis-btn {
    font-family:'Roboto',sans-serif; font-size:11px; font-weight:700;
    letter-spacing:0.08em; text-transform:uppercase;
    padding:6px 14px; border-radius:var(--radius);
    border:1px solid rgba(255,255,255,0.3);
    background:transparent; color:rgba(255,255,255,0.8);
    cursor:pointer; transition:all 0.2s;
  }
  .vis-btn:hover { background:rgba(255,255,255,0.1); }
  .vis-btn.active {
    background:var(--white); color:var(--navy); border-color:var(--white);
  }

  /* ── Layout ── */
  .page { max-width:1200px; margin:0 auto; padding:40px; }
  .section { margin-bottom:48px; }
  .section-header {
    display:flex; align-items:center; justify-content:space-between;
    margin-bottom:20px; padding-bottom:12px;
    border-bottom:2px solid #e8e8e8;
  }
  .section-header h2 {
    font-family:'Crimson Text',Georgia,serif;
    font-size:24px; font-weight:700;
  }
  .tier-badge {
    font-family:'Roboto',sans-serif; font-size:10px; font-weight:700;
    letter-spacing:0.1em; text-transform:uppercase;
    padding:4px 12px; border-radius:var(--radius);
  }
  .tier-public { background:var(--cream); color:var(--navy); }
  .tier-private { background:var(--green-lt); color:var(--green); }

  /* ── Fields ── */
  .field-row {
    display:grid; grid-template-columns:180px 120px 1fr;
    gap:12px; align-items:center;
    padding:10px 0; border-bottom:1px solid #e8e8e8;
  }
  .field-label {
    font-family:'Crimson Text',Georgia,serif;
    font-size:16px; font-weight:600;
  }
  .field-value {
    font-family:'Roboto',sans-serif;
    font-size:13px; color:var(--muted);
  }
  .prov-badge {
    font-family:'Roboto',sans-serif; font-size:10px; font-weight:700;
    padding:2px 8px; border-radius:var(--radius);
    text-transform:uppercase; letter-spacing:0.08em;
    display:inline-block;
  }
  .prov-count {
    font-family:'Roboto',sans-serif; font-size:12px;
    margin-left:2px;
  }

  /* ── Photo Gallery ── */
  .chapter-section { margin-bottom:36px; }
  .chapter-header {
    display:flex; align-items:center; gap:10px;
    margin-bottom:16px; padding-bottom:8px;
    border-bottom:2px solid #e8e8e8;
  }
  .chapter-icon { font-size:20px; }
  .chapter-label {
    font-family:'Crimson Text',Georgia,serif;
    font-size:20px; font-weight:700;
  }
  .chapter-count {
    font-family:'JetBrains Mono',monospace;
    font-size:11px; color:var(--muted);
    margin-left:auto;
  }
  .photo-grid {
    display:grid; grid-template-columns:repeat(3, 1fr); gap:16px;
  }
  .photo-card {
    border:1px solid var(--border); border-radius:6px;
    overflow:hidden; background:var(--white);
    transition:box-shadow 0.2s;
  }
  .photo-card:hover { box-shadow:var(--shadow-md); }
  .photo-img {
    height:200px; display:flex; align-items:center; justify-content:center;
    position:relative; overflow:hidden;
  }
  .photo-img img { width:100%; height:100%; object-fit:cover; }
  .photo-placeholder { width:60px; opacity:0.4; }
  .photo-chapter-tag {
    position:absolute; top:8px; left:8px;
    font-family:'Roboto',sans-serif; font-size:9px; font-weight:700;
    letter-spacing:0.1em; text-transform:uppercase;
    padding:3px 8px; border-radius:var(--radius);
    background:rgba(0,0,0,0.5); color:#fff;
  }
  .photo-tier-tag {
    position:absolute; top:8px; right:8px;
    font-family:'Roboto',sans-serif; font-size:9px; font-weight:700;
    padding:3px 8px; border-radius:var(--radius);
    background:rgba(255,255,255,0.85); color:var(--ink);
  }
  .photo-meta { padding:12px 14px; }
  .photo-caption {
    font-family:'Crimson Text',Georgia,serif;
    font-size:14px; font-weight:600; margin-bottom:4px;
  }
  .photo-date {
    font-family:'Roboto',sans-serif;
    font-size:11px; color:var(--muted);
  }

  /* ── Presence Score ── */
  .presence-grid {
    display:grid; grid-template-columns:repeat(6, 1fr); gap:12px;
    margin-bottom:20px;
  }
  .presence-cell {
    text-align:center; padding:16px 8px;
    background:var(--cream); border-radius:var(--radius);
    border:1px solid var(--border);
  }
  .presence-cell-icon { font-size:24px; margin-bottom:6px; }
  .presence-cell-label {
    font-family:'Roboto',sans-serif; font-size:10px; font-weight:700;
    text-transform:uppercase; letter-spacing:0.08em; color:var(--muted);
    margin-bottom:4px;
  }
  .presence-cell-count {
    font-family:'JetBrains Mono',monospace;
    font-size:24px; font-weight:700;
  }
  .presence-cell-bar {
    height:4px; border-radius:2px; background:#e8e8e8;
    margin-top:8px; overflow:hidden;
  }
  .presence-cell-fill {
    height:100%; border-radius:2px;
    transition:width 0.3s;
  }

  /* ── Tier Cards ── */
  .tiers-row { display:flex; gap:20px; margin-bottom:32px; }
  .tier-card {
    border:1px solid var(--border); border-radius:6px;
    padding:28px; background:var(--white); flex:1;
  }
  .tier-featured { border:2px solid var(--navy); }
  .tier-head { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
  .tier-icon { font-size:20px; }
  .tier-name { font-family:'Crimson Text',Georgia,serif; font-size:22px; }
  .tier-desc {
    font-family:'Roboto',sans-serif; font-size:12px;
    color:var(--muted); margin-bottom:16px; line-height:1.5;
  }
  .tier-price { display:flex; align-items:baseline; gap:4px; }
  .tier-dollar {
    font-family:'JetBrains Mono',monospace;
    font-size:11px; color:var(--muted);
  }
  .tier-amount {
    font-family:'JetBrains Mono',monospace;
    font-size:28px; font-weight:700;
  }
  .tier-unit {
    font-family:'Roboto',sans-serif;
    font-size:12px; color:var(--muted);
  }

  /* ── CTA ── */
  .cta-btn {
    display:inline-flex; align-items:center; gap:8px;
    font-family:'Roboto',sans-serif; font-size:12px; font-weight:700;
    letter-spacing:0.1em; text-transform:uppercase;
    padding:14px 32px;
    background:var(--navy); color:var(--white);
    border:none; border-radius:var(--radius);
    cursor:pointer; text-decoration:none;
    transition:background 0.2s;
  }
  .cta-btn:hover { background:var(--navy-dk); }

  /* ── Footer ── */
  .footer {
    text-align:center; padding:32px 40px;
    border-top:1px solid #e8e8e8;
    font-family:'Roboto',sans-serif; font-size:12px; color:var(--muted);
  }
  .footer a { color:var(--navy); text-decoration:none; font-weight:700; }
  .footer a:hover { text-decoration:underline; }

  /* ── Visibility Mode ── */
  body.mode-summary [data-visibility="full"] { display:none !important; }

  /* ── Responsive ── */
  @media (max-width:768px) {
    .page { padding:20px; }
    .topbar { padding:12px 20px; }
    .profile-header { grid-template-columns:1fr !important; gap:20px !important; }
    .avatar { width:120px !important; height:144px !important; }
    .tiers-row { flex-direction:column; }
    .photo-grid { grid-template-columns:repeat(2, 1fr) !important; }
    .field-row { grid-template-columns:1fr; gap:4px; }
    .presence-grid { grid-template-columns:repeat(3, 1fr); }
  }
</style>
</head>
<body class="mode-full">

<!-- ═══ TOP BAR ═══ -->
<div class="topbar">
  <a href="https://www.searchstar.com" class="topbar-logo">
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" style="width:28px;height:28px;">
      <circle cx="32" cy="32" r="30" fill="#fff" opacity="0.15"/>
      <polygon points="32,6 36,24 32,20 28,24" fill="#fff"/>
      <polygon points="32,6 36,24 32,28 28,24" fill="#fff" opacity="0.6"/>
      <polygon points="58,32 40,28 44,32 40,36" fill="#fff" opacity="0.6"/>
      <polygon points="32,58 28,40 32,44 36,40" fill="#fff" opacity="0.6"/>
      <polygon points="6,32 24,36 20,32 24,28" fill="#fff" opacity="0.6"/>
      <circle cx="32" cy="32" r="3" fill="#fff"/>
    </svg>
    Search Star
  </a>
  <div class="topbar-controls">
    <button class="vis-btn active" onclick="setMode('full')" id="btn-full">Full Profile</button>
    <button class="vis-btn" onclick="setMode('summary')" id="btn-summary">Summary</button>
  </div>
</div>

<div class="page">

  <!-- ═══ PROFILE HEADER ═══ -->
  <div class="profile-header" style="display:grid; grid-template-columns:200px 1fr; gap:40px; margin-bottom:48px; align-items:start;">
    <div style="position:relative;">
      <div class="avatar" style="width:200px; height:240px; border-radius:var(--radius); background:linear-gradient(145deg, #1a3a6b, #2a5a8f); display:flex; align-items:center; justify-content:center; border:1px solid var(--border); overflow:hidden;">
        <svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;opacity:0.7;">
          <ellipse cx="100" cy="78" rx="32" ry="36" fill="rgba(255,255,255,0.2)"/>
          <path d="M100,114 C60,114 35,150 35,200 L165,200 C165,150 140,114 100,114Z" fill="rgba(255,255,255,0.12)"/>
        </svg>
      </div>
    </div>
    <div>
      <div style="font-family:'JetBrains Mono',monospace; font-size:12px; font-weight:500; color:#b8b8b8; margin-bottom:4px;">Pending registration</div>
      <h1 style="font-family:'Crimson Text',Georgia,serif; font-size:42px; font-weight:700; line-height:1.1; letter-spacing:-0.5px; margin-bottom:4px;">${displayName}</h1>
      <div style="font-family:'JetBrains Mono',monospace; font-size:13px; color:var(--muted); margin-bottom:16px;">searchstar://${esc(handle.replace('@', ''))}</div>
      ${tagline ? `<p style="font-family:'Crimson Text',Georgia,serif; font-size:18px; color:#5a5a5a; max-width:500px; margin-bottom:20px; line-height:1.5;">${tagline}</p>` : ''}
      ${currentTitle ? `<p style="font-family:'Roboto',sans-serif; font-size:14px; color:#5a5a5a; margin-bottom:16px;">${currentTitle}</p>` : ''}
      <div style="display:flex; gap:12px; flex-wrap:wrap;">
        ${location ? `<span style="display:flex; align-items:center; gap:6px; font-family:'Roboto',sans-serif; font-size:11px; font-weight:500; padding:5px 12px; border-radius:var(--radius); border:1px solid var(--border); background:var(--white);">📍 ${location}</span>` : ''}
        <span style="display:flex; align-items:center; gap:6px; font-family:'Roboto',sans-serif; font-size:11px; font-weight:500; padding:5px 12px; border-radius:var(--radius); border:1px solid var(--border); background:var(--white);">⏱ ${updated}</span>
        <span style="display:flex; align-items:center; gap:6px; font-family:'Roboto',sans-serif; font-size:11px; font-weight:500; padding:5px 12px; border-radius:var(--radius); border:1px solid var(--border); background:var(--gold-lt);">⚡ Activated profile</span>
      </div>
    </div>
  </div>

  <!-- ═══ PROVENANCE SUMMARY ═══ -->
  <div style="margin-bottom:32px; padding:16px 20px; background:var(--cream); border-radius:var(--radius); border-left:3px solid var(--navy);">
    <div style="font-family:'Roboto',sans-serif; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:var(--muted); margin-bottom:8px;">Provenance Summary</div>
    <div style="display:flex; gap:16px; flex-wrap:wrap; align-items:center;">
      ${provItems}
    </div>
    <div style="font-family:'Roboto',sans-serif; font-size:12px; color:var(--muted); margin-top:8px;">
      Every field on this profile shows exactly where it came from. Trust score rises as validators stake money on individual claims.
    </div>
  </div>

  <!-- ═══ IDENTITY ═══ -->
  <div class="section">
    <div class="section-header">
      <h2>Identity</h2>
      <span class="tier-badge tier-public">Public Tier</span>
    </div>
    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:12px;">
      ${[
        { l: 'Name', v: identity.displayName || '' },
        { l: 'Title', v: identity.currentTitle || '' },
        { l: 'Location', v: identity.location || '' },
        { l: 'Handle', v: identity.handle || '' },
      ].filter(x => x.v).map(x => `
        <div style="padding:14px 16px; border:1px solid var(--border); border-radius:var(--radius); background:var(--white);">
          <div style="font-family:'Roboto',sans-serif; font-size:10px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:var(--muted); margin-bottom:4px;">${esc(x.l)}</div>
          <div style="font-family:'Crimson Text',Georgia,serif; font-size:17px;">${esc(x.v)}</div>
        </div>`).join('')}
    </div>
  </div>

  <!-- ═══ SKILLS ═══ -->
  ${skills.length > 0 ? `
  <div class="section">
    <div class="section-header">
      <h2>Skills &amp; Credentials</h2>
      <span class="tier-badge tier-public">Public Tier</span>
    </div>
    ${skills.map((s: any) => renderFieldRow(s.name || '', s.detail || '', s.provenance?.status || 'seeded')).join('')}
  </div>` : ''}

  <!-- ═══ INTERESTS ═══ -->
  ${(interests.athletic?.length > 0 || interests.social?.length > 0 || interests.intellectual?.length > 0) ? `
  <div class="section">
    <div class="section-header">
      <h2>Interests</h2>
      <span class="tier-badge tier-public">Public Tier</span>
    </div>
    ${['athletic', 'social', 'intellectual'].map(cat => {
      const items = interests[cat] || []
      if (items.length === 0) return ''
      const icons: Record<string, string> = { athletic: '🏃', social: '🤝', intellectual: '📚' }
      return `
        <div style="margin-bottom:24px;">
          <div style="font-family:'Roboto',sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:var(--muted); margin-bottom:10px;">${icons[cat] || ''} ${esc(cat.charAt(0).toUpperCase() + cat.slice(1))}</div>
          ${items.map((i: any) => renderFieldRow(i.name || '', i.detail || '', i.provenance?.status || 'seeded')).join('')}
        </div>`
    }).join('')}
  </div>` : ''}

  <!-- ═══ PROFESSIONAL ═══ -->
  ${professional.length > 0 ? `
  <div class="section" data-visibility="full">
    <div class="section-header">
      <h2>Professional History</h2>
      <span class="tier-badge tier-public">Public Tier</span>
    </div>
    ${professional.map((p: any) => renderFieldRow(p.label || '', p.detail || '', p.provenance?.status || 'seeded')).join('')}
  </div>` : ''}

  <!-- ═══ PRESENCE COMPOSITE ═══ -->
  <div class="section">
    <div class="section-header">
      <h2>Presence Composite</h2>
      <span class="tier-badge tier-private">Private Tier</span>
    </div>
    <div class="presence-grid">
      ${chapterOrder.map(ch => {
        const m = CHAPTER_META[ch]
        const count = narrativeChapters[ch] || 0
        const maxPhotos = 10
        const pct = Math.min(100, Math.round((count / maxPhotos) * 100))
        return `
          <div class="presence-cell">
            <div class="presence-cell-icon">${m.icon}</div>
            <div class="presence-cell-label">${esc(m.label.split(' ')[0])}</div>
            <div class="presence-cell-count" style="color:${m.color};">${count}</div>
            <div class="presence-cell-bar">
              <div class="presence-cell-fill" style="width:${pct}%; background:${m.color};"></div>
            </div>
          </div>`
      }).join('')}
    </div>
    <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:16px; margin-bottom:20px;">
      <div style="padding:20px; background:var(--cream); border-radius:var(--radius); text-align:center;">
        <div style="font-family:'JetBrains Mono',monospace; font-size:32px; font-weight:700; color:var(--navy);">${totalFields}</div>
        <div style="font-family:'Roboto',sans-serif; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:var(--muted);">Data Fields</div>
      </div>
      <div style="padding:20px; background:var(--cream); border-radius:var(--radius); text-align:center;">
        <div style="font-family:'JetBrains Mono',monospace; font-size:32px; font-weight:700; color:var(--teal);">${totalPhotos}</div>
        <div style="font-family:'Roboto',sans-serif; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:var(--muted);">Photos</div>
      </div>
      <div style="padding:20px; background:var(--cream); border-radius:var(--radius); text-align:center;">
        <div style="font-family:'JetBrains Mono',monospace; font-size:32px; font-weight:700; color:var(--gold);">${chaptersPopulated}/6</div>
        <div style="font-family:'Roboto',sans-serif; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:var(--muted);">Chapters</div>
      </div>
    </div>
    <div style="padding:16px; background:var(--cream); border-radius:var(--radius); font-family:'Roboto',sans-serif; font-size:13px; color:var(--muted); text-align:center;">
      Presence Composite (Rizz, Vibe, Drip) requires explicit participation and photo scoring.<br/>
      This section populates as the profile owner completes the assessment flow.
    </div>
  </div>

  <!-- ═══ VISUAL NARRATIVE GALLERY ═══ -->
  ${media.length > 0 ? `
  <div class="section" data-visibility="full">
    <div class="section-header">
      <h2>Visual Narrative</h2>
      <span class="tier-badge tier-private">Private Tier</span>
    </div>
    <p style="font-family:'Roboto',sans-serif; font-size:14px; color:var(--muted); margin-bottom:24px; line-height:1.6;">
      Photos organized by life chapter. Validators can vouch for individual photos — confirming moments, events, and context.
    </p>
    ${chapterOrder.map(ch => {
      const chapterPhotos = media.filter((p: any) => (p.narrative?.chapter || p.chapter) === ch)
      if (chapterPhotos.length === 0) return ''
      const m = CHAPTER_META[ch]
      return `
        <div class="chapter-section">
          <div class="chapter-header">
            <span class="chapter-icon">${m.icon}</span>
            <span class="chapter-label">${esc(m.label)}</span>
            <span class="chapter-count">${chapterPhotos.length} photo${chapterPhotos.length !== 1 ? 's' : ''}</span>
          </div>
          <div class="photo-grid">
            ${chapterPhotos.map((p: any) => renderPhotoCard(p)).join('')}
          </div>
        </div>`
    }).join('')}
  </div>` : ''}

  <!-- ═══ ACCESS & PRICING ═══ -->
  <div class="section">
    <div class="section-header">
      <h2>Access &amp; Pricing</h2>
    </div>
    <p style="font-family:'Roboto',sans-serif; font-size:14px; color:var(--muted); margin-bottom:24px; line-height:1.6;">
      Three tiers. Public is your storefront. Private is the full picture. Marketing is your inbox — anyone can message you, but they pay.
    </p>
    <div class="tiers-row">
      ${renderTierCard('Public', '🌐', String(accessPolicy.public?.pricePerQuery ?? '0.02'), 'per query', 'Identity, skills, interests, headline scores', false)}
      ${renderTierCard('Private', '🔐', String(accessPolicy.private?.pricePerQuery ?? '0.50'), 'per query', 'Full profile — financials, Presence breakdown, all data', true)}
      ${renderTierCard('Marketing', '📨', String(accessPolicy.marketing?.pricePerMessage ?? '5.00'), 'per message', 'Pay to message directly. No refunds.', false)}
    </div>
    <div style="padding:12px 16px; background:var(--green-lt); border-left:3px solid var(--green); border-radius:var(--radius); font-family:'Roboto',sans-serif; font-size:13px; color:var(--green);">
      <strong>Revenue split:</strong> You keep 90% of every query and message. Search Star takes 10%.
    </div>
  </div>

  <!-- ═══ CONTACT CTA ═══ -->
  <div style="text-align:center; padding:48px 0; margin-bottom:32px;">
    <a href="https://www.searchstar.com" class="cta-btn">
      Contact via Search Star →
    </a>
    <div style="font-family:'Roboto',sans-serif; font-size:12px; color:var(--muted); margin-top:12px;">
      Platforms query this profile via the Search Star API. You control the data, access, and price.
    </div>
  </div>

</div>

<!-- Footer -->
<div class="footer">
  <strong>Search Star</strong> — Sovereign Personal Data Standard · Schema v1.3<br/>
  <a href="https://www.searchstar.com">searchstar.com</a> · <a href="https://www.searchstar.com/spec.html">Spec</a> · <a href="https://www.searchstar.com/manifesto">Manifesto</a>
</div>

<!-- Visibility Mode Toggle -->
<script>
function setMode(mode) {
  document.body.className = 'mode-' + mode;
  document.getElementById('btn-full').className = mode === 'full' ? 'vis-btn active' : 'vis-btn';
  document.getElementById('btn-summary').className = mode === 'summary' ? 'vis-btn active' : 'vis-btn';
}
</script>
</body>
</html>`
}
