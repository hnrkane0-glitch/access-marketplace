"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api-client";
import { FormField, inputClass, primaryButtonClass } from "@/components/form";
import { ImagePlus, Trash2, Video, ImageIcon } from "lucide-react";

interface MediaItem {
  url: string;
  type: "IMAGE" | "VIDEO";
}

interface Category {
  id: string;
  name: string;
  children?: Category[];
}

export default function NewListingPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<{ id: string; city: string; area: string | null }[]>(
    []
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [instantBook, setInstantBook] = useState(false);
  const [unit, setUnit] = useState("HOURLY");
  const [amountNaira, setAmountNaira] = useState("");
  const [depositMode, setDepositMode] = useState<"NONE" | "FIXED" | "PERCENT">("NONE");
  const [depositValue, setDepositValue] = useState("");

  const [media, setMedia] = useState<MediaItem[]>([]);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<"IMAGE" | "VIDEO">("IMAGE");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<{ results: Category[] }>("/api/meta/categories")
      .then((r) => setCategories(r.results))
      .catch(() => setCategories([]));
    apiFetch<{ results: { id: string; city: string; area: string | null }[] }>(
      "/api/meta/locations"
    )
      .then((r) => setLocations(r.results))
      .catch(() => setLocations([]));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await apiFetch<{ id: string }>("/api/listings", {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          categoryId,
          locationId,
          instantBook,
          attributeValues: {},
          basePrice: { unit, amountKobo: Math.round(Number(amountNaira) * 100) },
          deposit:
            depositMode === "NONE"
              ? { mode: "NONE" }
              : depositMode === "FIXED"
              ? { mode: "FIXED", fixedKobo: Math.round(Number(depositValue) * 100) }
              : { mode: "PERCENT", percentBps: Math.round(Number(depositValue) * 100) },
          media,
        }),
      });
      router.push(`/listings/${result.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-5 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Create a listing</h1>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">
        New listings start as &quot;pending review&quot; until an admin approves them.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <FormField label="Title">
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Description">
          <textarea
            required
            minLength={20}
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
          />
        </FormField>
        <FormField label="Category">
          <select
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={inputClass}
          >
            <option value="">Select a category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Location">
          <select
            required
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className={inputClass}
          >
            <option value="">Select a location</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.area ? `${l.area}, ` : ""}
                {l.city}
              </option>
            ))}
          </select>
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Price unit">
            <select value={unit} onChange={(e) => setUnit(e.target.value)} className={inputClass}>
              <option value="HOURLY">Per hour</option>
              <option value="DAILY">Per day</option>
              <option value="WEEKLY">Per week</option>
              <option value="MONTHLY">Per month</option>
              <option value="PER_PERSON">Per person</option>
              <option value="PER_SESSION">Per session</option>
            </select>
          </FormField>
          <FormField label="Price (₦)">
            <input
              required
              type="number"
              min={1}
              value={amountNaira}
              onChange={(e) => setAmountNaira(e.target.value)}
              className={inputClass}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Deposit">
            <select
              value={depositMode}
              onChange={(e) => setDepositMode(e.target.value as typeof depositMode)}
              className={inputClass}
            >
              <option value="NONE">No deposit</option>
              <option value="FIXED">Fixed amount</option>
              <option value="PERCENT">Percent of booking</option>
            </select>
          </FormField>
          {depositMode !== "NONE" && (
            <FormField label={depositMode === "FIXED" ? "Deposit (₦)" : "Deposit (%)"}>
              <input
                required
                type="number"
                min={0}
                value={depositValue}
                onChange={(e) => setDepositValue(e.target.value)}
                className={inputClass}
              />
            </FormField>
          )}
        </div>

        <FormField label="Photos & video">
          <div className="space-y-3">
            {media.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {media.map((m, i) => (
                  <div key={m.url + i} className="relative aspect-square rounded-lg overflow-hidden border border-[var(--line)] bg-[var(--paper-raised)]">
                    {m.type === "VIDEO" ? (
                      <video src={m.url} className="w-full h-full object-cover" muted />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element -- arbitrary provider-supplied host
                      <img src={m.url} alt="" className="w-full h-full object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => setMedia((cur) => cur.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-rust"
                      aria-label="Remove"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <select
                value={mediaType}
                onChange={(e) => setMediaType(e.target.value as "IMAGE" | "VIDEO")}
                className={`${inputClass} w-28 shrink-0`}
              >
                <option value="IMAGE">Photo</option>
                <option value="VIDEO">Video</option>
              </select>
              <input
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="Paste an image or video URL"
                className={inputClass}
              />
              <button
                type="button"
                disabled={!mediaUrl.trim() || media.length >= 10}
                onClick={() => {
                  setMedia((cur) => [...cur, { url: mediaUrl.trim(), type: mediaType }]);
                  setMediaUrl("");
                }}
                className="shrink-0 px-3 rounded-lg border border-[var(--line)] hover:border-brass disabled:opacity-40 flex items-center gap-1.5 text-sm"
              >
                <ImagePlus size={15} /> Add
              </button>
            </div>
            <p className="text-xs text-[var(--ink-soft)] flex items-center gap-1.5">
              {mediaType === "VIDEO" ? <Video size={12} /> : <ImageIcon size={12} />}
              Paste links to photos/video you host elsewhere (e.g. your phone&apos;s cloud backup, a CDN). Direct file upload isn&apos;t wired up yet — that needs a storage bucket (e.g. S3 or Vercel Blob) on the backend.
            </p>
          </div>
        </FormField>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={instantBook}
            onChange={(e) => setInstantBook(e.target.checked)}
          />
          Allow instant booking (skip manual approval)
        </label>

        {error && (
          <p className="text-sm text-rust bg-rust/10 border border-rust/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className={primaryButtonClass}>
          {loading ? "Creating…" : "Create listing"}
        </button>
      </form>
    </div>
  );
}
