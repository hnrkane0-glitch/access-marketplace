import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import ChatForum from "./chat-forum";

export default async function ChatPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!["ACTIVE", "TRIALING"].includes(user.subscriptionStatus ?? "")) redirect("/plans");
  return <ChatForum currentUserId={user.id} />;
}
