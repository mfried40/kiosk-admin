import { requireRole, guardErrorResponse } from "@/lib/api-guard";
import { dismiss } from "@/lib/mqtt/discovery";

type Params = { params: Promise<{ mqttDeviceId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  try {
    await requireRole("ADMIN");
  } catch (err) {
    return guardErrorResponse(err) ?? Response.json({ error: "Unknown error" }, { status: 500 });
  }

  const { mqttDeviceId } = await params;
  dismiss(mqttDeviceId);
  return Response.json({ ok: true });
}
