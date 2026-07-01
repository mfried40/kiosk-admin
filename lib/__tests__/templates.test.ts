import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock factories are hoisted — use only inline vi.fn() here
vi.mock("@/lib/db", () => ({
  db: {
    configTemplate: { findUniqueOrThrow: vi.fn() },
    device: { findMany: vi.fn() },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  },
}));

vi.mock("@/lib/providers", () => ({
  getProvider: vi.fn(),
}));

// Imports after mocks
import { applyTemplate } from "../templates";
import { db } from "@/lib/db";
import { getProvider } from "@/lib/providers";

// Typed references to the mock functions
const mockFindTemplate = vi.mocked(db.configTemplate.findUniqueOrThrow);
const mockFindDevices = vi.mocked(db.device.findMany);
const mockAuditCreate = vi.mocked(db.auditLog.create);
const mockGetProvider = vi.mocked(getProvider);

// Shared setSetting mock reused across calls per test
const mockSetSetting = vi.fn().mockResolvedValue(undefined);

const template = {
  id: "tmpl-1",
  name: "Test Template",
  provider: "FULLY_KIOSK",
  settings: JSON.stringify({ screenBrightness: 80, keepOn: true }),
};

const devices = [
  { id: "dev-1", name: "Device 1", provider: "FULLY_KIOSK" },
  { id: "dev-2", name: "Device 2", provider: "FULLY_KIOSK" },
];

beforeEach(() => {
  mockSetSetting.mockClear();
  mockAuditCreate.mockClear();
  mockFindDevices.mockClear();
  mockFindTemplate.mockClear();
  // Always return the same provider object with trackable setSetting
  mockGetProvider.mockReturnValue({ setSetting: mockSetSetting } as never);
});

describe("applyTemplate", () => {
  it("applies settings to all devices and returns success results", async () => {
    mockFindTemplate.mockResolvedValueOnce(template as never);
    mockFindDevices.mockResolvedValueOnce(devices as never);

    const results = await applyTemplate("tmpl-1", ["dev-1", "dev-2"], "user-1");

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.success)).toBe(true);
    // 2 settings * 2 devices = 4 setSetting calls
    expect(mockSetSetting).toHaveBeenCalledTimes(4);
    // Audit log written per device
    expect(mockAuditCreate).toHaveBeenCalledTimes(2);
  });

  it("throws provider mismatch when device provider differs from template", async () => {
    mockFindTemplate.mockResolvedValueOnce(template as never);
    mockFindDevices.mockResolvedValueOnce([
      { id: "dev-x", name: "Wrong Provider Device", provider: "FREE_KIOSK" },
    ] as never);

    await expect(
      applyTemplate("tmpl-1", ["dev-x"], "user-1"),
    ).rejects.toThrow("Provider mismatch");
  });

  it("returns partial failure when one device's setSetting fails", async () => {
    mockFindTemplate.mockResolvedValueOnce(template as never);
    mockFindDevices.mockResolvedValueOnce(devices as never);

    // Fail setSetting for dev-2, succeed for dev-1
    mockSetSetting.mockImplementation((device: { id: string }) => {
      if (device.id === "dev-2") return Promise.reject(new Error("connection refused"));
      return Promise.resolve();
    });

    const results = await applyTemplate("tmpl-1", ["dev-1", "dev-2"], "user-1");

    const succeeded = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0].error).toContain("connection refused");
  });
});
