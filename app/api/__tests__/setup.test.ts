/**
 * Tests for POST /api/auth/setup
 * refs specs/001-auth-onboarding
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    user: { count: vi.fn(), create: vi.fn().mockResolvedValue({ id: "new-user" }) },
  },
}));

vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed-pw") },
}));

import { POST, GET } from "../auth/setup/route";
import { db } from "@/lib/db";

const mockCount = vi.mocked(db.user.count);
const mockCreate = vi.mocked(db.user.create);

function makeRequest(body: object) {
  return new Request("http://localhost/api/auth/setup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreate.mockResolvedValue({ id: "new-user" } as never);
});

describe("GET /api/auth/setup", () => {
  it("returns configured: false when no users exist", async () => {
    mockCount.mockResolvedValueOnce(0 as never);
    const res = await GET();
    const body = await res.json();
    expect(body.configured).toBe(false);
  });

  it("returns configured: true when users exist", async () => {
    mockCount.mockResolvedValueOnce(1 as never);
    const res = await GET();
    const body = await res.json();
    expect(body.configured).toBe(true);
  });
});

describe("POST /api/auth/setup", () => {
  it("creates admin user on happy path", async () => {
    mockCount.mockResolvedValueOnce(0 as never);

    const res = await POST(makeRequest({ email: "admin@example.com", password: "securepassword123" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockCreate).toHaveBeenCalledOnce();
    const createArg = mockCreate.mock.calls[0][0].data;
    expect(createArg.email).toBe("admin@example.com");
    expect(createArg.role).toBe("ADMIN");
  });

  it("returns 409 when setup already completed", async () => {
    mockCount.mockResolvedValueOnce(1 as never);

    const res = await POST(makeRequest({ email: "admin@example.com", password: "securepassword123" }));
    expect(res.status).toBe(409);
  });

  it("returns 400 for short password", async () => {
    mockCount.mockResolvedValueOnce(0 as never);

    const res = await POST(makeRequest({ email: "admin@example.com", password: "short" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("12 characters");
  });

  it("returns 400 for invalid email", async () => {
    mockCount.mockResolvedValueOnce(0 as never);

    const res = await POST(makeRequest({ email: "not-an-email", password: "securepassword123" }));
    expect(res.status).toBe(400);
  });
});
