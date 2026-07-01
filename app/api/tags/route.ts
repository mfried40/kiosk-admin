import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth, requireRole, guardErrorResponse } from "@/lib/api-guard";

const TagCreateSchema = z.object({
  name: z.string().min(1).max(50),
});

export async function GET(_req: NextRequest) {
  try {
    await requireAuth();
  } catch (err) {
    return guardErrorResponse(err) ?? Response.json({ error: "Unknown error" }, { status: 500 });
  }

  const tags = await db.tag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { devices: true } } },
  });

  return Response.json(tags);
}

export async function POST(req: NextRequest) {
  try {
    await requireRole("ADMIN");
  } catch (err) {
    return guardErrorResponse(err) ?? Response.json({ error: "Unknown error" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = TagCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 422 });
  }

  const existing = await db.tag.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    return Response.json({ error: "Tag name already exists" }, { status: 409 });
  }

  const tag = await db.tag.create({ data: parsed.data });
  return Response.json(tag, { status: 201 });
}
