/**
 * Tests for POST /api/devices/bulk/command
 * refs specs/004-remote-control
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-guard", () => {
  class ApiGuardError extends Error {
    status: number;
    constructor(status: number, msg: string) { super(msg); this.status = status; }
  }
  return {
    requireRole: vi.fn(),
    ApiGuardError,
    guardErrorResponse: vi.fn((err: unknown) => {
      if (err instanceof ApiGuardError)
        return Response.json({ error: (err as Error).message }, { status: err.status });
      return null;
    }),
  };
});

vi.mock("@/lib/db", () => ({
  db: { device: { findMany: vi.fn() } },
}));

vi.mock("@/lib/providers", () => ({
  getProvider: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "../devices/bulk/command/route";
import { requireRole } from "@/lib/api-guard";
import { db } from "@/lib/db";
import { getProvider } from "@/lib/providers";
import { ProviderError } from "@/lib/provider.types";

const mockRequireRole = vi.mocked(requireRole);
const mockFindMany = vi.mocked(db.device.findMany);
const mockGetProvider = vi.mocked(getProvider);

const ADMIN_SESSION = { user: { id: "user-admin", role: "ADMIN" } };

const DEV_A = { id: "550e8400-e29b-41d4-a716-446655440001", provider: "FULLY_KIOSK" };
const DEV_B = { id: "550e8400-e29b-41d4-a716-446655440002", provider: "FULLY_KIOSK" };
const DEV_C = { id: "550e8400-e29b-41d4-a716-446655440003", provider: "FREE_KIOSK" };

function makeRequest(body: object) {
  return new Request("http://localhost/api/devices/bulk/command", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as import("next/server").NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireRole.mockResolvedValue(ADMIN_SESSION as never);
});

describe("POST /api/devices/bulk/command", () => {
  it("returns 400 when devices span multiple providers", async () => {
    mockFindMany.mockResolvedValueOnce([DEV_A, DEV_C] as never);

    const res = await POST(
      makeRequest({ cmd: "screenOn", deviceIds: [DEV_A.id, DEV_C.id] }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/provider/i);
  });

  it("returns succeeded/failed split on partial failure", async () => {
    mockFindMany.mockResolvedValueOnce([DEV_A, DEV_B] as never);

    const mockSendCommand = vi
      .fn()
      .mockResolvedValueOnce("ok")
      .mockRejectedValueOnce(new ProviderError(502, "timeout"));

    mockGetProvider.mockReturnValue({ sendCommand: mockSendCommand } as never);

    const res = await POST(
      makeRequest({ cmd: "screenOn", deviceIds: [DEV_A.id, DEV_B.id] }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.succeeded).toContain(DEV_A.id);
    expect(body.failed[0].id).toBe(DEV_B.id);
    expect(body.failed[0].error).toContain("timeout");
  });

  it("returns 404 when no matching devices found", async () => {
    mockFindMany.mockResolvedValueOnce([] as never);

    const res = await POST(
      makeRequest({ cmd: "screenOn", deviceIds: [DEV_A.id] }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 for VIEWER", async () => {
    const { ApiGuardError } = await import("@/lib/api-guard");
    mockRequireRole.mockRejectedValueOnce(new ApiGuardError(403, "Forbidden"));

    const res = await POST(makeRequest({ cmd: "screenOn", deviceIds: [DEV_A.id] }));
    expect(res.status).toBe(403);
  });
});
