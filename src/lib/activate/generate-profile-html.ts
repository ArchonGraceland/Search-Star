// ═══════════════════════════════════════════════════
// generate-profile-html.ts
// Generates a standalone HTML profile page using
// the Graceland design system, matching profile.html
// ═══════════════════════════════════════════════════

/* eslint-disable @typescript-eslint/no-explicit-any */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function provenanceBadgeHtml(status: string): string {
  const colors: Record<string, { bg: string; text: string; label: string }> = {
    confirmed: { bg: '#f0fdf4', text: '#166534', label: 'Confirmed' },
    corrected: { bg: '#eef2f8', text: '#1a3a6b', label: 'Corrected' },
    self_reported: { bg: '#fffbeb', text: '#92400e', label: 'Self-reported' },
    seeded: { bg: '#f5f5f5', text: '#767676', label: 'Unreviewed' },
    validated: { bg: '#f0fdf4', text: '#166534', label: 'Validated' },
  }
  const c = colors[status] || colors.seeded
  return `<span style="font-family:'Roboto',sans-serif; font-size:10px; font-weight:700; padding:2px 8px; border-radius:3px; background:${c.bg}; color:${c.text}; text-transform:uppercase; letter-spacing:0.08em;">${c.label}</span>`
}

function renderSkillRow(skill: any): string {
  const name = escapeHtml(skill.name || '')
  const detail = escapeHtml(skill.detail || '')
  const prov = skill.provenance?.status || 'seeded'
  return `
    <div style="display:grid; grid-template-columns:180px 120px 1fr; gap:12px; align-items:center; padding:10px 0; border-bottom:1px solid #e8e8e8;">
      <div style="font-family:'Crimson Text',Georgia,serif; font-size:16px; font-weight:600;">${name}</div>
      <div>${provenanceBadgeHtml(prov)}</div>
      <div style="font-family:'Roboto',sans-serif; font-size:13px; color:#767676;">${detail}</div>
    </div>`
}

function renderInterestSection(label: string, icon: string, items: any[]): string {
  if (!items || items.length === 0) return ''
  const rows = items.map(i => {
    const name = escapeHtml(i.name || '')
    const detail = escapeHtml(i.detail || '')
    const prov = i.provenance?.status || 'seeded'
    return `
      <div style="display:flex; align-items:center; gap:12px; padding:8px 0; border-bottom:1px solid #e8e8e8;">
        <div style="font-family:'Crimson Text',Georgia,serif; font-size:15px; font-weight:600; min-width:160px;">${name}</div>
        ${provenanceBadgeHtml(prov)}
        <div style="font-family:'Roboto',sans-serif; font-size:13px; color:#767676; flex:1;">${detail}</div>
      </div>`
  }).join('')
  return `
    <div style="margin-bottom:24px;">
      <div style="font-family:'Roboto',sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:#767676; margin-bottom:10px;">${icon} ${escapeHtml(label)}</div>
      ${rows}
    </div>`
}

