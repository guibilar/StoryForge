import type { EntityCategory } from "../gql/graphql";

// Relationship.type stays a free, unvalidated string at the API layer (KAN-41)
// so a future plugin (e.g. VTM's Sire/Childe/Ghoul) can define its own values
// with no core migration — this is a client-only suggestion list, not
// validation. Keyed by an unordered category pair since most of these read
// naturally in either direction (an Ally/Enemy edge, a MemberOf edge).
const SUGGESTIONS_BY_PAIR: Record<string, string[]> = {
  "CHARACTER|CHARACTER": ["Ally", "Enemy", "Parent", "Child"],
  "CHARACTER|ORGANIZATION": ["MemberOf"],
  "CHARACTER|ITEM": ["Owns"],
};

function pairKey(a: EntityCategory, b: EntityCategory): string {
  return [a, b].sort().join("|");
}

export function suggestRelationshipTypes(
  sourceCategory: EntityCategory | undefined,
  targetCategory: EntityCategory | undefined,
): string[] {
  if (!sourceCategory || !targetCategory) {
    return [];
  }
  return SUGGESTIONS_BY_PAIR[pairKey(sourceCategory, targetCategory)] ?? [];
}
