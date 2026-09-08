import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  try {
    const results = await db.location.findMany({
      orderBy: { city: "asc" },
      select: { id: true, city: true, area: true, state: true },
    });
    return NextResponse.json({ results });
  } catch (err) {
    return handleApiError(err);
  }
}
