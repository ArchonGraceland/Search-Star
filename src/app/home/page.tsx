// /home is the escape-hatch route to the marketing homepage.
//
// Logged-in users can't reach the homepage via `/` — middleware redirects
// them to `/log` or `/start`. That's the right default for returning users,
// but it leaves no way to actually view the marketing page (to re-read it,
// show a friend, link someone). This route renders the same homepage
// component without any redirect, so logo clicks on `/log` and `/dashboard`
// have somewhere to land.
//
// The `/` route stays canonical for SEO and for logged-out entry. `/home`
// is explicitly for logged-in users who want to see the public page.
import HomePage from '../page'

export const metadata = {
  title: 'Search Star — What do you want to practice?',
  description: '90-day practice commitments. Private by default. Sponsors who believe in what you\'re building. An AI Companion that pays attention. Trust earned through action, not performance.',
  alternates: {
    canonical: '/',
  },
}

export default function HomeAliasPage() {
  return <HomePage />
}
