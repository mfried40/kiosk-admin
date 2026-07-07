import { requireRole, guardErrorResponse } from "@/lib/api-guard";
import { listUnknown } from "@/lib/mqtt/discovery";

export async function GET() {
  try {
    await requireRole("ADMIN");
  } catch (err) {
    return guardErrorResponse(err) ?? Response.json({ error: "Unknown error" }, { status: 500 });
  }

  return Response.json(listUnknown());
}
