export class EntityId {
  private constructor(private readonly value: string) {}

  static create(value?: string): EntityId {
    return new EntityId(value ?? crypto.randomUUID());
  }

  static fromString(value: string): EntityId {
    if (!value.trim()) {
      throw new Error("EntityId cannot be empty.");
    }

    return new EntityId(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: EntityId): boolean {
    return this.value === other.value;
  }
}
