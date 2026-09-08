import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";

export async function POST() {
  try {
    await destroySession();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
