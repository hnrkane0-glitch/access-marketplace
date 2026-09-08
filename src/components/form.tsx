export function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1.5">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-[var(--line)] bg-white px-4 py-2.5 text-base focus:border-brass";

export const primaryButtonClass =
  "w-full rounded-lg bg-ink text-paper font-medium py-3 hover:bg-[var(--ink-soft)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
