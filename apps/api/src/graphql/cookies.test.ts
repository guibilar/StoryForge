import { describe, expect, it, afterEach, vi } from "vitest";
import { parseCookie, serializeCookie } from "./cookies";

describe("serializeCookie", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("serializes name/value with the base security attributes", () => {
    vi.stubEnv("NODE_ENV", "test");

    expect(serializeCookie("token", "abc123")).toBe(
      "token=abc123; Path=/; HttpOnly; SameSite=Lax",
    );
  });

  it("includes Max-Age when provided", () => {
    vi.stubEnv("NODE_ENV", "test");

    expect(serializeCookie("token", "abc123", { maxAge: 3600 })).toBe(
      "token=abc123; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600",
    );
  });

  it("adds Secure in production", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(serializeCookie("token", "abc123")).toBe(
      "token=abc123; Path=/; HttpOnly; SameSite=Lax; Secure",
    );
  });
});

describe("parseCookie", () => {
  it("returns null when the header is null", () => {
    expect(parseCookie(null, "token")).toBeNull();
  });

  it("returns null when the named cookie is absent", () => {
    expect(parseCookie("other=value", "token")).toBeNull();
  });

  it("extracts the named cookie among several", () => {
    expect(parseCookie("a=1; token=abc123; b=2", "token")).toBe("abc123");
  });

  it("handles a value containing '='", () => {
    expect(parseCookie("token=abc.def=ghi", "token")).toBe("abc.def=ghi");
  });
});
