/**
 * Singleton MQTT client for the kiosk-admin server.
 * One connection is maintained per server process regardless of browser tab count.
 */

import mqtt, { type MqttClient } from "mqtt";
import type { MqttConfig } from "../generated/prisma/client";
import { decrypt } from "../crypto";
import { registerHandlers } from "./handlers";

let client: MqttClient | null = null;
let activeConfig: MqttConfig | null = null;

export function isConnected(): boolean {
  return client !== null && client.connected;
}

export function getActiveConfig(): MqttConfig | null {
  return activeConfig;
}

export async function connect(config: MqttConfig): Promise<void> {
  // Disconnect any existing connection first
  if (client) {
    client.end(true);
    client = null;
    activeConfig = null;
  }

  const options: mqtt.IClientOptions = {
    clientId: `kiosk-admin-${Date.now()}`,
    clean: true,
    reconnectPeriod: 5_000,
  };

  if (config.username) {
    options.username = config.username;
  }
  if (config.passwordEnc) {
    options.password = decrypt(config.passwordEnc);
  }

  return new Promise((resolve, reject) => {
    const mqttClient = mqtt.connect(config.brokerUrl, options);

    mqttClient.once("connect", () => {
      client = mqttClient;
      activeConfig = config;
      console.log(`[MQTT] Connected to ${config.brokerUrl} (prefix: ${config.topicPrefix})`);
      registerHandlers(mqttClient, config.topicPrefix);
      resolve();
    });

    mqttClient.once("error", (err) => {
      console.error("[MQTT] Connection error:", err);
      mqttClient.end(true);
      reject(err);
    });
  });
}

export function disconnect(): void {
  if (client) {
    client.end(true);
    client = null;
    activeConfig = null;
  }
}

/**
 * Publish a raw payload to a topic. Returns false if no broker is connected.
 */
export function publish(topic: string, payload: string): boolean {
  if (!client?.connected) return false;
  client.publish(topic, payload, { qos: 0 });
  return true;
}

/**
 * Publish a command to a device via MQTT.
 * Topic: {prefix}/cmd/{mqttDeviceId}
 * Payload: JSON { cmd, ...params }
 *
 * Returns false if the broker is not connected.
 */
export function publishCommand(
  mqttDeviceId: string,
  prefix: string,
  cmd: string,
  params?: Record<string, string>,
): boolean {
  const topic = `${prefix}/cmd/${mqttDeviceId}`;
  const payload = JSON.stringify({ cmd, ...params });
  return publish(topic, payload);
}

/**
 * Called once on server cold-start to reconnect if a config row exists in DB.
 * Uses a dynamic import of db to avoid circular dependency issues at module load time.
 */
export async function autoConnect(): Promise<void> {
  try {
    const { db } = await import("../db");
    const config = await db.mqttConfig.findFirst();
    if (config) {
      console.log("[MQTT] Auto-connecting to broker on startup…");
      await connect(config);
    } else {
      console.log("[MQTT] No broker config found — skipping auto-connect.");
    }
  } catch (err) {
    // Auto-connect is best-effort; log and continue
    console.error("[MQTT] Auto-connect failed:", err);
  }
}

// Kick off auto-connect when this module is first loaded by any route.
void autoConnect();
