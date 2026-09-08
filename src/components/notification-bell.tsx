"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Bell } from "lucide-react";

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const r = await apiFetch<{ results: Notif[]; unreadCount: number }>("/api/notifications");
      setNotifs(r.results);
      setUnreadCount(r.unreadCount);
    } catch {
      // Silent — a failed notification fetch shouldn't disrupt the page.
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && unreadCount > 0) {
      setUnreadCount(0);
      setNotifs((cur) => cur.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
      try {
        await apiFetch("/api/notifications", { method: "PATCH" });
      } catch {
        // Best-effort — worst case unread count is briefly stale.
      }
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggleOpen}
        aria-label="Notifications"
        className="relative flex items-center justify-center w-9 h-9 rounded-full border border-[var(--line)] hover:border-brass transition-colors"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rust text-white text-[10px] font-semibold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] card-shadow z-50">
          <p className="px-4 py-3 text-sm font-semibold border-b border-[var(--line)]">
            Notifications
          </p>
          {notifs.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[var(--ink-soft)] text-center">
              Nothing yet.
            </p>
          ) : (
            <div className="divide-y divide-[var(--line)]">
              {notifs.map((n) => (
                <div key={n.id} className="px-4 py-3">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-sm text-[var(--ink-soft)] mt-0.5">{n.body}</p>
                  <p className="text-xs text-[var(--ink-soft)] mt-1">{timeAgo(n.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
