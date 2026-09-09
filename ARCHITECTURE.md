# Access Marketplace — Architecture (Phase 1 / MVP)

This document is the source of truth for how money, bookings, and access move
through the system. Every implementation decision in `/src` and
`/prisma/schema.prisma` traces back to a rule written here. If code and this
document disagree, this document wins until it's deliberately updated.

---

## 1. Scope of this build (Phase 1 MVP)

Per the roadmap in the spec, Phase 1 proves the core loop end-to-end for a
single category set, single currency (NGN), single country (Nigeria), one
payment provider (Paystack):

1. Signup / login (email + password, JWT session).
2. Provider onboarding + listing creation.
3. Category-driven listings with availability.
4. Search + filters.
5. Booking request → server-priced → Paystack payment → webhook-confirmed.
6. Deposit tracked separately from booking amount.
7. Platform commission tracked separately.
8. Ledger: every money movement is an explicit, immutable entry.
9. Configurable payout hold window; provider sees "available in N days."
10. Admin: view transactions, disputes, override/release payouts.
11. A separate admin console (`/admin-login`, guarded routes under `/admin`)
    authenticated by a single username/password pair from the environment
    (`ADMIN_USERNAME` / `ADMIN_PASSWORD`, defaults `admin` / `password`) —
    intentionally NOT tied to the `User` table, so no renter or provider
    account can ever reach it. See `src/lib/admin-auth.ts`.

Explicitly **out of scope for Phase 1** (stubbed with clear extension
points): packages, multi-provider checkout, QR check-in hardware flow,
KYC provider integration (interface only), SMS/WhatsApp, multi-currency,
multi-language, staff roles beyond Owner, promoted listings.

---

## 2. Non-negotiable payment rule

> Frontend never determines price, fees, deposit, or payment status.
> Only the server — driven by data it owns and a signed Paystack event —
> can move a booking or ledger entry from one state to another.

Concretely:

- `POST /api/bookings` computes price server-side from `Listing.priceRules`
  and `Listing.depositRule` at request time. The client sends only
  `listingId`, `startsAt`, `endsAt`, `quantity`. It cannot send a price.
- `POST /api/payments/paystack/initialize` re-reads the `Booking` row
  server-side to get the authoritative amount before calling Paystack.
  It never trusts an amount from the client.
- `POST /api/payments/paystack/webhook` is the **only** place a `Booking`
  moves from `PAYMENT_PENDING` to `PAID`. The client-side "payment
  successful" redirect from Paystack only shows a "confirming your
  payment..." screen — it polls booking status, it does not set it.
- The webhook handler verifies the `x-paystack-signature` header against
  `PAYSTACK_SECRET_KEY` before touching the database (see
  `src/lib/paystack.ts`).
- Webhook processing is idempotent: `PaymentEvent.providerEventId` has a
  unique constraint, so a duplicate webhook delivery is a no-op, not a
  double credit.

---

## 3. Booking state machine

```
REQUESTED
  → PAYMENT_PENDING        (server created Paystack transaction)
    → PAID                 (webhook verified charge.success)
      → CONFIRMED           (auto, immediately after PAID for instant-book;
                              or after provider approval for request-to-book)
        → CHECKED_IN
          → ACTIVE
            → CHECKOUT_PENDING
              → COMPLETED
                → PAYOUT_PENDING
                  → PAYOUT_RELEASED

Side branches (reachable from most non-terminal states):
  CANCELLED
  REFUND_PENDING → REFUNDED
  DISPUTED → UNDER_REVIEW → (back to COMPLETED path OR REFUNDED)
  PAYMENT_FAILED   (terminal, from PAYMENT_PENDING)
  SUSPENDED        (admin-only, freezes further transitions)
```

Rules enforced in `src/lib/booking-state-machine.ts`:

- Transitions are a whitelist (`ALLOWED_TRANSITIONS` map). Any code path
  that tries an edge not in that map throws — there is no "just set the
  status field" anywhere in the codebase.
