import {
  AuthenticationError,
  User,
  UserRepository,
  ValidationError,
} from "@storyforge/domain";

import { genSaltSync, hashSync, compareSync } from "bcrypt-ts";
import jwt from "jsonwebtoken";

import { JWT_SECRET } from "../../../config/env";

export interface RegisterDto {
  email: string;
  password: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResult {
  token: string;
  user: User;
}

// A bcrypt.compare against a hash always costs roughly the same amount of
// time regardless of whether it matches. Comparing against this fixed dummy
// hash when no user exists keeps login's timing indistinguishable from the
// "wrong password" case, so response latency can't be used to enumerate
// which emails have accounts.
const DUMMY_PASSWORD_HASH = hashSync(
  "no-such-user-timing-safety",
  genSaltSync(10),
);

export class AuthenticationService {
  constructor(private readonly userRepository: UserRepository) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    // Must run against the raw input: User.create only ever sees the bcrypt
    // hash (always 60 chars), which passes the length rules for any input.
    User.validatePlainPassword(dto.password);

    const email = User.normalizeEmail(dto.email);
    const exists = await this.userRepository.existsByEmail(email);

    if (exists) {
      throw new ValidationError("An account with this email already exists.");
    }

    const saltRounds = 10;
    const salt = genSaltSync(saltRounds);
    const hashedPassword = hashSync(dto.password, salt);

    const user = User.create({ email, password: hashedPassword });

    await this.userRepository.create(user);

    const token = this.issueToken(user);

    return { token, user };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.userRepository.findByEmail(
      User.normalizeEmail(dto.email),
    );

    const isMatch = compareSync(
      dto.password,
      user ? user.Password : DUMMY_PASSWORD_HASH,
    );

    if (!user || !isMatch) {
      throw new AuthenticationError("Invalid email or password.");
    }

    const token = this.issueToken(user);

    return { token, user };
  }

  private issueToken(user: User): string {
    const payload = { sub: user.Id.toString() };

    return jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });
  }
}
