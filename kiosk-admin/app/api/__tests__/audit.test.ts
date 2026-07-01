/**
 * Tests for GET /api/audit
 * refs specs/008-audit-log
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Must be declared before vi.mock (hoisted)
vi.mock("@/lib/api-guard", () => {
  class ApiGuardError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }
  return {
    requireRole: vi.fn(),
    requireAuth: vi.fn(),
    ApiGuardError,
    guardErrorResponse: vi.fn((err: unknown) => {
      if (err instanceof ApiGuardError)
        return Response.json({ error: (err as Error).message }, { status: err.status });
      return null;
    }),
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    auditLog: { findMany: vi.fn(), count: vi.fn() },
    user: { findMany: vi.fn() },
    device: { findMany: vi.fn() },
  },
}));

import { GET } from "../audit/route";
import { requireRole } from "@/lib/api-guard";
import { db } from "@/lib/db";

const mockRequireRole = vi.mocked(requireRole);
const mockAuditFindMany = vi.mocked(db.auditLog.findMany);
const mockAuditCount = vi.mocked(db.auditLog.count);
const mockUserFindMany = vi.mocked(db.user.findMany);
const mockDeviceFindMany = vi.mocked(db.device.findMany);

const ADMIN_SESSION = { user: { id: "user-admin", role: "ADMIN", email: "admin@test.com" } };

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/audit");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString());
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireRole.mockResolvedValue(ADMIN_SESSION as never);
  mockAuditFindMany.mockResolvedValue([] as never);
  mockAuditCount.mockResolvedValue(0 as never);
  mockUserFindMany.mockResolvedValue([] as never);
  mockDeviceFindMany.mockResolvedValue([] as never);
});

describe("GET /api/audit", () => {
  it("returns 403 for VIEWER role", async () => {
    const { ApiGuardError } = await import("@/lib/api-guard");
    mockRequireRole.mockRejectedValueOnce(new ApiGuardError(403, "Forbidden"));

    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it("returns paginated results with defaults", async () => {
    const entry = {
      id: "log-1",
      userId: "user-1",
      deviceId: null,
      action: "sendCommand",
      payload: null,
      createdAt: new Date(),
    };
    mockAuditFindMany.mockResolvedValueOnce([entry] as never);
    mockAuditCount.mockResolvedValueOnce(1 as never);
    mockUserFindMany.mockResolvedValueOnce([{ id: "user-1", email: "u@test.com" }] as never);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(50);
    expect(body.entries[0].userEmail).toBe("u@test.com");
  });

  it("filters by deviceId query param", async () => {
    mockAuditFindMany.mockResolvedValueOnce([] as never);
    mockAuditCount.mockResolvedValueOnce(0 as never);

    await GET(makeRequest({ deviceId: "550e8400-e29b-41d4-a716-446655440000" }));

    const whereArg = mockAuditFindMany.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(whereArg.deviceId).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("paginates correctly", async () => {
    mockAuditFindMany.mockResolvedValueOnce([] as never);
    mockAuditCount.mockResolvedValueOnce(0 as never);

    await GET(makeRequest({ page: "3", pageSize: "10" }));

    const callArg = mockAuditFindMany.mock.calls[0]?.[0];
    expect(callArg?.skip).toBe(20); // (3-1) * 10
    expect(callArg?.take).toBe(10);
  });
});
