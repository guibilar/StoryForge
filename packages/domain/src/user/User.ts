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
    this.validateEmail(emailValue);
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
    this.validateEmail(newEmail);
    this.emailValue = newEmail;
    this.updatedAtValue = new Date();
  }

  private validateEmail(email: string): void {
    const trimmed = email.trim();

    if (!trimmed) {
      throw new ValidationError("Email cannot be empty.");
    }

    if (trimmed.length > 255) {
      throw new ValidationError("Email cannot exceed 255 characters.");
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      throw new ValidationError("Email format is invalid.");
    }
  }

  private validatePassword(password: string): void {
    const trimmed = password.trim();

    if (!trimmed) {
      throw new ValidationError("Password cannot be empty.");
    }

    if (trimmed.length < 6) {
      throw new ValidationError("Password must be at least 6 characters long.");
    }

    if (trimmed.length > 255) {
      throw new ValidationError("Password cannot exceed 255 characters.");
    }
  }
}
