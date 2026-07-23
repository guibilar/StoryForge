import type { EntitySummary } from "../components/EntityWindow";

// Entity.type is an open free string (a plugin can introduce its own), so the
// grouping is derived from the data rather than a fixed list, and sorted
// alphabetically so the order doesn't shift as rows arrive.
export function groupByType(
  entities: EntitySummary[],
): [string, EntitySummary[]][] {
  const groups = new Map<string, EntitySummary[]>();
  for (const entity of entities) {
    const list = groups.get(entity.type) ?? [];
    list.push(entity);
    groups.set(entity.type, list);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}
