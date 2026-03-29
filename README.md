# Search Star ⭐

**Sovereign Personal Data Standard — Own your data, set your price.**

Search Star is an open-source standard for self-sovereign personal profiles. You host your own data, platforms query your API, and you get paid per query.

## What It Is

A structured, machine-readable personal data profile covering three domains:

- **Financial Standing** — Net worth, income, credit, and savings expressed as age-cohort percentiles (not raw dollars). Verified via zero-knowledge proofs.
- **Presence Composite™** — Rizz, Vibe, and Drip scores that measure interpersonal magnetism, aesthetic taste, and personal style. Deliberately brand-blind — penalizes conspicuous consumption, rewards originality.
- **Skills & Credentials** — W3C Verifiable Credentials, portfolio links, certifications. The professional layer.

## Three Access Tiers

| Tier | Access | What's Included | Pricing |
|------|--------|----------------|---------|
| 🌐 **Public** | Open to all | Name, bio, skills, headline Presence score | Per query (you set price) |
| 🔐 **Private** | Owner-approved only | Full profile — financials, Presence breakdown, media | Per query (you set price) |
| 📨 **Marketing** | Open to all | Pay to message you directly | Per message (you set price) |

## How It Works

1. You host your profile at a URI you control (`searchstar://yourname.id`)
2. Platforms request API access and select a tier
3. Every query/message is metered at your price
4. Revenue settles to your account in real time

## Schema

Profiles are served as JSON-LD using DIDs (Decentralized Identifiers) and W3C Verifiable Credentials. See the Schema Spec tab in the prototype for the full structure.

## Tech Stack

- **Identity**: DID:web
- **Credentials**: W3C Verifiable Credentials
- **Financial proofs**: Zero-knowledge proofs (ZK-SNARKs)
- **Billing**: Stripe Connect (per-query metering)
- **Auth**: OAuth 2.0 + API keys

## License

MIT
