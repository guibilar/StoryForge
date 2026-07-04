import { describe, expect, it } from "vitest";
import { User } from "@storyforge/domain";
import type { User as PrismaUser } from "@storyforge/database";
import { UserMapper } from "./UserMapper";

describe("UserMapper", () => {
  it("maps a persistence record to a domain user", () => {
    const record: PrismaUser = {
      id: "11111111-1111-1111-1111-111111111111",
      email: "user@example.com",
      password: "hashed-password",
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-02-01T00:00:00Z"),
    };

    const user = UserMapper.toDomain(record);

    expect(user.Id.toString()).toBe(record.id);
    expect(user.Email).toBe(record.email);
    expect(user.Password).toBe(record.password);
    expect(user.CreatedAt).toEqual(record.createdAt);
    expect(user.UpdatedAt).toEqual(record.updatedAt);
  });

  it("maps a domain user to a persistence shape", () => {
    const user = User.create({
      email: "user@example.com",
      password: "secret1",
    });

    const record = UserMapper.toPersistence(user);

    expect(record).toEqual({
      id: user.Id.toString(),
      email: "user@example.com",
      password: "secret1",
    });
  });
});
