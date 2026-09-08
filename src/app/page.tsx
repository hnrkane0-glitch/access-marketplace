import Link from "next/link";

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
  { name: "Spaces", slug: "spaces", blurb: "Studios, kitchens, halls, offices" },
  { name: "Equipment", slug: "equipment", blurb: "Cameras, tools, production gear" },
  { name: "People & skills", slug: "people", blurb: "Photographers, technicians, tutors" },
  { name: "Business capacity", slug: "capacity", blurb: "Kitchens, storage, production lines" },
  { name: "Mobility", slug: "mobility", blurb: "Vehicles, parking, trailers" },
  { name: "Events", slug: "events", blurb: "Venues, sound, chairs, decoration" },
];

export default function HomePage() {
  return (
    <div>
      {/* HERO — boarding-pass stub: search on the left, a live example
          access pass on the right. Grounded in the product's own
          "digital transaction passport" / access-code concept. */}
      <section className="mx-auto max-w-6xl px-5 pt-14 pb-10">
        <div className="grid md:grid-cols-[1.3fr_1fr] rounded-2xl overflow-hidden border border-[var(--line)] shadow-[0_1px_0_var(--line)]">
          <div className="bg-[var(--paper-raised)] p-8 sm:p-12">
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05] max-w-md">
              Find what you need. Access it when you need it.
            </h1>
            <p className="mt-4 text-[var(--ink-soft)] max-w-sm">
              Studios, kitchens, equipment, skills and unused capacity —
              booked by the hour, secured by real payment protection.
            </p>

            <form action="/search" className="mt-8 space-y-3 max-w-md">
              <label className="block text-sm font-medium" htmlFor="q">
                What do you need access to?
              </label>
              <input
                id="q"
                name="q"
                placeholder="e.g. photography studio in Lekki"
                className="w-full rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-base focus:border-brass"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  name="city"
                  placeholder="Location"
                  className="rounded-lg border border-[var(--line)] bg-white px-4 py-2.5 text-sm focus:border-brass"
                />
                <input
                  name="date"
                  type="date"
                  className="rounded-lg border border-[var(--line)] bg-white px-4 py-2.5 text-sm focus:border-brass"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-lg bg-ink text-paper font-medium py-3 hover:bg-[var(--ink-soft)] transition-colors"
              >
                Search
              </button>
            </form>
          </div>

          {/* the pass */}
          <div className="relative bg-ink text-paper p-8 sm:p-10 flex flex-col justify-between perforated ticket-notch">
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-brass font-mono">
                Access Pass
              </p>
              <p className="mt-3 text-2xl font-semibold leading-tight">
                Commercial kitchen
              </p>
              <p className="text-sm text-paper/70">Yaba, Lagos · 2pm – 5pm</p>
            </div>

            <dl className="mt-8 grid grid-cols-2 gap-y-3 text-sm">
              <dt className="text-paper/60">Provider</dt>
              <dd className="text-right font-mono">Verified</dd>
              <dt className="text-paper/60">Payment</dt>
              <dd className="text-right font-mono">Protected</dd>
              <dt className="text-paper/60">Deposit</dt>
              <dd className="text-right font-mono">Held</dd>
            </dl>

            <div className="mt-8 pt-6 border-t border-dashed border-paper/25 flex items-end justify-between">
              <div>
                <p className="text-xs text-paper/60">Access code</p>
                <p className="text-2xl font-mono tracking-widest text-brass">583921</p>
              </div>
              <span className="text-xs bg-signal/20 text-signal border border-signal/40 rounded-full px-3 py-1 font-medium">
                Active
              </span>
            </div>
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
              className="px-4 py-2 rounded-full border border-[var(--line)] bg-[var(--paper-raised)] text-sm hover:border-brass hover:text-brass-dim transition-colors"
            >
              {p}
            </Link>
          ))}
        </div>
      </section>

      {/* AVAILABLE NOW */}
      <section className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Available right now</h2>
          <Link href="/available-now" className="text-sm text-brass-dim hover:underline">
            See all
          </Link>
        </div>
        <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { title: "Studio — 2 hours left today", loc: "Ikeja, Lagos", price: "₦8,000/hr" },
            { title: "Meeting room — available now", loc: "Victoria Island, Lagos", price: "₦5,000/hr" },
            { title: "Camera kit — available today", loc: "Yaba, Lagos", price: "₦12,000/day" },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-5"
            >
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-signal">
                <span className="w-1.5 h-1.5 rounded-full bg-signal" />
                Available now
              </span>
              <p className="mt-2 font-medium">{item.title}</p>
              <p className="text-sm text-[var(--ink-soft)]">{item.loc}</p>
              <p className="mt-3 text-sm font-mono">{item.price}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="mx-auto max-w-6xl px-5 py-10 pb-20">
        <h2 className="text-xl font-semibold tracking-tight">Browse by category</h2>
        <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/search?category=${c.slug}`}
              className="rounded-xl border border-[var(--line)] p-5 hover:border-brass transition-colors"
            >
              <p className="font-medium">{c.name}</p>
              <p className="text-sm text-[var(--ink-soft)] mt-1">{c.blurb}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
