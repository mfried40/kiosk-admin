import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FreeKioskProvider } from "../providers/free-kiosk";
import { ProviderCapabilityError, ProviderError } from "../provider.types";
import type { Device } from "../generated/prisma/client";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Minimal Device fixture with a plaintext password (pre-encrypted form). */
function makeDevice(overrides: Partial<Device> = {}): Device {
  return {
    id: "dev-1",
    name: "Test Device",
    ipAddress: "192.168.1.50",
    port: 8080,
    provider: "FREE_KIOSK",
    passwordEnc: null,       // no API key by default
    passwordHash: "",
    description: null,
    mqttDeviceId: null,
    groupId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Device;
}

/** Spy on global fetch and return a canned JSON response. */
function mockFetch(body: unknown, status = 200) {
  return vi.spyOn(global, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

/** Spy on global fetch and return binary data. */
function mockFetchBinary(data: Uint8Array, status = 200) {
  return vi.spyOn(global, "fetch").mockResolvedValueOnce(
    new Response(data.buffer as ArrayBuffer, { status, headers: { "Content-Type": "image/png" } }),
  );
}

const provider = new FreeKioskProvider();

// ── getDeviceInfo ─────────────────────────────────────────────────────────────

describe("FreeKioskProvider.getDeviceInfo", () => {
  afterEach(() => vi.restoreAllMocks());

  it("maps /api/status + /api/info to DeviceInfo", async () => {
    const statusPayload = {
      data: {
        battery: { level: 85, charging: true },
        screen: { on: true },
        webview: { currentUrl: "https://example.com" },
        device: { model: "SM-T510", android: "11" },
        storage: { totalMB: 32000, availableMB: 15000 },
      },
    };
    const infoPayload = { data: { version: "1.2.11" } };

    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(statusPayload), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(infoPayload), { status: 200 }));

    const info = await provider.getDeviceInfo(makeDevice());

    expect(info.online).toBe(true);
    expect(info.batteryLevel).toBe(85);
    expect(info.screenOn).toBe(true);
    expect(info.currentUrl).toBe("https://example.com");
    expect(info.deviceModel).toBe("SM-T510");
    expect(info.androidVersion).toBe("11");
    expect(info.appVersion).toBe("1.2.11");
    expect(info.storageTotal).toBe(32000 * 1_048_576);
    expect(info.storageFree).toBe(15000 * 1_048_576);
  });

  it("still returns DeviceInfo when /api/info fails", async () => {
    const statusPayload = { data: { battery: { level: 50 } } };
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(statusPayload), { status: 200 }))
      .mockRejectedValueOnce(new Error("network error"));

    const info = await provider.getDeviceInfo(makeDevice());
    expect(info.online).toBe(true);
    expect(info.appVersion).toBeUndefined();
  });

  it("throws ProviderError when /api/status returns non-2xx", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    await expect(provider.getDeviceInfo(makeDevice())).rejects.toBeInstanceOf(ProviderError);
  });

  it("throws ProviderError(503) on timeout", async () => {
    vi.spyOn(global, "fetch").mockImplementation(
      () => new Promise((_, reject) => {
        const err = new Error("aborted");
        err.name = "AbortError";
        reject(err);
      }),
    );

    const err = await provider.getDeviceInfo(makeDevice()).catch((e) => e) as ProviderError;
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.status).toBe(503);
  });
});

// ── getScreenshot ─────────────────────────────────────────────────────────────

describe("FreeKioskProvider.getScreenshot", () => {
  afterEach(() => vi.restoreAllMocks());

  it("calls GET /api/screenshot and returns a Buffer", async () => {
    const data = new Uint8Array([137, 80, 78, 71]); // PNG magic bytes
    const spy = mockFetchBinary(data);

    const buf = await provider.getScreenshot(makeDevice());

    expect(spy).toHaveBeenCalledWith(
      "http://192.168.1.50:8080/api/screenshot",
      expect.objectContaining({ method: "GET" }),
    );
    expect(Buffer.isBuffer(buf)).toBe(true);
  });
});

