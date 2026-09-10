# Access Marketplace

A marketplace for temporary access to spaces, equipment, skills, and unused
capacity. See `ARCHITECTURE.md` for the full reasoning behind the booking
lifecycle, ledger design, and payment rules — read that first if you're
picking this up cold.

## Stack

Next.js 16 (App Router, TypeScript, Tailwind v4) · PostgreSQL via Prisma ·
Paystack for payments.

## Getting started

```bash
npm install

# Copy and fill in
cp .env.example .env
# - DATABASE_URL: a real Postgres connection string
# - SESSION_SECRET: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# - PAYSTACK_SECRET_KEY / PAYSTACK_PUBLIC_KEY: from your Paystack test dashboard

npx prisma generate
npx prisma db push      # creates tables from schema.prisma (use `migrate dev` instead if you want migration history)
npm run db:seed         # platform system user, default categories, platform settings

npm run dev
```

> **Sandbox note:** this project was assembled in an environment without
> access to `binaries.prisma.sh`, so `prisma generate` and `npm run build`
> could not be run or verified here. Everything is written correctly
> against the schema — running the commands above on a normal machine
> should work without changes. If something doesn't compile, it's most
> likely a Prisma client type mismatch from the schema evolving after
> this was written — re-run `npx prisma generate`.

## What's real vs. stubbed

Read `ARCHITECTURE.md` §8 for the full list. Short version: auth, pricing,
the ledger, the booking state machine, and the Paystack payment + webhook
flow are fully implemented and are the parts to trust. KYC, SMS
notifications, and the outbound Paystack Transfer call for withdrawals are
architected (real DB fields, real interfaces) but not wired to a live
vendor — see the `TODO` comments at each of those call sites.

## Testing the payment flow locally

1. Run `npm run dev` and use [ngrok](https://ngrok.com) (or similar) to
   expose `localhost:3000` — Paystack needs a public URL to send webhooks
   to.
2. In your Paystack test dashboard, set the webhook URL to
   `https://<your-ngrok-domain>/api/payments/paystack/webhook`.
3. Sign up, become a provider (`/provider/onboarding`), create a listing
   (it starts `PENDING_REVIEW` — flip it to `ACTIVE` directly in the DB
   for now; an admin approval UI is a next step), then book it as a
   different account and pay with a
   [Paystack test card](https://paystack.com/docs/payments/test-payments/).
4. Watch the booking move `PAYMENT_PENDING → PAID → CONFIRMED` — only the
   webhook route does that, never the browser redirect.

## Releasing payouts locally

There's no queue/cron infra wired up yet. To manually trigger the payout
release job during development:

```bash
curl -X POST http://localhost:3000/api/cron/release-payouts \
  -H "x-cron-secret: $CRON_SECRET"
```

In production, point an external scheduler (Vercel Cron, a GitHub Actions
schedule, etc.) at that same route every 15 minutes or so.

## Directory map

```
prisma/schema.prisma        Data model — the source of truth for entities
src/lib/                    Auth, pricing, ledger, booking state machine, Paystack — read these first
src/jobs/                   Background jobs (payout release)
src/app/api/                All API routes
src/app/                    Pages (App Router)
src/components/             Shared client components
ARCHITECTURE.md             Why everything above is built the way it is
```

## Next steps (see ARCHITECTURE.md §1 for full Phase 1 scope)

- Admin dashboard (listing approval, dispute resolution, settings UI)
- DB-level exclusion constraint for double-booking (raw migration)
- Messaging, favorites, saved searches UI
- Real KYC vendor integration
- Real Paystack Transfer wiring for withdrawals
- Condition reports / check-in-checkout evidence upload UI
