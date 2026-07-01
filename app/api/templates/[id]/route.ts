import { db } from "@/lib/db";
import { requireRole, guardErrorResponse } from "@/lib/api-guard";
import { z } from "zod";
import type { Provider } from "@/lib/generated/prisma/client";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  settings: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requireRole("ADMIN");
  } catch (e) {
    return guardErrorResponse(e) ?? Response.json({ error: "Unknown" }, { status: 500 });
  }

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 422 });
  }

  const existing = await db.configTemplate.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.name && parsed.data.name !== existing.name) {
    const conflict = await db.configTemplate.findFirst({
      where: { name: parsed.data.name, provider: existing.provider as Provider },
    });
    if (conflict) {
      return Response.json({ error: "Name already taken for this provider" }, { status: 409 });
    }
  }

  const updated = await db.configTemplate.update({
    where: { id },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.settings ? { settings: JSON.stringify(parsed.data.settings) } : {}),
    },
  });

  return Response.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requireRole("ADMIN");
  } catch (e) {
    return guardErrorResponse(e) ?? Response.json({ error: "Unknown" }, { status: 500 });
  }

  const { id } = await params;
  const existing = await db.configTemplate.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  await db.configTemplate.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
