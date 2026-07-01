import { db } from "@/lib/db";
import { requireAuth, requireRole, guardErrorResponse } from "@/lib/api-guard";
import { z } from "zod";
import type { Provider } from "@/lib/generated/prisma/client";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    await requireAuth();
  } catch (e) {
    return guardErrorResponse(e) ?? Response.json({ error: "Unknown" }, { status: 500 });
  }
  const templates = await db.configTemplate.findMany({ orderBy: { createdAt: "desc" } });
  return Response.json(templates);
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  provider: z.enum(["FULLY_KIOSK", "FREE_KIOSK"]),
  settings: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
});

export async function POST(req: Request): Promise<Response> {
  try {
    await requireRole("ADMIN");
  } catch (e) {
    return guardErrorResponse(e) ?? Response.json({ error: "Unknown" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 422 });
  }

  const { name, provider, settings } = parsed.data;

  const existing = await db.configTemplate.findFirst({
    where: { name, provider: provider as Provider },
  });
  if (existing) {
    return Response.json({ error: "A template with this name already exists for this provider" }, { status: 409 });
  }

  const template = await db.configTemplate.create({
    data: {
      name,
      provider: provider as Provider,
      settings: JSON.stringify(settings),
    },
  });

  return Response.json(template, { status: 201 });
}
