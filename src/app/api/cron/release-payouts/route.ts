import { NextRequest, NextResponse } from "next/server";
import { releaseDuePayouts } from "@/jobs/release-payouts";

/**
 * Hit this on a schedule from an external cron (Vercel Cron, GitHub
 * Actions schedule, etc). Protected by a shared secret header rather than
 * user auth, since it's not called by a browser session.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await releaseDuePayouts();
  return NextResponse.json(result);
}
