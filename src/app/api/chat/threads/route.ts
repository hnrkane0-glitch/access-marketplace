import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, userError } from "@/lib/api-error";

const CreateSchema = z.object({ email: z.string().email() });

export async function GET() {
  try {
    const user = await requireUser();
    const rows = await db.chatThread.findMany({
      where: { participants: { some: { userId: user.id } } },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        participants: { include: { user: { select: { id: true, fullName: true, email: true } } } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    return NextResponse.json(rows);
  } catch (err) { return handleApiError(err); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { email } = CreateSchema.parse(await req.json());
    const other = await db.user.findUnique({ where: { email } });
    if (!other) throw userError("No user found with that email.");
    if (other.id === user.id) throw userError("You cannot start a chat with yourself.");

    const existing = await db.chatThread.findFirst({
      where: {
        participants: { every: { userId: { in: [user.id, other.id] } } },
        AND: [
          { participants: { some: { userId: user.id } } },
          { participants: { some: { userId: other.id } } },
        ],
      },
    });
    if (existing) return NextResponse.json({ id: existing.id });

    const thread = await db.chatThread.create({
      data: { participants: { create: [{ userId: user.id }, { userId: other.id }] } },
    });
    return NextResponse.json({ id: thread.id }, { status: 201 });
  } catch (err) { return handleApiError(err); }
}
