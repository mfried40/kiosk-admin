/**
 * Tests for POST /api/devices/[id]/command
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
  db: { device: { findUnique: vi.fn() } },
}));

vi.mock("@/lib/providers", () => ({
  getProvider: vi.fn(),
  assertCapability: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "../devices/[id]/command/route";
import { requireRole } from "@/lib/api-guard";
import { db } from "@/lib/db";
import { getProvider, assertCapability } from "@/lib/providers";
import { ProviderCapabilityError, ProviderError } from "@/lib/provider.types";

const mockRequireRole = vi.mocked(requireRole);
const mockFindUnique = vi.mocked(db.device.findUnique);
const mockGetProvider = vi.mocked(getProvider);
const mockAssertCapability = vi.mocked(assertCapability);

const ADMIN_SESSION = { user: { id: "user-admin", role: "ADMIN" } };

const fullyDevice = {
  id: "dev-1",
  name: "Test Device",
  provider: "FULLY_KIOSK" as const,
  ipAddress: "192.168.1.10",
  port: 2323,
  password: "enc:xxx",
  online: true,
};

function makeRequest(body: object) {
  return new Request("http://localhost/api/devices/dev-1/command", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as import("next/server").NextRequest;
}

function makeParams(id = "dev-1") {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireRole.mockResolvedValue(ADMIN_SESSION as never);
  mockFindUnique.mockResolvedValue(fullyDevice as never);
  mockAssertCapability.mockReturnValue(undefined);
});

describe("POST /api/devices/[id]/command", () => {
  it("returns 403 for VIEWER", async () => {
    const { ApiGuardError } = await import("@/lib/api-guard");
    mockRequireRole.mockRejectedValueOnce(new ApiGuardError(403, "Forbidden"));

    const res = await POST(makeRequest({ cmd: "screenOn" }), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 404 when device not found", async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    const res = await POST(makeRequest({ cmd: "screenOn" }), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 501 when provider lacks the capability", async () => {
    mockAssertCapability.mockImplementationOnce(() => {
      throw new ProviderCapabilityError("FULLY_KIOSK", "hasScreensaver");
    });

    const res = await POST(makeRequest({ cmd: "startScreensaver" }), makeParams());
    expect(res.status).toBe(501);
  });

  it("returns 200 on successful command", async () => {
    const mockSendCommand = vi.fn().mockResolvedValue("ok");
    mockGetProvider.mockReturnValue({ sendCommand: mockSendCommand } as never);

    const res = await POST(makeRequest({ cmd: "screenOn" }), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("returns 502 when provider throws ProviderError", async () => {
    const mockSendCommand = vi.fn().mockRejectedValue(new ProviderError(502, "connection refused"));
    mockGetProvider.mockReturnValue({ sendCommand: mockSendCommand } as never);

    const res = await POST(makeRequest({ cmd: "screenOn" }), makeParams());
    expect(res.status).toBe(502);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new Request("http://localhost/api/devices/dev-1/command", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    }) as import("next/server").NextRequest;

    const res = await POST(req, makeParams());
    expect(res.status).toBe(400);
  });
});
