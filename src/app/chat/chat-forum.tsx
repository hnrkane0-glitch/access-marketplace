"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api-client";
import { MessageCircle, Send, Plus, Loader2 } from "lucide-react";

type Thread = { id: string; participants: { user: { id: string; fullName: string; email: string } }[]; messages: { body: string; createdAt: string }[] };
type Message = { id: string; body: string; createdAt: string; sender: { id: string; fullName: string } };

export default function ChatForum({ currentUserId }: { currentUserId: string }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadThreads() {
    try { setThreads(await apiFetch<Thread[]>("/api/chat/threads")); } catch {}
  }
  async function loadMessages(id: string) {
    setSelected(id);
    try { setMessages(await apiFetch<Message[]>(`/api/chat/threads/${id}/messages`)); } catch {}
  }
  useEffect(() => { loadThreads(); }, []);

  async function newChat(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError("");
    try {
      const t = await apiFetch<{ id: string }>("/api/chat/threads", { method: "POST", body: JSON.stringify({ email }) });
      setEmail(""); await loadThreads(); await loadMessages(t.id);
    } catch (err) { setError(err instanceof ApiError ? err.message : "Could not start chat."); }
    finally { setLoading(false); }
  }
  async function send(e: React.FormEvent) {
    e.preventDefault(); if (!body.trim() || !selected) return;
    try {
      const m = await apiFetch<Message>(`/api/chat/threads/${selected}/messages`, { method: "POST", body: JSON.stringify({ body }) });
      setMessages(cur => [...cur, m]); setBody(""); await loadThreads();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Could not send."); }
  }

  return <main className="mx-auto max-w-6xl px-5 py-10">
    <div className="flex items-center gap-3"><div className="w-11 h-11 rounded-xl bg-grad-brand text-white flex items-center justify-center"><MessageCircle/></div><div><h1 className="text-3xl font-semibold">Provider & renter chat</h1><p className="text-sm text-[var(--ink-soft)]">Meet, ask questions and discuss bookings before you transact.</p></div></div>
    <form onSubmit={newChat} className="mt-6 flex gap-2 max-w-2xl">
      <input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Enter the other user's email" className="flex-1 rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm"/>
      <button disabled={loading} className="rounded-xl bg-ink text-white px-4 py-2.5 text-sm font-semibold flex items-center gap-2">{loading?<Loader2 size={15} className="animate-spin"/>:<Plus size={15}/>} New chat</button>
    </form>
    {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    <div className="mt-6 grid md:grid-cols-[300px_1fr] gap-4 min-h-[500px]">
      <div className="rounded-2xl border border-[var(--line)] bg-white overflow-hidden">
        {threads.map(t => {
          const other=t.participants.find(p=>p.user.id!==currentUserId)?.user;
          return <button key={t.id} onClick={()=>loadMessages(t.id)} className={`w-full text-left p-4 border-b border-[var(--line)] hover:bg-violet-50 ${selected===t.id?"bg-violet-50":""}`}>
            <p className="font-medium">{other?.fullName ?? "Conversation"}</p><p className="text-xs text-[var(--ink-soft)]">{other?.email}</p><p className="mt-2 text-xs truncate text-[var(--ink-soft)]">{t.messages[0]?.body ?? "No messages yet"}</p>
          </button>
        })}
        {threads.length===0 && <p className="p-5 text-sm text-[var(--ink-soft)]">No chats yet.</p>}
      </div>
      <div className="rounded-2xl border border-[var(--line)] bg-white flex flex-col">
        <div className="flex-1 p-5 space-y-3 overflow-y-auto">
          {messages.map(m => <div key={m.id} className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${m.sender.id===currentUserId?"ml-auto bg-grad-brand text-white":"bg-slate-100 text-slate-800"}`}><p>{m.body}</p><p className="text-[10px] opacity-60 mt-1">{new Date(m.createdAt).toLocaleString()}</p></div>)}
          {!selected && <div className="h-full flex items-center justify-center text-sm text-[var(--ink-soft)]">Choose a conversation to start.</div>}
        </div>
        {selected && <form onSubmit={send} className="p-4 border-t border-[var(--line)] flex gap-2"><input required value={body} onChange={e=>setBody(e.target.value)} placeholder="Write a message…" className="flex-1 rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm"/><button className="rounded-xl bg-grad-brand text-white px-4"><Send size={16}/></button></form>}
      </div>
    </div>
  </main>;
}
