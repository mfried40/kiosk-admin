/**
 * Tests for lib/mqtt/handlers.ts — handleDeviceInfo, handleEvent
 * refs specs/005-realtime-mqtt
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    device: { findFirst: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    deviceStatusHistory: { create: vi.fn().mockResolvedValue({}), findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn().mockResolvedValue({}) },
  },
}));

vi.mock("@/lib/mqtt/sse", () => ({
  broadcast: vi.fn(),
}));

vi.mock("@/lib/alerts", () => ({
  evaluateAlerts: vi.fn().mockResolvedValue(undefined),
}));

import { handleDeviceInfo, handleEvent } from "../mqtt/handlers";
import { db } from "@/lib/db";
import { broadcast } from "../mqtt/sse";
import { evaluateAlerts } from "../alerts";

const mockFindFirst = vi.mocked(db.device.findFirst);
const mockHistoryCreate = vi.mocked(db.deviceStatusHistory.create);
const mockBroadcast = vi.mocked(broadcast);
const mockEvaluateAlerts = vi.mocked(evaluateAlerts);

const device = { id: "dev-1", name: "Test", provider: "FULLY_KIOSK" };

beforeEach(() => {
  vi.clearAllMocks();
  mockFindFirst.mockResolvedValue(device as never);
  mockHistoryCreate.mockResolvedValue({} as never);
});

describe("handleDeviceInfo", () => {
  it("writes a history record and broadcasts when device exists", async () => {
    const payload = Buffer.from(JSON.stringify({ batteryLevel: 75, screenOn: true, currentPage: "http://x.com" }));

    handleDeviceInfo("mqtt-dev-1", payload);
    // Give the void promise time to settle
    await new Promise((r) => setTimeout(r, 10));

    expect(mockHistoryCreate).toHaveBeenCalledOnce();
    const data = mockHistoryCreate.mock.calls[0][0].data;
    expect(data.batteryLevel).toBe(75);
    expect(data.screenOn).toBe(true);
    expect(data.currentUrl).toBe("http://x.com");
    expect(mockBroadcast).toHaveBeenCalledOnce();
  });

  it("does nothing when device is not found", async () => {
    mockFindFirst.mockResolvedValueOnce(null);

    handleDeviceInfo("unknown-device", Buffer.from("{}"));
    await new Promise((r) => setTimeout(r, 10));

    expect(mockHistoryCreate).not.toHaveBeenCalled();
  });

  it("ignores invalid JSON payload", async () => {
    handleDeviceInfo("mqtt-dev-1", Buffer.from("not json"));
    await new Promise((r) => setTimeout(r, 10));

    // findFirst is never called since JSON parse throws before async work
    expect(mockHistoryCreate).not.toHaveBeenCalled();
  });
});

describe("handleEvent", () => {
  it("calls evaluateAlerts(OFFLINE) on networkDisconnect", async () => {
    handleEvent("networkDisconnect", "mqtt-dev-1", Buffer.from(""));
    await new Promise((r) => setTimeout(r, 10));

    expect(mockEvaluateAlerts).toHaveBeenCalledWith("dev-1", "OFFLINE");
  });

  it("calls evaluateAlerts(BATTERY) on onBatteryLevelChanged", async () => {
    const payload = Buffer.from(JSON.stringify({ batteryLevel: 15 }));
    handleEvent("onBatteryLevelChanged", "mqtt-dev-1", payload);
    await new Promise((r) => setTimeout(r, 10));

    expect(mockEvaluateAlerts).toHaveBeenCalledWith("dev-1", "BATTERY", { batteryLevel: 15 });
  });

  it("ignores unknown event names", async () => {
    handleEvent("unknownEvent", "mqtt-dev-1", Buffer.from("{}"));
    await new Promise((r) => setTimeout(r, 10));

    expect(mockHistoryCreate).not.toHaveBeenCalled();
  });
});
