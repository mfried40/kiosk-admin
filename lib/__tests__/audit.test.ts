import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock is hoisted — use inline vi.fn() instead of referencing outer variables
vi.mock("@/lib/db", () => ({
  db: {
    auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
  },
}));

import { writeAuditLog } from "../audit";
import { db } from "@/lib/db";

const mockCreate = vi.mocked(db.auditLog.create);

describe("writeAuditLog", () => {
  beforeEach(() => {
    mockCreate.mockClear();
  });

  it("writes correct fields for a device action", async () => {
    await writeAuditLog({
      userId: "user-1",
      action: "sendCommand",
      deviceId: "dev-1",
      payload: { cmd: "screenOff" },
    });

    expect(mockCreate).toHaveBeenCalledOnce();
    const arg = mockCreate.mock.calls[0][0].data;
    expect(arg.userId).toBe("user-1");
    expect(arg.action).toBe("sendCommand");
    expect(arg.deviceId).toBe("dev-1");
    expect(arg.payload).toBe(JSON.stringify({ cmd: "screenOff" }));
  });

  it("sets deviceId to null for global actions", async () => {
    await writeAuditLog({ userId: "user-2", action: "updateMqtt" });

    const arg = mockCreate.mock.calls[0][0].data;
    expect(arg.deviceId).toBeNull();
  });

  it("does not throw if db.create fails", async () => {
    mockCreate.mockRejectedValueOnce(new Error("db error"));
    await expect(
      writeAuditLog({ userId: "u", action: "test" }),
    ).resolves.toBeUndefined();
  });
});
