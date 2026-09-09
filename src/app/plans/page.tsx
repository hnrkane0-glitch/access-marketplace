import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import PlanPicker from "./plan-picker";

export default async function PlansPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <PlanPicker email={user.email} />;
}
