"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";

export default function AdminLogoutButton({ compact }: { compact?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin-login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={loading}
      className={
        compact
          ? "flex items-center gap-1.5 text-xs font-medium text-white/60 hover:text-white"
          : "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-rust hover:bg-rust/10 transition-colors"
      }
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />}
      Log out
    </button>
  );
}
