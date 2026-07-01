import { describe, it, expect, beforeAll } from "vitest";
import { encrypt, decrypt } from "../crypto";

// Set a 32-byte hex key for tests
beforeAll(() => {
  process.env.ENCRYPTION_SECRET = "0".repeat(64); // 32 zero bytes as hex
});

describe("crypto", () => {
  it("round-trips a plaintext string", () => {
    const plaintext = "s3cr3t_password!";
    const ciphertext = encrypt(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it("produces a different ciphertext each call (random IV)", () => {
    const a = encrypt("same");
    const b = encrypt("same");
    expect(a).not.toBe(b);
    // Both decrypt to the same value
    expect(decrypt(a)).toBe("same");
    expect(decrypt(b)).toBe("same");
  });

  it("throws if ENCRYPTION_SECRET is missing", () => {
    const saved = process.env.ENCRYPTION_SECRET;
    delete process.env.ENCRYPTION_SECRET;
    expect(() => encrypt("x")).toThrow("ENCRYPTION_SECRET");
    process.env.ENCRYPTION_SECRET = saved;
  });

  it("throws if ENCRYPTION_SECRET has wrong length", () => {
    process.env.ENCRYPTION_SECRET = "abc";
    expect(() => encrypt("x")).toThrow();
    process.env.ENCRYPTION_SECRET = "0".repeat(64);
  });
});
