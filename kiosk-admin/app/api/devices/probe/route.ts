/**
 * POST /api/devices/probe
 * Probes a device's REST API and returns its deviceId (and friendly info)
 * without requiring the device to be saved in the database first.
 * Used by the Add Device form to auto-populate the MQTT Device ID field.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { requireAuth, guardErrorResponse } from "@/lib/api-guard";
import { Provider } from "@/lib/generated/prisma/client";

const ProbeSchema = z.object({
  ipAddress: z.string().min(1),
  port: z.number().int().min(1).max(65535).optional(),
  password: z.string().optional(),
  provider: z.nativeEnum(Provider),
  /** Existing device ID — if provided, the stored encrypted password is used instead. */
  existingDeviceId: z.string().uuid().optional(),
});

const TIMEOUT_MS = 8_000;

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
  } catch (err) {
    return guardErrorResponse(err) ?? Response.json({ error: "Unknown error" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ProbeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
  }

  const { ipAddress, port, password, provider, existingDeviceId } = parsed.data;

  // Resolve the password: prefer the form value, fall back to the stored encrypted password.
  let resolvedPassword = password;
  if (!resolvedPassword && existingDeviceId) {
    const device = await db.device.findUnique({ where: { id: existingDeviceId }, select: { passwordEnc: true } });
    if (device?.passwordEnc) resolvedPassword = decrypt(device.passwordEnc);
  }

  // ── Fully Cloud: list all devices on the account ─────────────────────────
  if (provider === "FULLY_CLOUD") {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const url = new URL("https://api.fully-kiosk.com/cloud/devices");
      url.searchParams.set("apiemail", ipAddress); // ipAddress field holds email for cloud
      url.searchParams.set("apikey", resolvedPassword ?? "");
      const res = await fetch(url.toString(), { signal: controller.signal });

      const text = await res.text();

      if (!res.ok) {
        // Try to extract a friendly error from the response body
        try {
          const errData = JSON.parse(text) as Record<string, unknown>;
          if (errData.statustext) return Response.json({ error: String(errData.statustext) }, { status: 502 });
        } catch { /* ignore */ }
        return Response.json({ error: `Fully Cloud returned ${res.status}` }, { status: 502 });
      }

      let data: unknown;
      try { data = JSON.parse(text); } catch {
        return Response.json({ error: "Non-JSON response from Fully Cloud", raw: text.slice(0, 200) }, { status: 502 });
      }

      // Handle error object (200 with error body)
      if (data && !Array.isArray(data) && typeof data === "object") {
        const obj = data as Record<string, unknown>;
        if (obj.status === "Error") {
          return Response.json({ error: String(obj.statustext ?? "Fully Cloud error") }, { status: 401 });
        }
        // Fully Cloud wraps results: { status, devices: [...] }
        if (Array.isArray(obj.devices)) data = obj.devices;
        else {
          return Response.json({ error: "Unexpected response shape", rawKeys: Object.keys(obj) }, { status: 502 });
        }
      }

      if (!Array.isArray(data)) {
        return Response.json({ error: "Expected an array from Fully Cloud" }, { status: 502 });
      }

      const devices = (data as Record<string, unknown>[]).map((item) => ({
        devid: String(item.devid ?? item.deviceId ?? item.id ?? ""),
        deviceName: String(item.alias ?? item.deviceAlias ?? item.deviceName ?? item.name ?? ""),
        online: Number(item.lastHeartbeatAge) < 5, // age in minutes
      })).filter((d) => d.devid);

      return Response.json({ cloudDevices: devices });
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") {
        return Response.json({ error: "Fully Cloud timed out" }, { status: 504 });
      }
      return Response.json({ error: "Could not reach Fully Cloud" }, { status: 502 });
    } finally {
      clearTimeout(timer);
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    let res: Response;

    if (provider === "FULLY_KIOSK") {
      const url = new URL(`http://${ipAddress}:${port ?? 2323}/`);
      url.searchParams.set("cmd", "getDeviceInfo");
      url.searchParams.set("type", "json");
      if (resolvedPassword) url.searchParams.set("password", resolvedPassword);
      res = await fetch(url.toString(), { signal: controller.signal });
    } else {
      // FREE_KIOSK
      const headers: Record<string, string> = {};
      if (resolvedPassword) headers["X-Api-Key"] = resolvedPassword;
      res = await fetch(`http://${ipAddress}:${port ?? 8080}/info`, {
        headers,
        signal: controller.signal,
      });
    }

    if (!res.ok) {
      return Response.json({ error: `Device returned ${res.status}` }, { status: 502 });
    }

    const data = (await res.json()) as Record<string, unknown>;

    // Fully Kiosk returns { status: "Error", statustext: "..." } on auth failure
    if (typeof data.status === "string" && data.status !== "OK" && data.statustext) {
      return Response.json({ error: String(data.statustext) }, { status: 401 });
    }

    // Fully Kiosk uses several possible field names depending on version/context
    const deviceId =
      typeof data.deviceId === "string" ? data.deviceId :
      typeof data.androidId === "string" ? data.androidId :
      typeof data.deviceID === "string" ? data.deviceID :
      typeof data.id === "string" ? data.id : undefined;

    const deviceName =
      typeof data.deviceName === "string" ? data.deviceName :
      typeof data.deviceLabel === "string" ? data.deviceLabel : undefined;
    const deviceModel =
      typeof data.model === "string" ? data.model :
      typeof data.deviceModel === "string" ? data.deviceModel : undefined;

    // If still no ID, return the available keys so the caller can diagnose
    if (!deviceId) {
      return Response.json({
        error: "No device ID returned",
        availableFields: Object.keys(data),
      }, { status: 422 });
    }

    return Response.json({ deviceId, deviceName, deviceModel });
  } catch (err) {
    if ((err as { name?: string }).name === "AbortError") {
      return Response.json({ error: "Device timed out" }, { status: 504 });
    }
    return Response.json({ error: "Could not reach device" }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
