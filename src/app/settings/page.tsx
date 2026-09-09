import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import SubscriptionManager from "./subscription-manager";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!["ACTIVE", "TRIALING"].includes(user.subscriptionStatus ?? "")) redirect("/plans");
  return <SubscriptionManager tier={user.subscriptionTier ?? "STARTER"} status={user.subscriptionStatus!} />;
}
