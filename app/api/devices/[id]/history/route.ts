import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, guardErrorResponse } from "@/lib/api-guard";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params): Promise<Response> {
  try {
    await requireAuth();
  } catch (err) {
    return guardErrorResponse(err) ?? Response.json({ error: "Unknown error" }, { status: 500 });
  }

  const { id } = await params;
  const device = await db.device.findUnique({ where: { id }, select: { id: true } });
  if (!device) return Response.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = req.nextUrl;
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const now = new Date();
  const from = fromParam ? new Date(fromParam) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const to = toParam ? new Date(toParam) : now;

  const rows = await db.deviceStatusHistory.findMany({
    where: {
      deviceId: id,
      recordedAt: { gte: from, lte: to },
    },
    orderBy: { recordedAt: "asc" },
    select: {
      recordedAt: true,
      online: true,
      batteryLevel: true,
      screenOn: true,
      currentUrl: true,
    },
  });

  return Response.json(rows);
}
