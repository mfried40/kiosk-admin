import { db } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";
import { connect, disconnect, isConnected } from "@/lib/mqtt/client";
import { startEmbedded, stopEmbedded, isEmbeddedRunning, embeddedClientCount, getEmbeddedPort, getEmbeddedWsPort } from "@/lib/mqtt/broker";
import { requireAuth, requireRole, guardErrorResponse } from "@/lib/api-guard";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** Shape returned to the browser (passwords never included) */
export interface ConfigResponse {
  mqtt: {
    mode: "embedded" | "external";
    brokerUrl: string;
    username: string | null;
    topicPrefix: string;
    hasPassword: boolean;
    connected: boolean;
    embeddedPort: number;
    embeddedWsPort: number | null;
    embeddedRunning: boolean;
    embeddedClients: number;
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
          mode: (mqttRow.mode as "embedded" | "external") ?? "external",
          brokerUrl: mqttRow.brokerUrl,
          username: mqttRow.username,
          topicPrefix: mqttRow.topicPrefix,
          hasPassword: !!mqttRow.passwordEnc,
          connected: isConnected(),
          embeddedPort: mqttRow.embeddedPort,
          embeddedWsPort: mqttRow.embeddedWsPort ?? null,
          embeddedRunning: isEmbeddedRunning(),
          embeddedClients: embeddedClientCount(),
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
  mode: z.enum(["embedded", "external"]).optional(),
  brokerUrl: z.string().url().optional().or(z.literal("")),
  username: z.string().optional(),
  password: z.string().optional(),
  topicPrefix: z.string().min(1).optional(),
  embeddedPort: z.number().int().min(1).max(65535).optional(),
  embeddedWsPort: z.number().int().min(1).max(65535).nullable().optional(),
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
    const mode = mqtt.mode ?? "external";

    if (mode === "embedded") {
      const port   = mqtt.embeddedPort   ?? 1883;
      const wsPort = mqtt.embeddedWsPort ?? parseInt(process.env.MQTT_WS_PORT ?? "9883", 10);
      const existing = await db.mqttConfig.findFirst();
      let passwordEnc: string | null = null;
      if (mqtt.password) passwordEnc = encrypt(mqtt.password);
      else if (existing) passwordEnc = existing.passwordEnc ?? null;

      const auth =
        mqtt.username && passwordEnc
          ? { username: mqtt.username, password: decrypt(passwordEnc) }
          : undefined;

      try {
        await startEmbedded(port, auth, wsPort ?? undefined);
        // Give Aedes a tick to finish initialising before the client connects
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return Response.json({ error: `Embedded broker failed to start: ${message}` }, { status: 502 });
      }

      const data = {
        mode: "embedded",
        brokerUrl: `mqtt://localhost:${port}`,
        embeddedPort: port,
        embeddedWsPort: wsPort,
        username: mqtt.username ?? null,
        passwordEnc,
        topicPrefix: mqtt.topicPrefix ?? existing?.topicPrefix ?? "fully",
      };
      const config = existing
        ? await db.mqttConfig.update({ where: { id: existing.id }, data })
        : await db.mqttConfig.create({ data });

      try {
        await connect({ ...config, brokerUrl: `mqtt://localhost:${port}` });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return Response.json({ error: `MQTT client connection failed: ${message}` }, { status: 502 });
      }
      void writeAuditLog({ userId: session.user!.id!, action: "updateMqtt", payload: { mode: "embedded", port } });

    } else if (!mqtt.brokerUrl) {
      // Clear MQTT config and stop everything
      await stopEmbedded();
      await db.mqttConfig.deleteMany();
      disconnect();
      void writeAuditLog({ userId: session.user!.id!, action: "updateMqtt", payload: { brokerUrl: null } });

    } else {
      // External broker
      await stopEmbedded();
      const existing = await db.mqttConfig.findFirst();

      let passwordEnc: string | null | undefined;
      if (mqtt.password) {
        passwordEnc = encrypt(mqtt.password);
      } else if (existing) {
        passwordEnc = existing.passwordEnc;
      } else {
        passwordEnc = null;
      }

      const data = {
        mode: "external",
        brokerUrl: mqtt.brokerUrl,
        username: mqtt.username ?? null,
        passwordEnc,
        topicPrefix: mqtt.topicPrefix ?? "fully",
        embeddedPort: existing?.embeddedPort ?? 1883,
      };

      const config = existing
        ? await db.mqttConfig.update({ where: { id: existing.id }, data })
        : await db.mqttConfig.create({ data });

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
