'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

// v4 Decision #8: the /commit/[id]/invite sub-route is retired alongside
// the rest of the /commit/[id] surface. Sponsor invitations now live
// inside the room via /api/rooms/[id]/invite. Anyone landing here gets
// redirected to the correct room (via the parent /commit/[id] redirect).
export default function RetiredInvitePage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  useEffect(() => {
    router.replace(`/commit/${id}`) // parent redirects to /room/<room_id>
  }, [id, router])

  return null
}
