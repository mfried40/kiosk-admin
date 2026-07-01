import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock factories are hoisted — use only inline vi.fn() inside
vi.mock("@/lib/db", () => ({
  db: {
    notification: { create: vi.fn().mockResolvedValue({ id: "notif-1" }) },
    alertRule: { findMany: vi.fn() },
    device: { findUnique: vi.fn().mockResolvedValue({ name: "Test Device" }) },
    appConfig: { findFirst: vi.fn().mockResolvedValue(null) },
  },
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn().mockReturnValue({ sendMail: vi.fn().mockResolvedValue({}) }),
  },
}));

import { evaluateAlerts } from "../alerts";
import { db } from "@/lib/db";

const mockNotificationCreate = vi.mocked(db.notification.create);
const mockAlertRuleFindMany = vi.mocked(db.alertRule.findMany);

describe("evaluateAlerts — OFFLINE", () => {
  beforeEach(() => {
    mockNotificationCreate.mockClear();
    mockAlertRuleFindMany.mockClear();
  });

  it("creates a notification when OFFLINE rule matches", async () => {
    mockAlertRuleFindMany.mockResolvedValueOnce([
      { id: "rule-1", type: "OFFLINE", threshold: null, emailEnabled: false, emailTo: null, createdAt: new Date(), deviceId: null, active: true },
    ] as never);

    await evaluateAlerts("dev-1", "OFFLINE");

    expect(mockNotificationCreate).toHaveBeenCalledOnce();
    const data = mockNotificationCreate.mock.calls[0][0].data;
    expect(data.type).toBe("OFFLINE");
    expect(data.deviceId).toBe("dev-1");
  });

  it("does nothing when no rules match", async () => {
    mockAlertRuleFindMany.mockResolvedValueOnce([]);
    await evaluateAlerts("dev-1", "OFFLINE");
    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });
});

describe("evaluateAlerts — BATTERY hysteresis", () => {
  beforeEach(() => {
    mockNotificationCreate.mockClear();
    mockAlertRuleFindMany.mockClear();
  });

  it("fires once when battery drops below threshold", async () => {
    mockAlertRuleFindMany.mockResolvedValue([
      { id: "rule-batt", type: "BATTERY", threshold: 20, emailEnabled: false, emailTo: null, createdAt: new Date(), deviceId: null, active: true },
    ] as never);

    // First call: drop below threshold
    await evaluateAlerts("dev-bat", "BATTERY", { batteryLevel: 15 });
    expect(mockNotificationCreate).toHaveBeenCalledOnce();
  });

  it("does not re-fire while battery stays below threshold (hysteresis)", async () => {
    mockAlertRuleFindMany.mockResolvedValue([
      { id: "rule-batt2", type: "BATTERY", threshold: 20, emailEnabled: false, emailTo: null, createdAt: new Date(), deviceId: null, active: true },
    ] as never);

    // First call fires
    await evaluateAlerts("dev-hyst", "BATTERY", { batteryLevel: 15 });
    mockNotificationCreate.mockClear();

    // Second call at same low level — should NOT fire again
    await evaluateAlerts("dev-hyst", "BATTERY", { batteryLevel: 10 });
    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  it("resets hysteresis when battery recovers above threshold", async () => {
    mockAlertRuleFindMany.mockResolvedValue([
      { id: "rule-batt3", type: "BATTERY", threshold: 20, emailEnabled: false, emailTo: null, createdAt: new Date(), deviceId: null, active: true },
    ] as never);

    await evaluateAlerts("dev-rec", "BATTERY", { batteryLevel: 15 });
    mockNotificationCreate.mockClear();

    // Battery recovers — clears hysteresis
    await evaluateAlerts("dev-rec", "BATTERY", { batteryLevel: 50 });
    expect(mockNotificationCreate).not.toHaveBeenCalled();

    // Now drops again — should fire
    await evaluateAlerts("dev-rec", "BATTERY", { batteryLevel: 10 });
    expect(mockNotificationCreate).toHaveBeenCalledOnce();
  });
});
