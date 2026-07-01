/**
 * POST /api/devices/[id]/media
 * Controls audio and video playback on the device.
 *
 * Actions:
 *   playSound  — play an audio file from a URL
 *   stopSound  — stop current audio playback
 *   playVideo  — play a video file from a URL in fullscreen
 *   stopVideo  — stop current video playback
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole, guardErrorResponse } from "@/lib/api-guard";
import { getProvider, assertCapability } from "@/lib/providers";
import { ProviderCapabilityError, ProviderError } from "@/lib/provider.types";
import { writeAuditLog } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

const AUDIO_STREAMS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

const MediaSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("playSound"),
    url: z.string().url("Must be a valid URL"),
    loop: z.boolean().optional(),
    /** Android audio stream type (0–10). Defaults to 3 (MUSIC). */
    stream: z.number().int().min(0).max(10).optional(),
  }),
  z.object({ action: z.literal("stopSound") }),
  z.object({
    action: z.literal("playVideo"),
    url: z.string().url("Must be a valid URL"),
    loop: z.boolean().optional(),
    showControls: z.boolean().optional(),
    exitOnTouch: z.boolean().optional(),
    exitOnCompletion: z.boolean().optional(),
  }),
  z.object({ action: z.literal("stopVideo") }),
]);

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

  const parsed = MediaSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 },
    );
  }

  try {
    assertCapability(device.provider, "hasMediaPlayer");
    const provider = getProvider(device.provider);
    const { action } = parsed.data;

    let extra: Record<string, string> = {};
    if (action === "playSound") {
      extra = {
        url: parsed.data.url,
        ...(parsed.data.loop !== undefined && { loop: String(parsed.data.loop) }),
        ...(parsed.data.stream !== undefined && { stream: String(parsed.data.stream) }),
      };
    } else if (action === "playVideo") {
      extra = {
        url: parsed.data.url,
        ...(parsed.data.loop !== undefined && { loop: parsed.data.loop ? "1" : "0" }),
        ...(parsed.data.showControls !== undefined && {
          showControls: parsed.data.showControls ? "1" : "0",
        }),
        ...(parsed.data.exitOnTouch !== undefined && {
          exitOnTouch: parsed.data.exitOnTouch ? "1" : "0",
        }),
        ...(parsed.data.exitOnCompletion !== undefined && {
          exitOnCompletion: parsed.data.exitOnCompletion ? "1" : "0",
        }),
      };
    }

    await provider.sendCommand(device, action, extra);

    writeAuditLog({
      userId: session.user!.id!,
      action: `media:${action}`,
      deviceId: id,
      payload: extra,
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

// Silence the unused import — used only for the type constraint
void AUDIO_STREAMS;
