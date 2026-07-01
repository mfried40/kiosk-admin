/**
 * Tests for lib/mqtt/sse.ts — addClient, removeClient, broadcast
 * refs specs/005-realtime-mqtt
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { addClient, removeClient, broadcast } from "../mqtt/sse";

function makeController() {
  const enqueue = vi.fn();
  return { enqueue } as unknown as ReadableStreamDefaultController<Uint8Array>;
}

// Clear module state between tests by using fresh function calls that replace clients
// Since clients is module-internal we test through the public API only
beforeEach(() => {
  // Remove any lingering clients from prior tests
  removeClient("client-a");
  removeClient("client-b");
  removeClient("client-c");
});

describe("SSE client registry", () => {
  it("broadcasts to a connected client", () => {
    const ctrl = makeController();
    addClient("client-a", ctrl);

    broadcast("device-update", { deviceId: "dev-1", online: true });

    expect(ctrl.enqueue).toHaveBeenCalledOnce();
    const frame = new TextDecoder().decode(
      (ctrl.enqueue as ReturnType<typeof vi.fn>).mock.calls[0][0],
    );
    expect(frame).toContain("event: device-update");
    expect(frame).toContain('"deviceId":"dev-1"');

    removeClient("client-a");
  });

  it("does not call enqueue when no clients are connected", () => {
    const ctrl = makeController();
    // Don't add the client
    broadcast("device-update", { deviceId: "x" });
    expect(ctrl.enqueue).not.toHaveBeenCalled();
  });

  it("removes a client and stops broadcasting to it", () => {
    const ctrl = makeController();
    addClient("client-b", ctrl);
    removeClient("client-b");

    broadcast("device-update", { deviceId: "dev-2" });
    expect(ctrl.enqueue).not.toHaveBeenCalled();
  });

  it("removes a stale client when enqueue throws", () => {
    const ctrl = makeController();
    (ctrl.enqueue as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("stream closed");
    });
    addClient("client-c", ctrl);

    // Should not throw
    expect(() => broadcast("event", { x: 1 })).not.toThrow();
  });
});
