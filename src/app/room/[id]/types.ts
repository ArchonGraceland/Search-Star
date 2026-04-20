// Types shared between the room server page and its client components
// (room-message.tsx, room-composer.tsx). Keeping these in a type-only
// file prevents the server-only imports in page.tsx from leaking into
// client bundles via named imports — see commit 5c50fbd79 for the
// same trap in public-header.

export type MessageType =
  | 'practitioner_post'
  | 'companion_response'
  | 'companion_welcome'
  | 'companion_milestone'
  | 'companion_moderation'
  | 'sponsor_message'
  | 'system'

export interface RoomMessageData {
  id: string
  user_id: string
  commitment_id: string | null
  message_type: MessageType
  body: string | null
  media_urls: string[]
  transcript: string | null
  is_session: boolean
  posted_at: string
  author_name: string
  affirmation_count: number
  viewer_affirmed: boolean
  viewer_can_affirm: boolean
}
