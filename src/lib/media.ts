// Shared media URL classifiers. Previously duplicated inline in
// src/app/log/client.tsx and src/app/sponsor/[commitment_id]/[token]/page.tsx;
// centralized here so the Companion's image-passthrough + video-transcription
// logic stays consistent with the classifiers the UI uses for rendering.
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
