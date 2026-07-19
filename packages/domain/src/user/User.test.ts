import { describe, expect, it, vi } from "vitest";
import { User } from "./User";
import { UserId } from "./UserId";
import { ValidationError } from "../shared";

const validProps = { email: "user@example.com", password: "secret1" };

describe("User", () => {
  it("creates a user with a fresh id and timestamps", () => {
    const user = User.create(validProps);

    expect(user.Email).toBe(validProps.email);
    expect(user.Password).toBe(validProps.password);
    expect(user.CreatedAt).toBeInstanceOf(Date);
    expect(user.UpdatedAt).toBeInstanceOf(Date);
  });

  it("rehydrates preserving the given id and timestamps", () => {
    const id = UserId.create();
    const createdAt = new Date("2024-01-01T00:00:00Z");
    const updatedAt = new Date("2024-02-01T00:00:00Z");

    const user = User.rehydrate({
      id,
      email: validProps.email,
      password: validProps.password,
      createdAt,
      updatedAt,
    });

    expect(user.Id.equals(id)).toBe(true);
    expect(user.CreatedAt).toBe(createdAt);
    expect(user.UpdatedAt).toBe(updatedAt);
  });

  it.each(["", "   "])("rejects an empty email %j", (email) => {
    expect(() => User.create({ ...validProps, email })).toThrow(
      "Email cannot be empty.",
    );
  });

  it("rejects an email longer than 255 characters", () => {
    const email = `${"a".repeat(250)}@a.com`;

    expect(() => User.create({ ...validProps, email })).toThrow(
      "Email cannot exceed 255 characters.",
    );
  });

  it.each(["not-an-email", "missing-at.com", "no-domain@"])(
    "rejects a malformed email %j",
    (email) => {
      expect(() => User.create({ ...validProps, email })).toThrow(
        "Email format is invalid.",
      );
    },
  );

  it.each(["", "   "])("rejects an empty password %j", (password) => {
    expect(() => User.create({ ...validProps, password })).toThrow(
      "Password cannot be empty.",
    );
  });

  it("rejects a password shorter than 6 characters", () => {
    expect(() => User.create({ ...validProps, password: "abc" })).toThrow(
      "Password must be at least 6 characters long.",
    );
  });

  it("rejects a password longer than 72 bytes", () => {
    expect(() =>
      User.create({ ...validProps, password: "a".repeat(73) }),
    ).toThrow("Password cannot exceed 72 bytes.");
  });

  it("changes the email and bumps updatedAt", () => {
    const user = User.create(validProps);
    const before = user.UpdatedAt;

    // Real timers can tie in the same millisecond on a fast run — advance
    // the clock deterministically instead of racing a real setTimeout.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(before.getTime() + 1));
    try {
      user.changeEmail("new@example.com");
    } finally {
      vi.useRealTimers();
    }

    expect(user.Email).toBe("new@example.com");
    expect(user.UpdatedAt.getTime()).toBeGreaterThan(before.getTime());
  });

  it("rejects changing to an invalid email", () => {
    const user = User.create(validProps);

    expect(() => user.changeEmail("invalid")).toThrow(ValidationError);
  });

  it("normalizes email casing and surrounding whitespace so two differently-cased addresses can't both register", () => {
    const user = User.create({ ...validProps, email: "  User@Example.com  " });

    expect(user.Email).toBe("user@example.com");
  });

  it("normalizes casing on changeEmail too", () => {
    const user = User.create(validProps);

    user.changeEmail("New@Example.com");

    expect(user.Email).toBe("new@example.com");
  });
});

describe("User.validatePlainPassword", () => {
  it("rejects empty, too-short, and too-long raw passwords", () => {
    expect(() => User.validatePlainPassword("")).toThrow(
      "Password cannot be empty.",
    );
    expect(() => User.validatePlainPassword("abc")).toThrow(
      "Password must be at least 6 characters long.",
    );
    expect(() => User.validatePlainPassword("a".repeat(73))).toThrow(
      "Password cannot exceed 72 bytes.",
    );
  });

  it("rejects a password within the 72-character limit but over 72 bytes once encoded", () => {
    // "é" is 2 bytes in UTF-8, so 72 of them is 144 bytes despite being 72 chars.
    expect(() => User.validatePlainPassword("é".repeat(72))).toThrow(
      "Password cannot exceed 72 bytes.",
    );
  });

  it("accepts a valid raw password", () => {
    expect(() => User.validatePlainPassword("secret1")).not.toThrow();
  });
});