// ── getCamshot ────────────────────────────────────────────────────────────────

describe("FreeKioskProvider.getCamshot", () => {
  afterEach(() => vi.restoreAllMocks());

  it("calls /api/camera/photo without query params when none provided", async () => {
    const spy = mockFetchBinary(new Uint8Array([0xff, 0xd8]));
    await provider.getCamshot(makeDevice());
    expect(spy.mock.calls[0][0]).toBe("http://192.168.1.50:8080/api/camera/photo");
  });

  it("appends camera and quality query params when provided", async () => {
    const spy = mockFetchBinary(new Uint8Array([0xff, 0xd8]));
    await provider.getCamshot(makeDevice(), { camera: "front", quality: "60" });
    expect(spy.mock.calls[0][0]).toContain("camera=front");
    expect(spy.mock.calls[0][0]).toContain("quality=60");
  });
});

// ── sendCommand ───────────────────────────────────────────────────────────────

describe("FreeKioskProvider.sendCommand", () => {
  afterEach(() => vi.restoreAllMocks());

  const cases: Array<[string, Record<string, string> | undefined, string, "GET" | "POST", unknown]> = [
    ["screenOn",        undefined,                      "/api/screen/on",        "POST", undefined],
    ["screenOff",       undefined,                      "/api/screen/off",       "POST", undefined],
    ["reload",          undefined,                      "/api/reload",           "POST", undefined],
    ["clearCache",      undefined,                      "/api/clearCache",       "POST", undefined],
    ["restartApp",      undefined,                      "/api/restart-ui",       "POST", undefined],
    ["startScreensaver",undefined,                      "/api/screensaver/on",   "POST", undefined],
    ["stopScreensaver", undefined,                      "/api/screensaver/off",  "POST", undefined],
    ["wake",            undefined,                      "/api/wake",             "POST", undefined],
    ["stopMedia",       undefined,                      "/api/audio/stop",       "POST", undefined],
    ["beep",            undefined,                      "/api/audio/beep",       "POST", undefined],
    ["reboot",          undefined,                      "/api/reboot",           "POST", undefined],
    ["lock",            undefined,                      "/api/lock",             "POST", undefined],
    ["disableAutoBrightness", undefined,                "/api/autoBrightness/disable", "POST", undefined],
  ];

  it.each(cases)('sendCommand("%s") calls POST %s', async (cmd, params, expectedPath) => {
    const spy = mockFetch({ success: true });
    await provider.sendCommand(makeDevice(), cmd, params);
    expect(spy.mock.calls[0][0]).toBe(`http://192.168.1.50:8080${expectedPath}`);
    expect((spy.mock.calls[0][1] as RequestInit).method).toBe("POST");
  });

  it('sendCommand("loadUrl") sends correct body', async () => {
    const spy = mockFetch({ success: true });
    await provider.sendCommand(makeDevice(), "loadUrl", { url: "https://example.com" });
    const body = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string) as unknown;
    expect(body).toEqual({ url: "https://example.com" });
  });

  it('sendCommand("textToSpeech") includes language when provided', async () => {
    const spy = mockFetch({ success: true });
    await provider.sendCommand(makeDevice(), "textToSpeech", { text: "Hello", language: "fr" });
    const body = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string) as unknown;
    expect(body).toEqual({ text: "Hello", language: "fr" });
  });

  it('sendCommand("textToSpeech") omits language key when not provided', async () => {
    const spy = mockFetch({ success: true });
    await provider.sendCommand(makeDevice(), "textToSpeech", { text: "Hello" });
    const body = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string) as Record<string, unknown>;
    expect(body.language).toBeUndefined();
  });

  it('sendCommand("setVolume") sends { value } body', async () => {
    const spy = mockFetch({ success: true });
    await provider.sendCommand(makeDevice(), "setVolume", { level: "75" });
    const body = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string) as unknown;
    expect(body).toEqual({ value: 75 });
  });

  it('sendCommand("startApplication") sends { package } body', async () => {
    const spy = mockFetch({ success: true });
    await provider.sendCommand(makeDevice(), "startApplication", { package: "com.example.app" });
    const body = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string) as unknown;
    expect(body).toEqual({ package: "com.example.app" });
  });

  it('sendCommand("injectJS") sends { code } body', async () => {
    const spy = mockFetch({ success: true });
    await provider.sendCommand(makeDevice(), "injectJS", { code: "alert(1)" });
    const body = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string) as unknown;
    expect(body).toEqual({ code: "alert(1)" });
  });

  it('sendCommand("toast") sends { text } body', async () => {
    const spy = mockFetch({ success: true });
    await provider.sendCommand(makeDevice(), "toast", { text: "Hi!" });
    const body = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string) as unknown;
    expect(body).toEqual({ text: "Hi!" });
  });

  it('sendCommand("setBrightness") sends { value } body', async () => {
    const spy = mockFetch({ success: true });
    await provider.sendCommand(makeDevice(), "setBrightness", { value: "80" });
    const body = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string) as unknown;
    expect(body).toEqual({ value: 80 });
  });

  it("throws ProviderCapabilityError for unknown command", async () => {
    await expect(
      provider.sendCommand(makeDevice(), "unknownCmd"),
    ).rejects.toBeInstanceOf(ProviderCapabilityError);
  });
});

