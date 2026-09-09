import type { Metadata } from "next";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import { Compass, LayoutGrid, Sparkles, Zap } from "lucide-react";
import NotificationBell from "@/components/notification-bell";

export const metadata: Metadata = {
  title: "Access — find what you need, when you need it",
  description: "A marketplace for temporary access to spaces, equipment, skills, and capacity.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser().catch(() => null);

  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <header className="border-b border-[var(--line)] sticky top-0 z-40 bg-paper/90 backdrop-blur-md">
          <div className="mx-auto max-w-6xl px-5 flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-lg">
              <span
                aria-hidden
                className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-grad-brand text-white pop-shadow"
              >
                <Zap size={16} strokeWidth={2.5} fill="currentColor" />
              </span>
              Access
            </Link>
            <nav className="hidden sm:flex items-center gap-6 text-sm font-medium">
              <Link href="/search" className="flex items-center gap-1.5 text-[var(--ink-soft)] hover:text-brass transition-colors">
                <Compass size={16} /> Browse
              </Link>
              <Link href="/search?instantBook=true" className="flex items-center gap-1.5 text-[var(--ink-soft)] hover:text-brass transition-colors">
                <Sparkles size={16} /> Available now
              </Link>
              {user?.isProvider && (
                <Link href="/provider/dashboard" className="flex items-center gap-1.5 text-[var(--ink-soft)] hover:text-brass transition-colors">
                  <LayoutGrid size={16} /> Provider dashboard
                </Link>
              )}
            </nav>
            <div className="flex items-center gap-3 text-sm">
              {user && <NotificationBell />}
              {user ? (
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--line)] font-medium hover:border-brass hover:text-brass transition-colors"
                >
                  <span className="w-6 h-6 rounded-full bg-grad-brand text-white text-xs font-semibold flex items-center justify-center">
                    {user.fullName.charAt(0).toUpperCase()}
                  </span>
                  {user.fullName.split(" ")[0]}
                </Link>
              ) : (
                <>
                  <Link href="/login" className="hover:text-brass transition-colors font-medium">
                    Log in
                  </Link>
                  <Link
                    href="/signup"
                    className="px-4 py-2 rounded-full bg-grad-brand text-white font-medium hover:opacity-90 transition-opacity pop-shadow"
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-[var(--line)] mt-24 bg-grad-dark text-white/80">
          <div className="mx-auto max-w-6xl px-5 py-12 grid sm:grid-cols-2 gap-6">
            <div>
              <p className="flex items-center gap-2 text-white font-semibold text-lg">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-grad-brand">
                  <Zap size={14} fill="currentColor" />
                </span>
                Access
              </p>
              <p className="mt-2 text-sm max-w-xs">Access, not ownership — book spaces, gear, skills and capacity by the hour.</p>
            </div>
            <div className="flex sm:justify-end items-end">
              <p className="text-sm">&copy; {new Date().getFullYear()} Access Marketplace</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