- Every transition writes an `AuditLog` row (actor, from, to, reason).
- `COMPLETED → PAYOUT_PENDING` reads `PlatformSetting.payoutHoldDays`
  (default 5, admin-configurable) and stamps `Payout.availableAt`.
- Opening a `Dispute` on a booking sets `Payout.holdReason = 'DISPUTE'`,
  which blocks the payout-release background job regardless of
  `availableAt` until the dispute resolves.

---

## 4. The ledger (this is the part that must never be "clever")

We do **not** store a `balance` field on `User` or `ProviderProfile`.
Every balance shown in a dashboard is a live aggregate over immutable
`LedgerEntry` rows. This is what section 77 of the spec ("no fake wallet
money") requires, and it's also what makes the system auditable and
reconcilable against Paystack's own records.

### LedgerEntry (append-only)

| field | notes |
|---|---|
| id | |
| bookingId | nullable (e.g. subscription charges aren't booking-tied) |
| userId | who this entry belongs to (customer or provider) |
| type | enum, see below |
| direction | `CREDIT` or `DEBIT` |
| amount | integer, kobo (never float) |
| currency | `NGN` for Phase 1 |
| status | `PENDING` \| `RESERVED` \| `AVAILABLE` \| `RELEASED` \| `REVERSED` |
| relatedPaymentEventId | FK to the PaymentEvent that caused this, if any |
| createdAt | |
| reversalOfId | self-FK; a correction never edits a row, it adds a reversal |

### LedgerEntry.type (mirrors spec section 5)

Customer side: `BOOKING_PAYMENT`, `DEPOSIT_HELD`, `DEPOSIT_REFUNDED`,
`REFUND`.

Provider side: `GROSS_BOOKING_REVENUE`, `PLATFORM_COMMISSION`,
`PROVIDER_EARNING_PENDING`, `PROVIDER_EARNING_AVAILABLE`,
`WITHDRAWAL_REQUESTED`, `WITHDRAWAL_COMPLETED`, `DISPUTE_HOLD`,
`REFUND_DEDUCTION`.

### Worked example (matches spec section 7)

Booking amount ₦100,000, deposit ₦30,000, commission 10%.
Customer pays ₦130,000. On webhook confirmation the system writes, in a
single DB transaction:

```
+130,000  CREDIT  BOOKING_PAYMENT            user=customer status=RESERVED
 -30,000  DEBIT   (implicit, deposit carve-out)
 +30,000  CREDIT  DEPOSIT_HELD                user=customer status=RESERVED
 +90,000  CREDIT  GROSS_BOOKING_REVENUE       user=provider status=RESERVED
 +10,000  CREDIT  PLATFORM_COMMISSION         user=platform status=AVAILABLE
 +90,000  CREDIT  PROVIDER_EARNING_PENDING    user=provider status=RESERVED
```

"Provider available balance" is computed, never stored, as:

```
SUM(PROVIDER_EARNING_AVAILABLE, status=AVAILABLE)
  - SUM(WITHDRAWAL_REQUESTED, status IN (PENDING, PROCESSING, COMPLETED))
```

`PROVIDER_EARNING_PENDING` flips to `PROVIDER_EARNING_AVAILABLE` only when
the background job (`src/jobs/release-payouts.ts`) finds
`Payout.availableAt <= now() AND holdReason IS NULL`.

---

## 5. Data model

See `prisma/schema.prisma` for the authoritative, typed version. Summary
of entities and why each exists:

- **User / Session** — auth identity. One user can hold a `ProviderProfile`
  and be a customer simultaneously (spec section 2 — no forced separate
  accounts).
- **ProviderProfile** — payout account, verification status, commission
  override, subscription tier.
- **IdentityVerification** — modular record with `provider` (e.g. `"stub"`,
  later `"smileid"`, `"dojah"`), `status`, `externalRef`. The KYC vendor is
  swappable without touching booking logic.
- **Category / CategoryAttribute** — DB-driven tree (spec section 14),
  `CategoryAttribute` holds the dynamic filter schema per category
  (spec section 16) as JSON so filters differ by category without schema
  migrations per category.
- **Listing / ListingMedia / ListingAvailability / ListingPriceRule /
  ListingDepositRule** — what's for access, when, and at what price.
  Availability is stored as explicit time-ranges, not a boolean, so
  double-booking prevention can use a DB-level exclusion constraint
  (see §6).
- **Booking** — one request for access. `priceSnapshot` (JSON) freezes the
  computed price/deposit/commission at booking time so later price-rule
  edits never retroactively change an existing booking.
- **Payment / PaymentEvent** — `Payment` is our record of intent;
  `PaymentEvent` is one immutable row per Paystack webhook received
  (unique on provider event id — this is the idempotency guard).
- **LedgerEntry** — §4 above.
- **Deposit** — status machine independent of the booking's own state
  (`HELD → UNDER_REVIEW → REFUND_APPROVED/PARTIAL/DENIED → REFUNDED`).
- **Payout / Withdrawal** — `Payout` is "this booking's earnings are
  scheduled to become withdrawable on date X." `Withdrawal` is "provider
  asked to move their available balance to their bank account."
  Deliberately separate: payouts accrue continuously, withdrawals are
  a discrete provider action.
- **Dispute / DisputeEvidence** — case management, freezes payout/deposit.
- **Review, Message, Notification, Favorite, SavedSearch** — as specified.
- **AuditLog** — every state transition and every admin override, ever.
- **PlatformSetting** — key/value config table (commission %, payout hold
  days, min withdrawal, cancellation policies) — never hard-coded.

---

## 6. Preventing double-booking

Two layers:

1. **Application layer:** before creating a `Booking`, the API checks for
   overlapping `CONFIRMED`/`PAID`/`ACTIVE` bookings on the same listing
   within a DB transaction (`SELECT ... FOR UPDATE` equivalent via
   Prisma's `$transaction` + a unique partial constraint).
2. **Database layer:** a Postgres exclusion constraint
   (`EXCLUDE USING gist (listing_id WITH =, during WITH &&)`) on a
   generated `tstzrange` column is the real guarantee — added via a raw
   SQL migration since Prisma doesn't model exclusion constraints
   natively. This means even concurrent requests cannot both succeed.
   See `prisma/migrations/.../migration.sql` (added after `prisma
   migrate dev` — noted as a TODO since we can't run the Prisma engine in
   this sandbox).

---

## 7. Auth & authorization

- Passwords hashed with bcrypt (cost 12).
- Sessions are signed JWTs in an httpOnly, secure, sameSite=lax cookie —
  no tokens in localStorage.
- Every API route re-derives `userId` from the verified session server-side;
  nothing trusts a client-supplied user id.
- Role checks (`isProvider`, `isAdmin`) are enforced in a shared
  `requireRole()` helper used at the top of every protected route handler,
  not just hidden in the UI.

---

## 8. What's genuinely stubbed and why

| Piece | Status | Reason |
|---|---|---|
| Paystack calls | Real API shape, real signature verification, needs your live/test secret key in `.env` | Can't call external network from this sandbox |
| KYC/identity verification | Interface + stub provider that auto-approves in dev | Needs a licensed vendor; architected for swap-in |
| Background jobs (payout release, expired booking cleanup) | Written as plain functions meant to run on a cron/queue (`src/jobs/`) | No queue infra provisioned yet — Phase 1 can call them from a scheduled route hit by an external cron (e.g. Vercel Cron) |
| SMS/WhatsApp notifications | Interface only, email + in-app implemented | Phase 2 per roadmap |
| File/virus scanning on upload | Type/size validated; virus scan hook stubbed | Needs a scanning provider (e.g. ClamAV service) |

None of these are pretend — the code paths, types, and DB fields exist so
plugging in a real vendor is a config + one adapter file, not a rewrite.
