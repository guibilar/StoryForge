import type { CombinedError } from "urql";

export function formatGraphQLError(
  error: CombinedError | undefined,
): string | undefined {
  return error?.graphQLErrors[0]?.message ?? error?.message;
}
