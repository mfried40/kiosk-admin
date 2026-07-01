/**
 * GET /api/devices/[id]/apps — list all installed apps on the device
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, guardErrorResponse } from "@/lib/api-guard";
import { getProvider, assertCapability } from "@/lib/providers";
import { ProviderCapabilityError, ProviderError } from "@/lib/provider.types";

type Params = { params: Promise<{ id: string }> };

export interface InstalledApp {
  packageName: string;
  appLabel: string;
  appVersion?: string;
  apkPath?: string;
  /** Base64-encoded PNG icon — may be absent */
  icon?: string;
}

export async function GET(_req: NextRequest, { params }: Params): Promise<Response> {
  try {
    await requireAuth();
  } catch (err) {
    return guardErrorResponse(err) ?? Response.json({ error: "Unknown error" }, { status: 500 });
  }

  const { id } = await params;
  const device = await db.device.findUnique({ where: { id } });
  if (!device) return Response.json({ error: "Not found" }, { status: 404 });

  try {
    assertCapability(device.provider, "hasApkManagement");
    const provider = getProvider(device.provider);
    const raw = await provider.sendCommand(device, "listApps");
    if (!Array.isArray(raw)) {
      return Response.json({ error: "Unexpected response from device" }, { status: 502 });
    }
    // Normalise: keep only fields we need, drop anything not serialisable
    const apps: InstalledApp[] = (raw as Record<string, unknown>[]).map((a) => ({
      packageName: String(a["packageName"] ?? a["package"] ?? ""),
      appLabel: String(a["appLabel"] ?? a["label"] ?? a["packageName"] ?? ""),
      appVersion: typeof a["appVersion"] === "string" ? a["appVersion"] : undefined,
      apkPath: typeof a["apkPath"] === "string" ? a["apkPath"] : undefined,
      icon: typeof a["icon"] === "string" ? a["icon"] : undefined,
    })).filter((a) => a.packageName);

    return Response.json(apps);
  } catch (err) {
    if (err instanceof ProviderCapabilityError) {
      return Response.json({ error: "Not supported" }, { status: 501 });
    }
    if (err instanceof ProviderError) {
      return Response.json({ error: "Device offline" }, { status: 503 });
    }
    throw err;
  }
}
