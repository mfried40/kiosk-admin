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
      registerHandlers(mqttClient, config.topicPrefix);
      resolve();
    });

    mqttClient.once("error", (err) => {
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
 * Called once on server cold-start to reconnect if a config row exists in DB.
 * Uses a dynamic import of db to avoid circular dependency issues at module load time.
 */
export async function autoConnect(): Promise<void> {
  try {
    const { db } = await import("../db");
    const config = await db.mqttConfig.findFirst();
    if (config) {
      await connect(config);
    }
  } catch (err) {
    // Auto-connect is best-effort; log and continue
    console.error("[MQTT] Auto-connect failed:", err);
  }
}
