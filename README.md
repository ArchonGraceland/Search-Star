# Search Star

**Sovereign Personal Data Standard — Own your data, set your price.**

Search Star is an open-source standard for self-sovereign personal profiles. You host your own data, platforms query your API, and you get paid per query.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (App Router) |
| Auth | Supabase Auth |
| Database | Supabase Postgres |
| Payments | Stripe Connect |
| AI Builder | Anthropic API (Claude) |
| Deployment | Vercel |

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Login, signup
│   ├── (dashboard)/     # Dashboard, feed, account (authenticated)
│   ├── (admin)/         # Admin panel (admin role only)
│   ├── auth/callback/   # Supabase auth callback
│   ├── layout.tsx       # Root layout
│   ├── page.tsx         # Landing page
│   └── globals.css      # Project Graceland design system
├── components/          # Shared React components
├── lib/
│   └── supabase/        # Supabase client/server configuration
└── middleware.ts         # Auth session refresh + route protection

public/
├── spec.html            # Full specification document (v0.5)
├── profile.html         # Sample profile (SS-000001: Steve Smith)
├── create.html          # AI profile builder prompt
└── setup.html           # Self-hosting guide
```

## Development

```bash
cp .env.local.example .env.local
# Fill in your Supabase URL and anon key
npm install
npm run dev
```

## Live

- **App:** [searchstar.com](https://searchstar.com)
- **Spec:** [searchstar.com/spec.html](https://searchstar.com/spec.html)

## License

MIT
