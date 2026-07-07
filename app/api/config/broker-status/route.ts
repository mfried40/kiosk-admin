import { requireAuth, guardErrorResponse } from "@/lib/api-guard";
import { isEmbeddedRunning, embeddedClientCount, getEmbeddedPort } from "@/lib/mqtt/broker";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAuth();
  } catch (err) {
    return guardErrorResponse(err) ?? Response.json({ error: "Unknown error" }, { status: 500 });
  }

  const config = await db.mqttConfig.findFirst({ select: { mode: true, embeddedPort: true } });

  return Response.json({
    mode: config?.mode ?? "external",
    running: isEmbeddedRunning(),
    port: getEmbeddedPort(),
    clientCount: embeddedClientCount(),
  });
}
