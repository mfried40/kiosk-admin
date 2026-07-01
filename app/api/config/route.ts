import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { connect, disconnect, isConnected } from "@/lib/mqtt/client";
import { requireAuth, requireRole, guardErrorResponse } from "@/lib/api-guard";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** Shape returned to the browser (passwords never included) */
export interface ConfigResponse {
  mqtt: {
    brokerUrl: string;
    username: string | null;
    topicPrefix: string;
    hasPassword: boolean;
    connected: boolean;
  } | null;
  retentionDays: number;
  smtp: {
    host: string | null;
    port: number | null;
    user: string | null;
    hasPassword: boolean;
    fromEmail: string | null;
  };
}

export async function GET(): Promise<Response> {
  try {
    await requireAuth();
  } catch (e) {
    return guardErrorResponse(e) ?? Response.json({ error: "Unknown error" }, { status: 500 });
  }

  const [mqttRow, appConfig] = await Promise.all([
    db.mqttConfig.findFirst(),
    db.appConfig.findFirst({
      select: {
        retentionDays: true,
        smtpHost: true,
        smtpPort: true,
        smtpUser: true,
        smtpPassEnc: true,
        alertFromEmail: true,
      },
    }),
  ]);

  const payload: ConfigResponse = {
    mqtt: mqttRow
      ? {
          brokerUrl: mqttRow.brokerUrl,
          username: mqttRow.username,
          topicPrefix: mqttRow.topicPrefix,
          hasPassword: !!mqttRow.passwordEnc,
          connected: isConnected(),
        }
      : null,
    retentionDays: appConfig?.retentionDays ?? 7,
    smtp: {
      host: appConfig?.smtpHost ?? null,
      port: appConfig?.smtpPort ?? null,
      user: appConfig?.smtpUser ?? null,
      hasPassword: !!appConfig?.smtpPassEnc,
      fromEmail: appConfig?.alertFromEmail ?? null,
    },
  };

  return Response.json(payload);
}

const mqttSchema = z.object({
  brokerUrl: z.string().url().optional().or(z.literal("")),
  username: z.string().optional(),
  password: z.string().optional(),
  topicPrefix: z.string().min(1).optional(),
});

const smtpSchema = z.object({
  host: z.string().optional().nullable(),
  port: z.number().int().min(1).max(65535).optional().nullable(),
  user: z.string().optional().nullable(),
  password: z.string().optional(),
  fromEmail: z.string().email().optional().nullable(),
});

const putSchema = z.object({
  mqtt: mqttSchema.optional(),
  retentionDays: z.number().int().min(1).max(365).optional(),
  smtp: smtpSchema.optional(),
});

export async function PUT(req: Request): Promise<Response> {
  let session;
  try {
    session = await requireRole("ADMIN");
  } catch (e) {
    return guardErrorResponse(e) ?? Response.json({ error: "Unknown error" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 422 });
  }

  const { mqtt, retentionDays, smtp } = parsed.data;

  if (retentionDays !== undefined) {
    const existing = await db.appConfig.findFirst();
    if (existing) {
      await db.appConfig.update({ where: { id: existing.id }, data: { retentionDays } });
    } else {
      await db.appConfig.create({ data: { retentionDays } });
    }
  }

  if (smtp !== undefined) {
    const existing = await db.appConfig.findFirst();
    const smtpPassEnc =
      smtp.password ? encrypt(smtp.password) :
      existing?.smtpPassEnc ?? null;
    const smtpData = {
      smtpHost: smtp.host ?? null,
      smtpPort: smtp.port ?? null,
      smtpUser: smtp.user ?? null,
      smtpPassEnc,
      alertFromEmail: smtp.fromEmail ?? null,
    };
    if (existing) {
      await db.appConfig.update({ where: { id: existing.id }, data: smtpData });
    } else {
      await db.appConfig.create({ data: smtpData });
    }
    void writeAuditLog({ userId: session.user!.id!, action: "updateSmtp", payload: { host: smtp.host } });
  }

  if (mqtt !== undefined) {
    if (!mqtt.brokerUrl) {
      // Clear MQTT config and disconnect
      await db.mqttConfig.deleteMany();
      disconnect();
      void writeAuditLog({ userId: session.user!.id!, action: "updateMqtt", payload: { brokerUrl: null } });
    } else {
      // Upsert config
      const existing = await db.mqttConfig.findFirst();

      let passwordEnc: string | null | undefined;
      if (mqtt.password) {
        passwordEnc = encrypt(mqtt.password);
      } else if (existing) {
        // Keep existing password if not provided
        passwordEnc = existing.passwordEnc;
      } else {
        passwordEnc = null;
      }

      const data = {
        brokerUrl: mqtt.brokerUrl,
        username: mqtt.username ?? null,
        passwordEnc,
        topicPrefix: mqtt.topicPrefix ?? "fully",
      };

      const config = existing
        ? await db.mqttConfig.update({ where: { id: existing.id }, data })
        : await db.mqttConfig.create({ data });

      // Attempt to connect with new config
      try {
        await connect(config);
        void writeAuditLog({ userId: session.user!.id!, action: "updateMqtt", payload: { brokerUrl: mqtt.brokerUrl } });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return Response.json({ error: `Broker connection failed: ${message}` }, { status: 502 });
      }
    }
  }

  return new Response(null, { status: 204 });
}
