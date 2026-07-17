import { ValidationError } from "@storyforge/domain";

/**
 * Parses a required date argument. `new Date(...)` alone is not enough here:
 * an unparseable string yields Invalid Date (which Prisma rejects deep in the
 * write path as a masked internal error), so reject it up front as user input.
 */
export function parseRequiredDate(value: string, field: string): Date {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`${field} must be a valid date string.`);
  }

  return date;
}

/**
 * Parses an optional (nullable in GraphQL) date argument. `undefined` means
 * "leave unchanged" and passes through; explicit `null` is rejected — the
 * underlying columns are non-nullable, and `new Date(null)` would otherwise
 * silently coerce to the 1970 epoch.
 */
export function parseOptionalDate(
  value: string | null | undefined,
  field: string,
): Date | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    throw new ValidationError(`${field} cannot be null.`);
  }

  return parseRequiredDate(value, field);
}
