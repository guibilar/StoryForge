import { describe, expect, it } from "vitest";
import { Id } from "./Id";

describe("Id", () => {
  it("creates a unique value each time", () => {
    const a = Id.create<"Test">();
    const b = Id.create<"Test">();

    expect(a.toString()).not.toBe(b.toString());
  });

  it("round-trips through fromString", () => {
    const original = Id.create<"Test">();

    const restored = Id.fromString<"Test">(original.toString());

    expect(restored.equals(original)).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(() => Id.fromString<"Test">("")).toThrow("Id cannot be empty.");
  });

  it("rejects a whitespace-only string", () => {
    expect(() => Id.fromString<"Test">("   ")).toThrow("Id cannot be empty.");
  });

  it("treats different values as not equal", () => {
    const a = Id.fromString<"Test">("aaa");
    const b = Id.fromString<"Test">("bbb");

    expect(a.equals(b)).toBe(false);
  });
});