function renderPhotoCard(photo: any): string {
  const caption = escapeHtml(photo.label || photo.caption || '')
  const date = escapeHtml(photo.date || '')
  const location = escapeHtml(photo.location || '')
  const chapter = escapeHtml(photo.chapter || '')
  const hasUrl = photo.url && !photo.url.startsWith('photos/')
  return `
    <div style="border:1px solid #d4d4d4; border-radius:6px; overflow:hidden; background:#fff;">
      <div style="height:180px; background:linear-gradient(145deg, #1a3a6b, #2a5a8f); display:flex; align-items:center; justify-content:center; position:relative;">
        ${hasUrl
          ? `<img src="${escapeHtml(photo.url)}" alt="${caption}" style="width:100%; height:100%; object-fit:cover;" />`
          : `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg" style="width:60px; opacity:0.4;"><rect width="120" height="160" rx="4" fill="rgba(255,255,255,0.1)"/><circle cx="60" cy="55" r="18" fill="rgba(255,255,255,0.15)"/><path d="M60,73 C42,73 30,90 30,115 L90,115 C90,90 78,73 60,73Z" fill="rgba(255,255,255,0.1)"/></svg>`
        }
        <span style="position:absolute; top:8px; right:8px; font-family:'Roboto',sans-serif; font-size:9px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; padding:3px 8px; border-radius:3px; background:rgba(0,0,0,0.5); color:#fff;">${chapter}</span>
      </div>
      <div style="padding:12px 14px;">
        <div style="font-family:'Crimson Text',Georgia,serif; font-size:14px; font-weight:600; margin-bottom:4px;">${caption}</div>
        <div style="font-family:'Roboto',sans-serif; font-size:11px; color:#767676;">${date}${location ? ` · ${location}` : ''}</div>
      </div>
    </div>`
}

function renderTierCard(name: string, icon: string, price: string, unit: string, desc: string, featured: boolean): string {
  return `
    <div style="border:${featured ? '2px solid #1a3a6b' : '1px solid #d4d4d4'}; border-radius:6px; padding:28px; background:#fff; flex:1;">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
        <span style="font-size:20px;">${icon}</span>
        <div style="font-family:'Crimson Text',Georgia,serif; font-size:22px;">${escapeHtml(name)}</div>
      </div>
      <div style="font-family:'Roboto',sans-serif; font-size:12px; color:#767676; margin-bottom:16px; line-height:1.5;">${escapeHtml(desc)}</div>
      <div style="display:flex; align-items:baseline; gap:4px; margin-bottom:2px;">
        <span style="font-family:'JetBrains Mono',monospace; font-size:11px; color:#767676;">$</span>
        <span style="font-family:'JetBrains Mono',monospace; font-size:28px; font-weight:700;">${escapeHtml(price)}</span>
      </div>
      <div style="font-family:'Roboto',sans-serif; font-size:12px; color:#767676;">${escapeHtml(unit)}</div>
    </div>`
}

export function generateProfileHtml(profile: any): string {
  const identity = profile.identity || {}
  const displayName = escapeHtml(identity.displayName || 'Profile')
  const handle = escapeHtml(identity.handle || '')
  const tagline = escapeHtml(identity.tagline || '')
  const location = escapeHtml(identity.location || '')
  const currentTitle = escapeHtml(identity.currentTitle || '')
  const updated = profile.updated ? new Date(profile.updated).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : ''

  const skills = profile.skills || []
  const interests = profile.interests || {}
  const professional = profile.professional || []
  const media = profile.media || []
  const accessPolicy = profile.accessPolicy?.tiers || {}
  const meta = profile._meta || {}

  // Group photos by chapter
  const chapterOrder = ['intellectual', 'social', 'athletic', 'professional', 'aesthetic', 'family']
  const chapterLabels: Record<string, string> = {
    intellectual: '📚 Intellectual',
    social: '🤝 Social',
    athletic: '🏃 Athletic',
    professional: '💼 Professional',
    aesthetic: '🎨 Aesthetic',
    family: '👨‍👩‍👧 Family',
  }

  // Provenance summary bar
  const provBreakdown = meta.provenanceBreakdown || {}
  const provItems = Object.entries(provBreakdown)
    .filter(([, count]) => (count as number) > 0)
    .map(([status, count]) => `${provenanceBadgeHtml(status)} <span style="font-family:'Roboto',sans-serif; font-size:12px; margin-left:2px;">${count} fields</span>`)
    .join('&nbsp;&nbsp;&nbsp;')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${displayName} — Search Star Profile</title>
<link href="https://fonts.googleapis.com/css2?family=Crimson+Text:wght@400;600;700&family=Roboto:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --ink: #1a1a1a;
    --paper: #f5f5f5;
    --cream: #eef2f8;
    --accent: #1a3a6b;
    --accent-light: #8aabbf;
    --green: #166534;
    --green-light: #f0fdf4;
    --gold: #92400e;
    --gold-light: #fffbeb;
    --muted: #767676;
    --border: #d4d4d4;
    --radius: 6px;
    --navy: #1a3a6b;
    --navy-dk: #112a4f;
    --white: #ffffff;
    --gray-2: #5a5a5a;
    --gray-3: #767676;
    --gray-5: #e8e8e8;
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Crimson Text', Georgia, serif;
    background: var(--paper);
    color: var(--ink);
    line-height: 1.6;
    font-size: 18px;
    -webkit-font-smoothing: antialiased;
  }
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 40px;
    border-bottom: 3px solid var(--navy-dk);
    background: var(--navy);
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .topbar-logo {
    font-family: 'Crimson Text', Georgia, serif;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.3px;
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--white);
    text-decoration: none;
  }
  .page { max-width: 1200px; margin: 0 auto; padding: 40px; }
  .section {
    margin-bottom: 48px;
  }
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 2px solid var(--gray-5);
  }
  .section-header h2 {
    font-family: 'Crimson Text', Georgia, serif;
    font-size: 24px;
    font-weight: 700;
  }
  .tier-badge {
    font-family: 'Roboto', sans-serif;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 4px 12px;
    border-radius: 3px;
  }
  .tier-public { background: var(--cream); color: var(--navy); }
  .tier-private { background: var(--green-light); color: var(--green); }
  .footer {
    text-align: center;
    padding: 32px 40px;
    border-top: 1px solid var(--gray-5);
    font-family: 'Roboto', sans-serif;
    font-size: 12px;
    color: var(--muted);
  }
  .footer a { color: var(--navy); text-decoration: none; font-weight: 700; }
  .footer a:hover { text-decoration: underline; }
  .cta-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-family: 'Roboto', sans-serif;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 12px 28px;
    background: var(--navy);
    color: var(--white);
    border: none;
    border-radius: 3px;
    cursor: pointer;
    text-decoration: none;
    transition: background 0.2s;
  }
  .cta-btn:hover { background: var(--navy-dk); }
  @media (max-width: 768px) {
    .page { padding: 20px; }
    .topbar { padding: 12px 20px; }
    .profile-header { grid-template-columns: 1fr !important; gap: 20px !important; }
    .avatar { width: 120px !important; height: 144px !important; }
    .tiers-row { flex-direction: column !important; }
    .photo-grid { grid-template-columns: repeat(2, 1fr) !important; }
  }
</style>
</head>
<body>

<!-- Top Bar -->
<div class="topbar">
  <a href="https://www.searchstar.com" class="topbar-logo">
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" style="width:28px; height:28px;">
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
      <div style="font-family:'JetBrains Mono',monospace; font-size:13px; color:var(--muted); margin-bottom:16px;">searchstar://${escapeHtml(handle.replace('@', ''))}</div>
      ${tagline ? `<p style="font-family:'Crimson Text',Georgia,serif; font-size:18px; color:var(--gray-2); max-width:500px; margin-bottom:20px; line-height:1.5;">${tagline}</p>` : ''}
      ${currentTitle ? `<p style="font-family:'Roboto',sans-serif; font-size:14px; color:var(--gray-2); margin-bottom:16px;">${currentTitle}</p>` : ''}
      <div style="display:flex; gap:12px; flex-wrap:wrap;">
        ${location ? `<span style="display:flex; align-items:center; gap:6px; font-family:'Roboto',sans-serif; font-size:11px; font-weight:500; padding:5px 12px; border-radius:3px; border:1px solid var(--border); background:var(--white);">📍 ${location}</span>` : ''}
        <span style="display:flex; align-items:center; gap:6px; font-family:'Roboto',sans-serif; font-size:11px; font-weight:500; padding:5px 12px; border-radius:3px; border:1px solid var(--border); background:var(--white);">⏱ ${updated}</span>
        <span style="display:flex; align-items:center; gap:6px; font-family:'Roboto',sans-serif; font-size:11px; font-weight:500; padding:5px 12px; border-radius:3px; border:1px solid var(--border); background:#fffbeb;">⚡ Activated profile</span>
      </div>
    </div>
  </div>

  <!-- ═══ PROVENANCE SUMMARY ═══ -->
  <div style="margin-bottom:32px; padding:16px 20px; background:var(--cream); border-radius:var(--radius); border-left:3px solid var(--accent);">
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
          <div style="font-family:'Roboto',sans-serif; font-size:10px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:var(--muted); margin-bottom:4px;">${escapeHtml(x.l)}</div>
          <div style="font-family:'Crimson Text',Georgia,serif; font-size:17px;">${escapeHtml(x.v)}</div>
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
    ${skills.map((s: any) => renderSkillRow(s)).join('')}
  </div>` : ''}

  <!-- ═══ INTERESTS ═══ -->
  ${(interests.athletic?.length > 0 || interests.social?.length > 0 || interests.intellectual?.length > 0) ? `
  <div class="section">
    <div class="section-header">
      <h2>Interests</h2>
      <span class="tier-badge tier-public">Public Tier</span>
    </div>
    ${renderInterestSection('Athletic', '🏃', interests.athletic || [])}
    ${renderInterestSection('Social', '🤝', interests.social || [])}
    ${renderInterestSection('Intellectual', '📚', interests.intellectual || [])}
  </div>` : ''}

  <!-- ═══ PROFESSIONAL ═══ -->
  ${professional.length > 0 ? `
  <div class="section">
    <div class="section-header">
      <h2>Professional History</h2>
      <span class="tier-badge tier-public">Public Tier</span>
    </div>
    ${professional.map((p: any) => `
      <div style="display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid #e8e8e8;">
        <div style="font-family:'Crimson Text',Georgia,serif; font-size:16px; font-weight:600; min-width:160px;">${escapeHtml(p.label || '')}</div>
        ${provenanceBadgeHtml(p.provenance?.status || 'seeded')}
        <div style="font-family:'Roboto',sans-serif; font-size:13px; color:#767676; flex:1;">${escapeHtml(p.detail || '')}</div>
      </div>`).join('')}
  </div>` : ''}

  <!-- ═══ VISUAL NARRATIVE ═══ -->
  ${media.length > 0 ? `
  <div class="section">
    <div class="section-header">
      <h2>Visual Narrative</h2>
      <span class="tier-badge tier-private">Private Tier</span>
    </div>
    <p style="font-family:'Roboto',sans-serif; font-size:14px; color:var(--muted); margin-bottom:24px; line-height:1.6;">
      Photos organized by life chapter. Validators can vouch for individual photos — confirming moments, events, and context.
    </p>
    ${chapterOrder.map(ch => {
      const chapterPhotos = media.filter((p: any) => p.chapter === ch)
      if (chapterPhotos.length === 0) return ''
      return `
        <div style="margin-bottom:32px;">
          <div style="font-family:'Roboto',sans-serif; font-size:12px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:var(--muted); margin-bottom:12px;">${chapterLabels[ch] || ch}</div>
          <div class="photo-grid" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:16px;">
            ${chapterPhotos.map((p: any) => renderPhotoCard(p)).join('')}
          </div>
        </div>`
    }).join('')}
  </div>` : ''}

  <!-- ═══ PRESENCE COMPOSITE ═══ -->
  <div class="section">
    <div class="section-header">
      <h2>Presence Composite</h2>
      <span class="tier-badge tier-private">Private Tier</span>
    </div>
    <div style="padding:24px; background:var(--cream); border-radius:var(--radius); text-align:center;">
      <div style="font-family:'JetBrains Mono',monospace; font-size:36px; font-weight:700; color:#b8b8b8; margin-bottom:8px;">—</div>
      <div style="font-family:'Roboto',sans-serif; font-size:13px; color:var(--muted);">
        Presence Composite (Rizz, Vibe, Drip) requires explicit participation and photo scoring.<br/>
        This section populates as the profile owner completes the assessment flow.
      </div>
    </div>
  </div>

  <!-- ═══ ACCESS & PRICING ═══ -->
  <div class="section">
    <div class="section-header">
      <h2>Access &amp; Pricing</h2>
    </div>
    <p style="font-family:'Roboto',sans-serif; font-size:14px; color:var(--muted); margin-bottom:24px; line-height:1.6;">
      Three tiers. Public is your storefront. Private is the full picture. Marketing is your inbox — anyone can message you, but they pay.
    </p>
    <div class="tiers-row" style="display:flex; gap:20px; margin-bottom:32px;">
      ${renderTierCard('Public', '🌐', String(accessPolicy.public?.pricePerQuery ?? '0.02'), 'per query', 'Identity, skills, interests, headline scores', false)}
      ${renderTierCard('Private', '🔐', String(accessPolicy.private?.pricePerQuery ?? '0.50'), 'per query', 'Full profile — financials, Presence breakdown, all data', true)}
      ${renderTierCard('Marketing', '📨', String(accessPolicy.marketing?.pricePerMessage ?? '5.00'), 'per message', 'Pay to message directly. No refunds.', false)}
    </div>
    <div style="padding:12px 16px; background:var(--green-light); border-left:3px solid var(--green); border-radius:var(--radius); font-family:'Roboto',sans-serif; font-size:13px; color:var(--green);">
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

</body>
</html>`
}
