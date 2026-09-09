import { getSetting } from "@/lib/platform-settings";
import SettingsEditor from "./settings-editor";

export default async function AdminSettingsPage() {
  const [payoutHoldDays, minWithdrawalKobo] = await Promise.all([
    getSetting<number>("payoutHoldDays"),
    getSetting<number>("minWithdrawalKobo"),
  ]);

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold tracking-tight">Platform settings</h1>
      <p className="mt-1 text-sm text-white/50">
        Core rules the whole marketplace runs on. Change carefully — these apply immediately.
      </p>
      <SettingsEditor payoutHoldDays={payoutHoldDays} minWithdrawalKobo={minWithdrawalKobo} />
    </div>
  );
}
