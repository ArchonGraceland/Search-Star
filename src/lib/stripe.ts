import Stripe from 'stripe'

// Lazy-init factory so builds don't require STRIPE_SECRET_KEY to be set.
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (_stripe) return _stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set. Add it to your Vercel env before Stripe flows can run.'
    )
  }
  _stripe = new Stripe(key, {
    typescript: true,
    appInfo: { name: 'Search Star', url: 'https://www.searchstar.com' },
  })
  return _stripe
}

export const MIN_PLEDGE_USD = 5

export function pledgeDollarsToCents(dollars: number): number {
  if (!Number.isFinite(dollars) || dollars <= 0) {
    throw new Error(`Invalid pledge amount: ${dollars}`)
  }
  return Math.round(dollars * 100)
}
