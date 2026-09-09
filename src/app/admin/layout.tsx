import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  LayoutDashboard,
  ShieldCheck,
  Users,
  UserRound,
  Receipt,
  Wallet,
  Banknote,
  Send,
  Percent,
  Settings,
  Trophy,
} from "lucide-react";
import AdminLogoutButton from "./logout-button";

export const metadata: Metadata = {
  title: "Admin console — Access",
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/listings", label: "Pending reviews", icon: ShieldCheck },
  { href: "/admin/providers", label: "Providers", icon: Users },
  { href: "/admin/renters", label: "Renters", icon: UserRound },
  { href: "/admin/leaderboard", label: "Top providers & renters", icon: Trophy },
  { href: "/admin/transactions", label: "Transactions", icon: Receipt },
  { href: "/admin/payouts", label: "Payouts", icon: Wallet },
  { href: "/admin/withdrawals", label: "Withdrawals", icon: Banknote },
  { href: "/admin/send-money", label: "Send money", icon: Send },
  { href: "/admin/commission", label: "Commission", icon: Percent },
  { href: "/admin/settings", label: "Platform settings", icon: Settings },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ok = await isAdminAuthenticated();
  if (!ok) redirect("/admin-login");

  return (
    <div className="min-h-screen bg-[#05060f] text-white flex">
      <aside className="hidden md:flex md:w-64 shrink-0 flex-col border-r border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-white/10">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-grad-brand pop-shadow">
            <ShieldCheck size={16} strokeWidth={2.5} />
          </span>
          <span className="font-semibold tracking-tight">Admin console</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            >
              <item.icon size={16} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <AdminLogoutButton />
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="md:hidden h-14 flex items-center justify-between px-4 border-b border-white/10 bg-black/40 backdrop-blur-xl sticky top-0 z-30">
          <span className="flex items-center gap-2 font-semibold text-sm">
            <ShieldCheck size={16} /> Admin console
          </span>
          <AdminLogoutButton compact />
        </header>
        <main className="mx-auto max-w-7xl px-4 md:px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
