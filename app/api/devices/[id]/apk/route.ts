/**
 * POST   /api/devices/[id]/apk  — install an APK from a URL
 * DELETE /api/devices/[id]/apk  — uninstall an app by package name
 * GET    /api/devices/[id]/apk  — get the state of the last APK install operation
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole, guardErrorResponse } from "@/lib/api-guard";
import { getProvider, assertCapability } from "@/lib/providers";
import { ProviderCapabilityError, ProviderError } from "@/lib/provider.types";
import { writeAuditLog } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

const InstallSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  /** Force install even if the same version is already installed */
  forceInstall: z.boolean().optional(),
});

const UninstallSchema = z.object({
  package: z.string().min(1, "Package name is required"),
});

export async function GET(_req: NextRequest, { params }: Params): Promise<Response> {
  let session;
  try {
    session = await requireRole("ADMIN");
  } catch (err) {
    return guardErrorResponse(err) ?? Response.json({ error: "Unknown error" }, { status: 500 });
  }

  void session;

  const { id } = await params;
  const device = await db.device.findUnique({ where: { id } });
  if (!device) return Response.json({ error: "Not found" }, { status: 404 });

  try {
    assertCapability(device.provider, "hasApkManagement");
    const provider = getProvider(device.provider);
    const result = await provider.sendCommand(device, "getInstallApkState");
    return Response.json(result);
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

export async function POST(req: NextRequest, { params }: Params): Promise<Response> {
  let session;
  try {
    session = await requireRole("ADMIN");
  } catch (err) {
    return guardErrorResponse(err) ?? Response.json({ error: "Unknown error" }, { status: 500 });
  }

  const { id } = await params;
  const device = await db.device.findUnique({ where: { id } });
  if (!device) return Response.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = InstallSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 },
    );
  }

  try {
    assertCapability(device.provider, "hasApkManagement");
    const provider = getProvider(device.provider);

    const extra: Record<string, string> = { url: parsed.data.url };
    if (parsed.data.forceInstall !== undefined) {
      extra["forceInstall"] = String(parsed.data.forceInstall);
    }

    await provider.sendCommand(device, "loadApkFile", extra);

    writeAuditLog({
      userId: session.user!.id!,
      action: "installApk",
      deviceId: id,
      payload: { url: parsed.data.url, forceInstall: String(parsed.data.forceInstall ?? false) },
    });

    return Response.json({ ok: true });
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

export async function DELETE(req: NextRequest, { params }: Params): Promise<Response> {
  let session;
  try {
    session = await requireRole("ADMIN");
  } catch (err) {
    return guardErrorResponse(err) ?? Response.json({ error: "Unknown error" }, { status: 500 });
  }

  const { id } = await params;
  const device = await db.device.findUnique({ where: { id } });
  if (!device) return Response.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = UninstallSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 },
    );
  }

  try {
    assertCapability(device.provider, "hasApkManagement");
    const provider = getProvider(device.provider);
    await provider.sendCommand(device, "uninstallApp", { package: parsed.data.package });

    writeAuditLog({
      userId: session.user!.id!,
      action: "uninstallApp",
      deviceId: id,
      payload: { package: parsed.data.package },
    });

    return Response.json({ ok: true });
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
