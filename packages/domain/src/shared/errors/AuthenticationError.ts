import { DomainError } from "./DomainError";

export class AuthenticationError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}
