import { applyTemplate } from "@/lib/templates";
import { requireRole, guardErrorResponse } from "@/lib/api-guard";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  deviceIds: z.array(z.string().uuid()).min(1),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  let session;
  try {
    session = await requireRole("ADMIN");
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

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 422 });
  }

  let results;
  try {
    results = await applyTemplate(id, parsed.data.deviceIds, session.user!.id!);
  } catch (err) {
    if (err instanceof Error && err.message === "Provider mismatch") {
      return Response.json({ error: "All devices must use the same provider as the template" }, { status: 400 });
    }
    if (err instanceof Error && err.message.includes("No ConfigTemplate")) {
      return Response.json({ error: "Template not found" }, { status: 404 });
    }
    throw err;
  }

  const failed = results.filter((r) => !r.success);
  return Response.json({ results, partial: failed.length > 0 && failed.length < results.length }, {
    status: failed.length === results.length ? 502 : 200,
  });
}
