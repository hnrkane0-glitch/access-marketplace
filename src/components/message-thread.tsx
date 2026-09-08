"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Send, MessageCircle, Loader2 } from "lucide-react";

interface Msg {
  id: string;
  body: string;
  imageUrl: string | null;
  isSystem: boolean;
  createdAt: string;
  sender: { id: string; fullName: string };
  isMine: boolean;
}

export default function MessageThread({ bookingId }: { bookingId: string }) {
  const [messages, setMessages] = useState<Msg[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const r = await apiFetch<{ results: Msg[] }>(`/api/bookings/${bookingId}/messages`);
      setMessages(r.results);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load messages.");
    }
  }

  useEffect(() => {
    load();
    // Light polling keeps the thread reasonably fresh without adding a
    // websocket/SSE layer for a Phase 1 MVP.
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  async function send() {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    try {
      await apiFetch(`/api/bookings/${bookingId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      setDraft("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Message didn't send.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-6 pt-6 border-t border-[var(--line)]">
      <p className="text-sm font-medium flex items-center gap-1.5 mb-3">
        <MessageCircle size={15} /> Messages
      </p>

      <div className="max-h-72 overflow-y-auto space-y-2 rounded-lg bg-[var(--paper)] border border-[var(--line)] p-3">
        {messages === null ? (
          <p className="text-sm text-[var(--ink-soft)] flex items-center gap-1.5">
            <Loader2 size={13} className="animate-spin" /> Loading…
          </p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-[var(--ink-soft)]">
            No messages yet — say hello to coordinate details.
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.isMine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                  m.isSystem
                    ? "bg-amber-50 text-amber-800 border border-amber-200 mx-auto text-center"
                    : m.isMine
                    ? "bg-grad-brand text-white"
                    : "bg-white border border-[var(--line)]"
                }`}
              >
                {!m.isSystem && !m.isMine && (
                  <p className="text-[10px] uppercase tracking-wide opacity-60 mb-0.5">
                    {m.sender.fullName}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-xs text-rust mt-2">{error}</p>}

      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Write a message…"
          className="flex-1 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm focus:border-brass focus:ring-2 focus:ring-brass/20 outline-none"
        />
        <button
          type="button"
          disabled={sending || !draft.trim()}
          onClick={send}
          className="shrink-0 px-3.5 rounded-lg bg-grad-brand text-white disabled:opacity-40 flex items-center justify-center"
          aria-label="Send message"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
