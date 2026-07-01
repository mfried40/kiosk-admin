import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole, guardErrorResponse } from "@/lib/api-guard";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireRole("ADMIN");
  } catch (err) {
    return guardErrorResponse(err) ?? Response.json({ error: "Unknown error" }, { status: 500 });
  }

  const { id } = await params;
  const existing = await db.tag.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await db.tag.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
