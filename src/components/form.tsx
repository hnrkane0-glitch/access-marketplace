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
  "w-full rounded-lg border border-[var(--line)] bg-white px-4 py-2.5 text-base focus:border-brass focus:ring-2 focus:ring-brass/20 outline-none transition-shadow";

export const primaryButtonClass =
  "w-full rounded-xl bg-grad-brand text-white font-medium py-3 hover:opacity-90 transition-opacity pop-shadow disabled:opacity-50 disabled:cursor-not-allowed";
