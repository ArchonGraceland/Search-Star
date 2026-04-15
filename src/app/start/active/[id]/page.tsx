import { redirect } from 'next/navigation'

// This page has been merged into /log
// Redirect anyone landing here (e.g. old bookmarks, email links) to /log
export default async function StageActive() {
  redirect('/log')
}
