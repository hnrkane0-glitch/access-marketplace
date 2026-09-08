import type { Metadata } from "next";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Access — find what you need, when you need it",
  description: "A marketplace for temporary access to spaces, equipment, skills, and capacity.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser().catch(() => null);

  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <header className="border-b border-[var(--line)] sticky top-0 z-40 bg-paper/95 backdrop-blur">
          <div className="mx-auto max-w-6xl px-5 flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-lg">
              <span
                aria-hidden
                className="inline-block w-6 h-6 rounded-full border-2 border-ink relative"
                style={{ borderColor: "var(--ink)" }}
              >
                <span className="absolute inset-[3px] rounded-full bg-brass" />
              </span>
              Access
            </Link>
            <nav className="hidden sm:flex items-center gap-6 text-sm">
              <Link href="/search" className="hover:text-brass-dim">
                Browse
              </Link>
              <Link href="/available-now" className="hover:text-brass-dim">
                Available now
              </Link>
              {user?.isProvider && (
                <Link href="/provider/dashboard" className="hover:text-brass-dim">
                  Provider dashboard
                </Link>
              )}
            </nav>
            <div className="flex items-center gap-3 text-sm">
              {user ? (
                <Link
                  href="/dashboard"
                  className="px-3 py-1.5 rounded border border-ink hover:bg-ink hover:text-paper transition-colors"
                >
                  {user.fullName.split(" ")[0]}
                </Link>
              ) : (
                <>
                  <Link href="/login" className="hover:text-brass-dim">
                    Log in
                  </Link>
                  <Link
                    href="/signup"
                    className="px-3 py-1.5 rounded bg-ink text-paper hover:bg-[var(--ink-soft)] transition-colors"
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-[var(--line)] mt-24">
          <div className="mx-auto max-w-6xl px-5 py-10 text-sm text-[var(--ink-soft)] flex flex-wrap justify-between gap-4">
            <p>Access, not ownership.</p>
            <p>&copy; {new Date().getFullYear()} Access Marketplace</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
