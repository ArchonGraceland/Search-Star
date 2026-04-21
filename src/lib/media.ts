// Shared media URL classifiers. Imported by the Companion's image-passthrough
// and video-transcription logic (src/lib/companion/media.ts,
// src/lib/companion/day90.ts, src/app/api/companion/reflect/route.ts) so URL
// classification stays consistent across every place a practitioner's media
// is read. The room message renderer (src/app/room/[id]/room-message.tsx)
// inlines its own copies today — a follow-up cleanup could fold those back
// to this module, but that is out of scope for the B/C/D arc.
//
// Both helpers are tolerant: extensions are matched case-insensitively, and
// the Cloudinary transformation paths (/video/upload/, /image/upload/) are
// accepted as a secondary signal because a Cloudinary URL without an
// extension on the tail is still classifiable by its delivery path.
//
// A URL that matches neither is treated as unknown media — callers should
// skip it rather than guess.

export function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|avi|webm|mkv)/i.test(url) || url.includes('/video/upload/')
}

export function isImageUrl(url: string): boolean {
  return (
    /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url) ||
    url.includes('/image/upload/')
  )
}
