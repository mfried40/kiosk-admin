import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole, guardErrorResponse } from "@/lib/api-guard";

const TagSyncSchema = z.object({
  tagIds: z.array(z.string().uuid()),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    await requireRole("ADMIN");
  } catch (err) {
    return guardErrorResponse(err) ?? Response.json({ error: "Unknown error" }, { status: 500 });
  }

  const { id } = await params;
  const device = await db.device.findUnique({ where: { id } });
  if (!device) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = TagSyncSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 422 });
  }

  const { tagIds } = parsed.data;

  // Full replace in a transaction
  await db.$transaction([
    db.deviceTag.deleteMany({ where: { deviceId: id } }),
    ...(tagIds.length > 0
      ? [
          db.deviceTag.createMany({
            data: tagIds.map((tagId) => ({ deviceId: id, tagId })),
          }),
        ]
      : []),
  ]);

  return Response.json({ ok: true });
}
