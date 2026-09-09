import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAdminCredentials, createAdminSession } from "@/lib/admin-auth";
import { handleApiError, userError } from "@/lib/api-error";

const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const { username, password } = LoginSchema.parse(await req.json());

    if (!verifyAdminCredentials(username, password)) {
      throw userError("Incorrect username or password.");
    }

    await createAdminSession();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
