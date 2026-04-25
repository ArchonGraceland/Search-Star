// Shared media URL classifiers. Imported by the Companion's image-passthrough
// and video-transcription logic (src/lib/companion/media.ts,
// src/lib/companion/day90.ts) AND by
// the room message renderer (src/app/room/[id]/room-message.tsx) so URL
// classification stays consistent across every place a practitioner's media
// is read or rendered.
//
// Both helpers are tolerant:
//   - Extensions are matched case-insensitively.
//   - Cloudinary transformation paths (/video/upload/, /image/upload/) are
//     accepted as a secondary signal because a Cloudinary URL without an
//     extension on the tail is still classifiable by its delivery path.
//   - Query strings are accepted (common with signed Cloudinary URLs and
//     S3 pre-signed URLs).
//
// The extension set is the UNION of what the Companion pipeline needed and
// what the room renderer needed when these classifiers were first duplicated
// inline. In particular, heic/avif are important for iOS uploads, and
// avi/mkv/m4v are important for desktop video formats that show up in
// practitioner session posts.
//
// A URL that matches neither is treated as unknown media — callers should
// skip it (Companion pipeline) or fall back to a plain link (room renderer)
// rather than guess.

export function isVideoUrl(url: string): boolean {
  return (
    /\.(mp4|mov|avi|webm|mkv|m4v)(\?|$)/i.test(url) ||
    url.includes('/video/upload/')
  )
}

export function isImageUrl(url: string): boolean {
  return (
    /\.(jpg|jpeg|png|gif|webp|avif|heic)(\?|$)/i.test(url) ||
    url.includes('/image/upload/')
  )
}
