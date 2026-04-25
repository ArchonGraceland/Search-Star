/**
 * Feature flags for surfaces that are gated until their v4 design lands.
 *
 * The institutional portal (`/institution/*`, `/api/institution/*`) is
 * taken down behind `INSTITUTIONAL_PORTAL_ENABLED` per
 * docs/review/pass-3-decisions.md §1 (Cluster 4). The surface is hidden
 * by default — when the env var is absent or anything other than the
 * exact string `'true'`, the gate returns false. The take-down is
 * structurally safe-by-default; no Vercel env change is required for
 * production hiding. Set `INSTITUTIONAL_PORTAL_ENABLED='true'` only
 * when v4.8 design wants to expose the surface for prototyping.
 */

import { notFound } from 'next/navigation'

export function isInstitutionalPortalEnabled(): boolean {
  return process.env.INSTITUTIONAL_PORTAL_ENABLED === 'true'
}

/**
 * Server-component guard. Call as the first line of a page component
 * inside the institutional surface. Throws Next.js's not-found signal
 * (rendered as a 404) when the surface is disabled.
 */
export function requireInstitutionalPortal(): void {
  if (!isInstitutionalPortalEnabled()) {
    notFound()
  }
}
