import { describe, expect, it } from "vitest";
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

  it("rejects a password longer than 255 characters", () => {
    expect(() =>
      User.create({ ...validProps, password: "a".repeat(256) }),
    ).toThrow("Password cannot exceed 255 characters.");
  });

  it("changes the email and bumps updatedAt", async () => {
    const user = User.create(validProps);
    const before = user.UpdatedAt;

    await new Promise((resolve) => setTimeout(resolve, 5));
    user.changeEmail("new@example.com");

    expect(user.Email).toBe("new@example.com");
    expect(user.UpdatedAt.getTime()).toBeGreaterThan(before.getTime());
  });

  it("rejects changing to an invalid email", () => {
    const user = User.create(validProps);

    expect(() => user.changeEmail("invalid")).toThrow(ValidationError);
  });
});