// ── Unsupported methods ───────────────────────────────────────────────────────

describe("FreeKioskProvider unsupported methods", () => {
  const dev = makeDevice();

  it("getSettings throws ProviderCapabilityError", () => {
    expect(() => provider.getSettings(dev)).toThrow(ProviderCapabilityError);
  });
  it("setSetting throws ProviderCapabilityError", () => {
    expect(() => provider.setSetting(dev, "k", "v")).toThrow(ProviderCapabilityError);
  });
  it("setBooleanSetting throws ProviderCapabilityError", () => {
    expect(() => provider.setBooleanSetting(dev, "k", true)).toThrow(ProviderCapabilityError);
  });
  it("getFiles throws ProviderCapabilityError", () => {
    expect(() => provider.getFiles(dev, "/")).toThrow(ProviderCapabilityError);
  });
  it("getLogs throws ProviderCapabilityError", () => {
    expect(() => provider.getLogs(dev)).toThrow(ProviderCapabilityError);
  });
  it("getLogcat throws ProviderCapabilityError", () => {
    expect(() => provider.getLogcat(dev)).toThrow(ProviderCapabilityError);
  });
});

// ── Authentication ────────────────────────────────────────────────────────────

describe("FreeKioskProvider authentication", () => {
  afterEach(() => vi.restoreAllMocks());

  it("omits X-Api-Key header when device has no password", async () => {
    const spy = mockFetch({ success: true });
    await provider.sendCommand(makeDevice({ passwordEnc: undefined }), "reload");
    const headers = (spy.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers["X-Api-Key"]).toBeUndefined();
  });

  it("sends X-Api-Key header when device password decrypts successfully", async () => {
    // encrypt("secret-key") with test ENCRYPTION_SECRET
    // Instead of depending on real crypto, mock the decrypt module
    const { decrypt: origDecrypt } = await import("../crypto");
    const decryptSpy = vi.spyOn(await import("../crypto"), "decrypt").mockReturnValue("secret-key");

    const spy = mockFetch({ success: true });
    await provider.sendCommand(makeDevice({ passwordEnc: "encrypted-blob" }), "reload");

    const headers = (spy.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers["X-Api-Key"]).toBe("secret-key");

    decryptSpy.mockRestore();
    void origDecrypt; // avoid unused warning
  });
});
