import { describe, it, expect } from "vitest";
import { assertCapability } from "../providers";
import { Provider, ProviderCapabilityError } from "../provider.types";

describe("assertCapability", () => {
  it("does not throw when provider has the capability", () => {
    // FULLY_KIOSK supports hasScreenshot — should not throw
    expect(() =>
      assertCapability(Provider.FULLY_KIOSK, "hasScreenshot"),
    ).not.toThrow();
  });

  it("throws ProviderCapabilityError when capability is missing", () => {
    // FREE_KIOSK does not support hasApkManagement — should throw
    expect(() =>
      assertCapability(Provider.FREE_KIOSK, "hasApkManagement"),
    ).toThrow(ProviderCapabilityError);
  });

  it("error message includes the capability name", () => {
    try {
      assertCapability(Provider.FREE_KIOSK, "hasApkManagement");
    } catch (e) {
      expect(e).toBeInstanceOf(ProviderCapabilityError);
      expect((e as Error).message).toContain("hasApkManagement");
    }
  });
});
