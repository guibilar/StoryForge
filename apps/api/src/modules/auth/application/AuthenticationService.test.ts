import { beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import { hashSync, genSaltSync } from "bcrypt-ts";
import {
  AuthenticationError,
  User,
  UserRepository,
  ValidationError,
} from "@storyforge/domain";
import { AuthenticationService } from "./AuthenticationService";
import { JWT_SECRET } from "../../../config/env";

function makeRepository(): UserRepository {
  return {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    existsByEmail: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
}

describe("AuthenticationService", () => {
  let repository: UserRepository;
  let service: AuthenticationService;

  beforeEach(() => {
    repository = makeRepository();
    service = new AuthenticationService(repository);
  });

  describe("register", () => {
    it("rejects an email that already exists", async () => {
      vi.mocked(repository.existsByEmail).mockResolvedValue(true);

      await expect(
        service.register({ email: "taken@example.com", password: "secret1" }),
      ).rejects.toThrow(ValidationError);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("creates the user with a hashed password and returns a valid token", async () => {
      vi.mocked(repository.existsByEmail).mockResolvedValue(false);

      const { token, user } = await service.register({
        email: "new@example.com",
        password: "secret1",
      });

      expect(user.Email).toBe("new@example.com");
      expect(user.Password).not.toBe("secret1");
      expect(repository.create).toHaveBeenCalledWith(user);

      const decoded = jwt.verify(token, JWT_SECRET) as { sub: string };
      expect(decoded.sub).toBe(user.Id.toString());
    });
  });

  describe("login", () => {
    it("rejects an unknown email", async () => {
      vi.mocked(repository.findByEmail).mockResolvedValue(null);

      await expect(
        service.login({ email: "nobody@example.com", password: "secret1" }),
      ).rejects.toThrow(AuthenticationError);
    });

    it("rejects an incorrect password", async () => {
      const hashed = hashSync("secret1", genSaltSync(10));
      const user = User.create({ email: "user@example.com", password: hashed });
      vi.mocked(repository.findByEmail).mockResolvedValue(user);

      await expect(
        service.login({ email: user.Email, password: "wrong-password" }),
      ).rejects.toThrow(AuthenticationError);
    });

    it("returns a valid token on a correct password", async () => {
      const hashed = hashSync("secret1", genSaltSync(10));
      const user = User.create({ email: "user@example.com", password: hashed });
      vi.mocked(repository.findByEmail).mockResolvedValue(user);

      const { token } = await service.login({
        email: user.Email,
        password: "secret1",
      });

      const decoded = jwt.verify(token, JWT_SECRET) as { sub: string };
      expect(decoded.sub).toBe(user.Id.toString());
    });
  });
});
