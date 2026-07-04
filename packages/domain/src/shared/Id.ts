export class Id<Brand extends string> {
  private readonly _brand!: Brand;

  private constructor(private readonly value: string) {}

  static create<B extends string>(): Id<B> {
    return new Id<B>(crypto.randomUUID());
  }

  static fromString<B extends string>(value: string): Id<B> {
    if (!value.trim()) {
      throw new Error("Id cannot be empty.");
    }

    return new Id<B>(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: Id<Brand>): boolean {
    return this.value === other.value;
  }
}
