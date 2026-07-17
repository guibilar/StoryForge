import { ValidationError } from "../shared";
import { UserId } from "./UserId";

export interface CreateUserProps {
  email: string;
  password: string;
}

export interface RehydrateUserProps {
  id: UserId;
  email: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
}

export class User {
  private constructor(
    private readonly idValue: UserId,
    private emailValue: string,
    private readonly passwordValue: string,
    private readonly createdAtValue: Date,
    private updatedAtValue: Date,
  ) {
    this.emailValue = User.normalizeEmail(emailValue);
    this.validatePassword(passwordValue);
  }

  static create(props: CreateUserProps): User {
    return new User(
      UserId.create(),
      props.email,
      props.password,
      new Date(),
      new Date(),
    );
  }

  /**
   * Validates a plain-text (pre-hash) password. The instance-level
   * validatePassword only ever sees the already-hashed value (bcrypt output
   * is always 60 chars, so it passes every rule regardless of what the user
   * typed) — callers hashing a user-supplied password must run this against
   * the raw input first.
   */
  static validatePlainPassword(password: string): void {
    const trimmed = password.trim();

    if (!trimmed) {
      throw new ValidationError("Password cannot be empty.");
    }

    if (trimmed.length < 6) {
      throw new ValidationError("Password must be at least 6 characters long.");
    }

    // bcrypt only hashes the first 72 bytes of its input and silently
    // truncates the rest — a longer cap would let two different passwords
    // sharing the first 72 bytes hash identically and both authenticate.
    if (Buffer.byteLength(trimmed, "utf8") > 72) {
      throw new ValidationError("Password cannot exceed 72 bytes.");
    }
  }

  static rehydrate(props: RehydrateUserProps): User {
    return new User(
      props.id,
      props.email,
      props.password,
      props.createdAt,
      props.updatedAt,
    );
  }

  get Id(): UserId {
    return this.idValue;
  }

  get Email(): string {
    return this.emailValue;
  }

  get Password(): string {
    return this.passwordValue;
  }

  get CreatedAt(): Date {
    return this.createdAtValue;
  }

  get UpdatedAt(): Date {
    return this.updatedAtValue;
  }

  changeEmail(newEmail: string): void {
    this.emailValue = User.normalizeEmail(newEmail);
    this.updatedAtValue = new Date();
  }

  /**
   * Emails are case-insensitive by spec (RFC 5321 makes the domain part
   * case-insensitive and virtually every provider treats the local part the
   * same way in practice). Storing a normalized lowercase form here — not
   * just at the call sites — means every code path that creates or
   * rehydrates a User ends up consistent, so "Test@Example.com" and
   * "test@example.com" can't register as two different accounts.
   */
  static normalizeEmail(email: string): string {
    const trimmed = email.trim().toLowerCase();

    if (!trimmed) {
      throw new ValidationError("Email cannot be empty.");
    }

    if (trimmed.length > 255) {
      throw new ValidationError("Email cannot exceed 255 characters.");
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      throw new ValidationError("Email format is invalid.");
    }

    return trimmed;
  }

  private validatePassword(password: string): void {
    User.validatePlainPassword(password);
  }
}
