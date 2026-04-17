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

// Default donation rate on pledge release — 5% per v4-decisions §5 and
// spec §7.7. The GoFundMe pattern: one recipient (Search Star), fully
// editable, removable in one action.
export const DEFAULT_DONATION_RATE = 0.05

// Clamp and validate a sponsor-supplied donation rate to the 0..1 range.
// Returns the default rate if the input is missing/NaN/out-of-band. Zero
// is a valid explicit choice (sponsor skipped) and is returned as-is.
export function coerceDonationRate(raw: unknown): number {
  if (raw === null || raw === undefined) return DEFAULT_DONATION_RATE
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return DEFAULT_DONATION_RATE
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

// Convert a pledge amount in dollars + rate to donation cents, rounded to
// the nearest cent. Returns 0 for rate=0 regardless of pledge.
export function donationDollarsToCents(pledgeDollars: number, rate: number): number {
  if (!Number.isFinite(pledgeDollars) || pledgeDollars <= 0) return 0
  if (!Number.isFinite(rate) || rate <= 0) return 0
  return Math.round(pledgeDollars * rate * 100)
}
