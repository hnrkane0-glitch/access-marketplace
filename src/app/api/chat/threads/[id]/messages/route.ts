import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, userError } from "@/lib/api-error";

const Schema = z.object({ body: z.string().min(1).max(3000) });

async function authorized(id: string, userId: string) {
  const thread = await db.chatThread.findFirst({
    where: { id, participants: { some: { userId } } },
  });
  if (!thread) throw userError("Chat not found.");
  return thread;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await authorized(id, user.id);
    const messages = await db.chatMessage.findMany({
      where: { threadId: id },
      orderBy: { createdAt: "asc" },
      include: { sender: { select: { id: true, fullName: true } } },
      take: 200,
    });
    return NextResponse.json(messages);
  } catch (err) { return handleApiError(err); }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await authorized(id, user.id);
    const { body } = Schema.parse(await req.json());
    const message = await db.chatMessage.create({
      data: { threadId: id, senderId: user.id, body },
      include: { sender: { select: { id: true, fullName: true } } },
    });
    await db.chatThread.update({ where: { id }, data: { updatedAt: new Date() } });
    const recipient = await db.chatParticipant.findFirst({
      where: { threadId: id, userId: { not: user.id } },
    });
    if (recipient) {
      await db.notification.create({
        data: {
          userId: recipient.userId,
          type: "CHAT_MESSAGE",
          title: `New message from ${user.fullName}`,
          body: body.slice(0, 180),
        },
      });
    }
    return NextResponse.json(message, { status: 201 });
  } catch (err) { return handleApiError(err); }
}
