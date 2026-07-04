import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { User, UserId } from "@storyforge/domain";
import { prisma } from "@storyforge/database";
import { PrismaUserRepository } from "./PrismaUserRepository";

const repository = new PrismaUserRepository();
const createdIds: string[] = [];

function uniqueEmail(): string {
  return `test-${randomUUID()}@example.com`;
}

afterEach(async () => {
  if (createdIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
    createdIds.length = 0;
  }
});

describe("PrismaUserRepository", () => {
  it("creates a user and finds it by id", async () => {
    const user = User.create({ email: uniqueEmail(), password: "secret1" });
    createdIds.push(user.Id.toString());

    await repository.create(user);
    const found = await repository.findById(user.Id);

    expect(found).not.toBeNull();
    expect(found?.Id.equals(user.Id)).toBe(true);
    expect(found?.Email).toBe(user.Email);
  });

  it("returns null when the user does not exist", async () => {
    const found = await repository.findById(UserId.create());

    expect(found).toBeNull();
  });

  it("finds a user by email", async () => {
    const email = uniqueEmail();
    const user = User.create({ email, password: "secret1" });
    createdIds.push(user.Id.toString());
    await repository.create(user);

    const found = await repository.findByEmail(email);

    expect(found?.Id.equals(user.Id)).toBe(true);
  });

  it("reports whether an email already exists", async () => {
    const email = uniqueEmail();
    const user = User.create({ email, password: "secret1" });
    createdIds.push(user.Id.toString());
    await repository.create(user);

    await expect(repository.existsByEmail(email)).resolves.toBe(true);
    await expect(repository.existsByEmail(uniqueEmail())).resolves.toBe(false);
  });

  it("updates a user's email", async () => {
    const user = User.create({ email: uniqueEmail(), password: "secret1" });
    createdIds.push(user.Id.toString());
    await repository.create(user);

    user.changeEmail(uniqueEmail());
    await repository.update(user);

    const found = await repository.findById(user.Id);
    expect(found?.Email).toBe(user.Email);
  });
});
