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

export class AuthenticationService {
  constructor(private readonly userRepository: UserRepository) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const exists = await this.userRepository.existsByEmail(dto.email);

    if (exists) {
      throw new ValidationError("An account with this email already exists.");
    }

    const saltRounds = 10;
    const salt = genSaltSync(saltRounds);
    const hashedPassword = hashSync(dto.password, salt);

    const user = User.create({ email: dto.email, password: hashedPassword });

    await this.userRepository.create(user);

    const token = this.issueToken(user);

    return { token, user };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.userRepository.findByEmail(dto.email);

    if (!user) {
      throw new AuthenticationError("Invalid email or password.");
    }

    const isMatch = compareSync(dto.password, user.Password);

    if (!isMatch) {
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
