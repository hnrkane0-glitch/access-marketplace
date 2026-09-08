import Link from "next/link";
import {
  Building2,
  Camera,
  Users,
  Boxes,
  Car,
  PartyPopper,
  ShieldCheck,
  Wallet,
  Search,
  CalendarCheck,
  KeyRound,
  Star,
  ArrowRight,
  Check,
  Zap,
} from "lucide-react";

const PURPOSES = [
  "Shoot a music video",
  "Host a birthday",
  "Start a pop-up shop",
  "Hold a meeting",
  "Store products",
  "Record a podcast",
  "Cook commercially",
  "Teach a class",
];

const CATEGORIES = [
  { name: "Spaces", slug: "spaces", blurb: "Studios, kitchens, halls, offices", icon: Building2, tint: "bg-violet-100 text-violet-700" },
  { name: "Equipment", slug: "equipment", blurb: "Cameras, tools, production gear", icon: Camera, tint: "bg-orange-100 text-orange-700" },
  { name: "People & skills", slug: "people", blurb: "Photographers, technicians, tutors", icon: Users, tint: "bg-blue-100 text-blue-700" },
  { name: "Business capacity", slug: "capacity", blurb: "Kitchens, storage, production lines", icon: Boxes, tint: "bg-emerald-100 text-emerald-700" },
  { name: "Mobility", slug: "mobility", blurb: "Vehicles, parking, trailers", icon: Car, tint: "bg-pink-100 text-pink-700" },
  { name: "Events", slug: "events", blurb: "Venues, sound, chairs, decoration", icon: PartyPopper, tint: "bg-amber-100 text-amber-700" },
];

const STEPS = [
  { icon: Search, title: "Find it", body: "Search by what you're trying to do, not just a category — filter by location, date, and price." },
  { icon: CalendarCheck, title: "Book it", body: "Reserve instantly or send a request. Your payment is held securely until you check in." },
  { icon: KeyRound, title: "Access it", body: "Show up, use your access code, and get to work. Deposits are released automatically after checkout." },
];

const PLANS = [
  {
    name: "Renter",
    price: "Free",
    unit: "to browse & book",
    icon: Search,
    highlight: false,
    features: ["Search & book any listing", "Buyer protection on every payment", "Deposit refunds handled automatically", "In-app messaging with providers"],
    cta: { label: "Start browsing", href: "/search" },
  },
  {
    name: "Provider",
    price: "5%",
    unit: "commission per booking",
    icon: Zap,
    highlight: true,
    features: ["Unlimited listings, photos & video", "Instant-book or request-to-book", "Payouts in 24–72 hrs after checkout", "Verified-provider badge & priority ranking"],
    cta: { label: "Become a provider", href: "/provider/onboarding" },
  },
  {
    name: "Business",
    price: "Custom",
    unit: "for teams & venues",
    icon: Building2,
    highlight: false,
    features: ["Multi-listing dashboard for a team", "Volume-based commission rates", "Dedicated account support", "API access for calendars & POS"],
    cta: { label: "Talk to us", href: "/signup" },
  },
];

const STATS = [
  { value: "10,000+", label: "Bookings protected" },
  { value: "₦0", label: "Lost to disputes when using escrow" },
  { value: "< 5 min", label: "Average time to book" },
  { value: "24–72 hrs", label: "Provider payout window" },
];

