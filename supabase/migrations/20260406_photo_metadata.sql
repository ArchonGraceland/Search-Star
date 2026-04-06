-- ═══════════════════════════════════════════════════
-- ACTIVATE PHASE 5 — Photo Metadata Schema
-- ═══════════════════════════════════════════════════
-- Spec reference: Section 3.9 "Photo metadata schema"
--
-- Creates:
--   1. photo_metadata table matching the spec's full schema
--   2. RLS policies: owners CRUD own, admins all, service role all
--   3. Indexes for common queries

-- ═══ 1. photo_metadata table ═══

CREATE TABLE IF NOT EXISTS photo_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links to directory entry (the profile this photo belongs to)
  profile_id uuid NOT NULL REFERENCES directory(id) ON DELETE CASCADE,

  -- Core fields per spec Section 3.9
  type text NOT NULL DEFAULT 'photo' CHECK (type IN ('photo', 'video')),
  url text,                          -- Final hosted URL (set when user hosts)
  hash text,                         -- SHA-256 content hash: "sha256:abc..."
  access_tier text NOT NULL DEFAULT 'public'
    CHECK (access_tier IN ('public', 'private', 'marketing')),

  -- Narrative block
  chapter text NOT NULL CHECK (chapter IN (
    'intellectual', 'social', 'athletic', 'professional', 'aesthetic', 'family'
  )),
  caption text NOT NULL DEFAULT '',
  photo_date text,                   -- ISO date string YYYY-MM-DD
  location text DEFAULT '',
  related_fields text[] DEFAULT '{}',

  -- Provenance block
  provenance_status text NOT NULL DEFAULT 'self_reported'
    CHECK (provenance_status IN ('discovered', 'confirmed', 'self_reported')),
  provenance_source text DEFAULT '',  -- e.g. 'pycon.org/2024/speakers' or 'google-photos'
  discovered_at timestamptz DEFAULT now(),

  -- Validation block (scaffolding — populated in future phases)
  validated_by text[] DEFAULT '{}',   -- Array of validator profile numbers
  validation_stake numeric(10,2) DEFAULT 0,

  -- Source tracking
  source_channel text NOT NULL DEFAULT 'upload'
    CHECK (source_channel IN ('public', 'google', 'upload', 'url')),
  source_label text DEFAULT '',
  preview_data text,                  -- Base64 WebP data URL for client preview
  original_url text,                  -- Original source URL (for URL imports)

  -- WebP processing metadata
  webp_size integer,
  exif_camera_make text,
  exif_camera_model text,
  exif_latitude numeric(10,7),
  exif_longitude numeric(10,7),

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ═══ 2. Indexes ═══

CREATE INDEX idx_photo_metadata_profile_id ON photo_metadata(profile_id);
CREATE INDEX idx_photo_metadata_chapter ON photo_metadata(profile_id, chapter);
CREATE INDEX idx_photo_metadata_access_tier ON photo_metadata(profile_id, access_tier);
CREATE INDEX idx_photo_metadata_hash ON photo_metadata(hash) WHERE hash IS NOT NULL;

-- ═══ 3. Enable RLS ═══

ALTER TABLE photo_metadata ENABLE ROW LEVEL SECURITY;

-- ═══ 4. RLS policies ═══

-- Profile owners can read their own photos
CREATE POLICY "Profile owners can read own photos"
  ON photo_metadata FOR SELECT
  USING (
    profile_id IN (
      SELECT id FROM directory WHERE user_id = auth.uid()
    )
  );

-- Profile owners can insert photos for their own profiles
CREATE POLICY "Profile owners can insert own photos"
  ON photo_metadata FOR INSERT
  WITH CHECK (
    profile_id IN (
      SELECT id FROM directory WHERE user_id = auth.uid()
    )
  );

-- Profile owners can update their own photos
CREATE POLICY "Profile owners can update own photos"
  ON photo_metadata FOR UPDATE
  USING (
    profile_id IN (
      SELECT id FROM directory WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    profile_id IN (
      SELECT id FROM directory WHERE user_id = auth.uid()
    )
  );

-- Profile owners can delete their own photos
CREATE POLICY "Profile owners can delete own photos"
  ON photo_metadata FOR DELETE
  USING (
    profile_id IN (
      SELECT id FROM directory WHERE user_id = auth.uid()
    )
  );

-- Admins can manage all photos
CREATE POLICY "Admins can manage photo_metadata"
  ON photo_metadata FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin')
  );

-- Service role can manage all photos (used by API routes)
CREATE POLICY "Service role can manage photo_metadata"
  ON photo_metadata FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Authenticated users can read public-tier photos
CREATE POLICY "Authenticated can read public photos"
  ON photo_metadata FOR SELECT
  USING (auth.role() = 'authenticated' AND access_tier = 'public');

-- ═══ 5. Updated_at trigger ═══

CREATE OR REPLACE FUNCTION update_photo_metadata_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_photo_metadata_updated_at
  BEFORE UPDATE ON photo_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_photo_metadata_updated_at();
