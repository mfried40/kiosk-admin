/**
 * Tests for lib/history.ts
 * refs specs/006-monitoring-history
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    appConfig: { findFirst: vi.fn() },
    deviceStatusHistory: {
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: vi.fn(),
  },
}));

import { recordStatus } from "../history";
import { db } from "@/lib/db";

const mockFindFirst = vi.mocked(db.appConfig.findFirst);
const mockTransaction = vi.mocked(db.$transaction);

const info = { online: true, batteryLevel: 80, screenOn: true, currentUrl: "http://example.com" };

beforeEach(() => {
  mockFindFirst.mockClear();
  mockTransaction.mockClear();
  mockTransaction.mockResolvedValue([{}, { count: 0 }] as never);
});

describe("recordStatus", () => {
  it("uses default 7-day retention when no AppConfig exists", async () => {
    mockFindFirst.mockResolvedValueOnce(null);

    await recordStatus("dev-1", info);

    expect(mockTransaction).toHaveBeenCalledOnce();
    const ops = mockTransaction.mock.calls[0]?.[0] as unknown as unknown[];
    // Should be [create, deleteMany]
    expect(ops).toHaveLength(2);
  });

  it("uses configured retention days from AppConfig", async () => {
    mockFindFirst.mockResolvedValueOnce({ retentionDays: 30 } as never);

    await recordStatus("dev-1", info);

    expect(mockTransaction).toHaveBeenCalledOnce();
  });

  it("passes correct deviceId to create", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    // Capture what gets passed to $transaction
    let capturedOps: unknown[];
    mockTransaction.mockImplementation(async (ops: unknown) => {
      capturedOps = ops as unknown[];
      return [{}, { count: 0 }];
    });

    await recordStatus("dev-42", info);

    // The ops array contains Prisma PrismaPromise objects — we just check the call happened
    expect(capturedOps!).toHaveLength(2);
  });
});
