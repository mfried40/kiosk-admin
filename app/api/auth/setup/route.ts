import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export async function GET() {
  const count = await db.user.count();
  return NextResponse.json({ configured: count > 0 });
}

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(12, "Password must be at least 12 characters"),
});

export async function POST(req: Request) {
  // Guard: only allow if no users exist yet
  const count = await db.user.count();
  if (count > 0) {
    return NextResponse.json(
      { error: "Setup already completed" },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { email, password } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 12);

  await db.user.create({
    data: { email, passwordHash, role: "ADMIN" },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
