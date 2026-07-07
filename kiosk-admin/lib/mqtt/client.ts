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

  const isLocalhost = config.brokerUrl.includes("localhost") || config.brokerUrl.includes("127.0.0.1");

  const options: mqtt.IClientOptions = {
    clientId: `kiosk-admin-${Date.now()}`,
    clean: true,
    reconnectPeriod: 5_000,
    // Use a short connect timeout for embedded broker so failures surface quickly
    connectTimeout: isLocalhost ? 5_000 : 30_000,
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
 * Publish a command to a Fully Kiosk device via MQTT.
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
 * Publish a command to a FreeKiosk device via MQTT.
 * Topic: {baseTopic}/{deviceId}/set/{entity}
 * Payload: plain string (not JSON)
 *
 * Returns false if broker is not connected or command has no mapping.
 */
export function publishFreeKioskCommand(
  mqttDeviceId: string,
  cmd: string,
  params?: Record<string, string>,
): boolean {
  // Import lazily to avoid circular dependency
  const { getFreeKioskCommandTopic, getBaseTopic } = require("./freekiosk-commands") as typeof import("./freekiosk-commands");
  const baseTopic = getBaseTopic(mqttDeviceId);
  if (!baseTopic) {
    console.warn(`[MQTT] No base topic cached for FreeKiosk device ${mqttDeviceId} — cannot route command via MQTT`);
    return false;
  }
  const mapped = getFreeKioskCommandTopic(baseTopic, mqttDeviceId, cmd, params);
  if (!mapped) return false;
  return publish(mapped.topic, mapped.payload);
}

/**
 * Called once on server cold-start to reconnect if a config row exists in DB.
 * Uses a dynamic import of db to avoid circular dependency issues at module load time.
 */
// Persist the in-progress lock across Turbopack hot reloads
const gClient = globalThis as unknown as { _mqttAutoConnecting?: boolean };

export async function autoConnect(): Promise<void> {
  // Prevent concurrent calls (module reloads fire this multiple times in dev)
  if (gClient._mqttAutoConnecting) return;
  gClient._mqttAutoConnecting = true;
  try {
    const { db } = await import("../db");
    const config = await db.mqttConfig.findFirst();
    if (!config) {
      console.log("[MQTT] No broker config found — skipping auto-connect.");
      return;
    }

    if (config.mode === "embedded") {
      const { isEmbeddedRunning, startEmbedded } = await import("./broker");
      // Already running and connected — nothing to do
      if (isEmbeddedRunning() && isConnected()) {
        console.log("[MQTT] Embedded broker already running — skipping auto-connect.");
        return;
      }
      const { decrypt } = await import("../crypto");
      const auth =
        config.username && config.passwordEnc
          ? { username: config.username, password: decrypt(config.passwordEnc) }
          : undefined;
      await startEmbedded(config.embeddedPort, auth);
      await new Promise((resolve) => setTimeout(resolve, 200));
      console.log("[MQTT] Auto-connecting client to embedded broker…");
      await connect({ ...config, brokerUrl: `mqtt://localhost:${config.embeddedPort}` });
    } else {
      if (isConnected()) return; // already connected (e.g. from a previous module load)
      console.log("[MQTT] Auto-connecting to broker on startup…");
      await connect(config);
    }
  } catch (err) {
    console.error("[MQTT] Auto-connect failed:", err);
  } finally {
    gClient._mqttAutoConnecting = false;
  }
}

// Kick off auto-connect when this module is first loaded by any route.
void autoConnect();