export default function HomePage() {
  return (
    <div className="overflow-x-hidden">
      {/* HERO */}
      <section className="relative">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-grad-brand opacity-[0.06]"
        />
        <div className="mx-auto max-w-6xl px-5 pt-14 pb-10">
          <div className="grid md:grid-cols-[1.3fr_1fr] rounded-3xl overflow-hidden border border-[var(--line)] card-shadow">
            <div className="bg-[var(--paper-raised)] p-8 sm:p-12">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide px-3 py-1 rounded-full bg-violet-100 text-violet-700">
                <Zap size={12} fill="currentColor" /> Live in Lagos
              </span>
              <h1 className="mt-4 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05] max-w-md">
                Find what you need.{" "}
                <span className="text-gradient">Access it</span> when you need it.
              </h1>
              <p className="mt-4 text-[var(--ink-soft)] max-w-sm">
                Studios, kitchens, equipment, skills and unused capacity —
                booked by the hour, secured by real payment protection.
              </p>

              <form action="/search" className="mt-8 space-y-3 max-w-md">
                <label className="block text-sm font-medium" htmlFor="q">
                  What do you need access to?
                </label>
                <div className="relative">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
                  <input
                    id="q"
                    name="q"
                    placeholder="e.g. photography studio in Lekki"
                    className="w-full rounded-xl border border-[var(--line)] bg-white pl-11 pr-4 py-3 text-base focus:border-brass focus:ring-2 focus:ring-brass/20 outline-none transition-shadow"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    name="city"
                    placeholder="Location"
                    className="rounded-xl border border-[var(--line)] bg-white px-4 py-2.5 text-sm focus:border-brass focus:ring-2 focus:ring-brass/20 outline-none transition-shadow"
                  />
                  <input
                    name="date"
                    type="date"
                    className="rounded-xl border border-[var(--line)] bg-white px-4 py-2.5 text-sm focus:border-brass focus:ring-2 focus:ring-brass/20 outline-none transition-shadow"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-grad-brand text-white font-medium py-3 hover:opacity-90 transition-opacity pop-shadow flex items-center justify-center gap-2"
                >
                  Search <ArrowRight size={16} />
                </button>
              </form>
            </div>

            {/* the pass */}
            <div className="relative bg-grad-dark text-white p-8 sm:p-10 flex flex-col justify-between perforated ticket-notch">
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-orange-300 font-mono flex items-center gap-1.5">
                  <Zap size={12} fill="currentColor" /> Access Pass
                </p>
                <p className="mt-3 text-2xl font-semibold leading-tight">
                  Commercial kitchen
                </p>
                <p className="text-sm text-white/60">Yaba, Lagos · 2pm – 5pm</p>
              </div>

              <dl className="mt-8 grid grid-cols-2 gap-y-3 text-sm">
                <dt className="text-white/50 flex items-center gap-1.5"><ShieldCheck size={14} /> Provider</dt>
                <dd className="text-right font-mono">Verified</dd>
                <dt className="text-white/50 flex items-center gap-1.5"><Wallet size={14} /> Payment</dt>
                <dd className="text-right font-mono">Protected</dd>
                <dt className="text-white/50">Deposit</dt>
                <dd className="text-right font-mono">Held</dd>
              </dl>

              <div className="mt-8 pt-6 border-t border-dashed border-white/25 flex items-end justify-between">
                <div>
                  <p className="text-xs text-white/50">Access code</p>
                  <p className="text-2xl font-mono tracking-widest text-orange-300">583921</p>
                </div>
                <span className="text-xs bg-emerald-400/20 text-emerald-300 border border-emerald-400/40 rounded-full px-3 py-1 font-medium">
                  Active
                </span>
              </div>
            </div>
          </div>

          {/* stat strip */}
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-4 text-center card-shadow">
                <p className="text-xl sm:text-2xl font-semibold text-gradient">{s.value}</p>
                <p className="text-xs text-[var(--ink-soft)] mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PURPOSE-FIRST DISCOVERY */}
      <section className="mx-auto max-w-6xl px-5 py-10">
        <h2 className="text-xl font-semibold tracking-tight">What are you trying to do?</h2>
        <div className="mt-5 flex flex-wrap gap-2.5">
          {PURPOSES.map((p) => (
            <Link
              key={p}
              href={`/search?purpose=${encodeURIComponent(p)}`}
              className="px-4 py-2 rounded-full border border-[var(--line)] bg-[var(--paper-raised)] text-sm font-medium hover:border-brass hover:text-brass hover:shadow-sm transition-all"
            >
              {p}
            </Link>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-6xl px-5 py-10">
        <h2 className="text-xl font-semibold tracking-tight">How Access works</h2>
        <div className="mt-6 grid sm:grid-cols-3 gap-5">
          {STEPS.map((s, i) => (
            <div key={s.title} className="relative rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-6 card-shadow hover-lift">
              <div className="w-11 h-11 rounded-xl bg-grad-brand text-white flex items-center justify-center pop-shadow">
                <s.icon size={20} />
              </div>
              <p className="mt-4 text-xs font-mono text-[var(--ink-soft)]">Step {i + 1}</p>
              <p className="font-semibold mt-1">{s.title}</p>
              <p className="text-sm text-[var(--ink-soft)] mt-1.5 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="mx-auto max-w-6xl px-5 py-10">
        <h2 className="text-xl font-semibold tracking-tight">Browse by category</h2>
        <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/search?category=${c.slug}`}
              className="group rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-5 hover:border-brass card-shadow hover-lift"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.tint}`}>
                <c.icon size={19} />
              </div>
              <p className="font-medium mt-3 flex items-center gap-1">
                {c.name}
                <ArrowRight size={14} className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-brass" />
              </p>
              <p className="text-sm text-[var(--ink-soft)] mt-1">{c.blurb}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="text-center max-w-xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Simple, transparent pricing</h2>
          <p className="mt-2 text-[var(--ink-soft)]">
            Browsing and booking is always free for renters. Providers keep the majority of every booking.
          </p>
        </div>
        <div className="mt-9 grid sm:grid-cols-3 gap-5 items-start">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl p-6 border card-shadow relative ${
                plan.highlight
                  ? "border-transparent bg-grad-dark text-white pop-shadow sm:-translate-y-2"
                  : "border-[var(--line)] bg-[var(--paper-raised)]"
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold bg-grad-warm text-white px-3 py-1 rounded-full">
                  Most popular
                </span>
              )}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${plan.highlight ? "bg-white/15" : "bg-violet-100 text-violet-700"}`}>
                <plan.icon size={18} className={plan.highlight ? "text-orange-300" : ""} />
              </div>
              <p className="mt-4 font-semibold text-lg">{plan.name}</p>
              <p className="mt-1">
                <span className="text-3xl font-semibold">{plan.price}</span>{" "}
                <span className={`text-sm ${plan.highlight ? "text-white/60" : "text-[var(--ink-soft)]"}`}>{plan.unit}</span>
              </p>
              <ul className="mt-5 space-y-2.5 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check size={16} className={`shrink-0 mt-0.5 ${plan.highlight ? "text-emerald-300" : "text-emerald-600"}`} />
                    <span className={plan.highlight ? "text-white/85" : "text-[var(--ink-soft)]"}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={plan.cta.href}
                className={`mt-6 flex items-center justify-center gap-2 rounded-xl py-2.5 font-medium transition-opacity hover:opacity-90 ${
                  plan.highlight ? "bg-grad-warm text-white" : "bg-ink text-white"
                }`}
              >
                {plan.cta.label} <ArrowRight size={15} />
              </Link>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-[var(--ink-soft)] mt-6">
          Commission and payout timing are illustrative and configurable per market — see your provider agreement for final rates.
        </p>
      </section>

      {/* TRUST / TESTIMONIAL STRIP */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="rounded-3xl bg-grad-dark text-white p-8 sm:p-12 grid md:grid-cols-[1fr_auto] gap-8 items-center">
          <div>
            <div className="flex gap-1 text-orange-300">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={16} fill="currentColor" />
              ))}
            </div>
            <p className="mt-3 text-lg sm:text-xl font-medium leading-snug max-w-xl">
              &ldquo;I list my studio for the hours I&apos;m not using it — the deposit hold and instant payout made it feel safe to try.&rdquo;
            </p>
            <p className="mt-3 text-sm text-white/60">Studio provider, Lagos</p>
          </div>
          <Link
            href="/provider/onboarding"
            className="shrink-0 flex items-center justify-center gap-2 rounded-xl bg-grad-warm text-white font-medium px-6 py-3 hover:opacity-90 transition-opacity"
          >
            List your space <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}
