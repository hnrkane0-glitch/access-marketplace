import { db } from "@/lib/db";
import type { Subscription } from "@prisma/client";

/**
 * Looks up a user's subscription without ever throwing.
 *
 * Why this exists: if the `Subscription` table hasn't been pushed to the
 * live database yet (e.g. `npx prisma db push` was never run against
 * production after this model was added), every page that reads a
 * subscription would otherwise crash with an unhandled Prisma error,
 * taking down signup, both dashboards, and the packages page all at once.
 *
 * Instead we log a clear warning server-side and treat the user as having
 * no subscription, so the page still renders (it will just correctly route
 * them to /packages to pick a plan). Once the table exists in the real
 * database this behaves exactly like a normal lookup.
 */
export async function getSubscriptionSafe(userId: string): Promise<Subscription | null> {
  try {
    return await db.subscription.findUnique({ where: { userId } });
  } catch (error) {
    console.error(
      "[subscription] Failed to read Subscription table — has `npx prisma db push` been run against this database?",
      error
    );
    return null;
  }
}
