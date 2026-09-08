import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  try {
    const results = await db.category.findMany({
      where: { isActive: true },
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }],
      select: { id: true, name: true, slug: true, parentId: true },
    });
    return NextResponse.json({ results });
  } catch (err) {
    return handleApiError(err);
  }
}
