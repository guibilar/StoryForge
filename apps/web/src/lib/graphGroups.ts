// Clusters for the relationship graph. Every mode here is *derived* from data
// the campaign already has — there's deliberately no Group model behind this.
// An organization is already an entity (EntityCategory.ORGANIZATION) and an
// ad-hoc bag of entities is already a Tag, so a third grouping primitive would
// only be a second way to say the same thing.

export type GroupMode = "none" | "faction" | "type" | "category" | "tag";

export interface GroupableEntity {
  id: string;
  name: string;
  type: string;
  category: string;
  tags: ReadonlyArray<{ id: string; name: string }>;
}

export interface GroupLink {
  source: string;
  target: string;
  type: string;
}

export interface EntityGroup {
  /** Stable key, namespaced by mode so ids can't collide across modes. */
  id: string;
  label: string;
  memberIds: string[];
  // Set only in "faction" mode: the ORGANIZATION entity this cluster stands
  // for. That entity is drawn as the cluster boundary instead of as a node of
  // its own, so callers must drop it from the node list and re-route its own
  // relationships to the cluster's anchor.
  entityId?: string;
}

export interface DerivedGroups {
  groups: EntityGroup[];
  /** Entity id -> group id, for the entities that landed in one. */
  groupOf: Map<string, string>;
  /** Entity ids that a cluster boundary now represents, so they stop being nodes. */
  absorbedEntityIds: Set<string>;
}

const ORGANIZATION = "ORGANIZATION";
const CHARACTER = "CHARACTER";

const EMPTY: DerivedGroups = {
  groups: [],
  groupOf: new Map(),
  absorbedEntityIds: new Set(),
};

// Sorting by label everywhere below keeps cluster order — and therefore the
// palette entry each cluster gets — stable as entities are added or renamed.
function byLabel(a: EntityGroup, b: EntityGroup): number {
  return a.label.localeCompare(b.label);
}

function fromBuckets(
  prefix: string,
  buckets: Map<string, { label: string; memberIds: string[] }>,
): DerivedGroups {
  const groups = [...buckets.entries()]
    .map(([key, bucket]) => ({
      id: `${prefix}:${key}`,
      label: bucket.label,
      memberIds: bucket.memberIds,
    }))
    // A cluster of one is just a node with a box drawn round it.
    .filter((group) => group.memberIds.length > 1)
    .sort(byLabel);

  const groupOf = new Map<string, string>();
  for (const group of groups) {
    for (const memberId of group.memberIds) {
      groupOf.set(memberId, group.id);
    }
  }

  return { groups, groupOf, absorbedEntityIds: new Set() };
}

// Two independent filters decide what counts as belonging to a faction, and
// neither one is "the type string looks like MemberOf":
//
//  1. Category pair. Only a CHARACTER can be a member of an ORGANIZATION. A
//     location standing inside the org's chapterhouse, an item it owns, or
//     another org it merely opposes are all linked to it without being part
//     of it — LOCATED_AT is a link, not an affiliation.
//  2. The caller's chosen affiliation types, when it passes any. That's the
//     Storyteller's own vocabulary rather than ours; Relationship.type is free
//     text by design (KAN-41 — a VTM plugin defines Sire/Childe/Ghoul with no
//     core migration), so hard-coding a list here would silently drop anyone
//     whose campaign says "Sworn To".
function factionGroups(
  entities: GroupableEntity[],
  links: GroupLink[],
  affiliationTypes?: ReadonlySet<string>,
): DerivedGroups {
  const organizations = entities.filter(
    (entity) => entity.category === ORGANIZATION,
  );
  if (organizations.length === 0) {
    return EMPTY;
  }

  const organizationIds = new Set(organizations.map((entity) => entity.id));
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const membersByOrg = new Map<string, string[]>();

  for (const link of links) {
    if (affiliationTypes && !affiliationTypes.has(link.type)) {
      continue;
    }
    for (const [end, other] of [
      [link.source, link.target],
      [link.target, link.source],
    ] as const) {
      if (!organizationIds.has(end)) {
        continue;
      }
      const otherEntity = byId.get(other);
      if (!otherEntity || otherEntity.category !== CHARACTER) {
        continue;
      }
      const members = membersByOrg.get(end);
      if (members) {
        if (!members.includes(other)) {
          members.push(other);
        }
      } else {
        membersByOrg.set(end, [other]);
      }
    }
  }

  const groups = organizations
    .filter(
      (organization) => (membersByOrg.get(organization.id)?.length ?? 0) > 0,
    )
    .map((organization) => ({
      id: `faction:${organization.id}`,
      label: organization.name,
      entityId: organization.id,
      memberIds: membersByOrg.get(organization.id) ?? [],
    }))
    .sort(byLabel);

  // An entity can belong to several organizations; hulls can't overlap it into
  // two places at once, so it lands in the first by label and stays visible in
  // the others through the edges that still connect it to them.
  const groupOf = new Map<string, string>();
  for (const group of groups) {
    for (const memberId of group.memberIds) {
      if (!groupOf.has(memberId)) {
        groupOf.set(memberId, group.id);
      }
    }
  }
  for (const group of groups) {
    group.memberIds = group.memberIds.filter(
      (memberId) => groupOf.get(memberId) === group.id,
    );
  }

  const kept = groups.filter((group) => group.memberIds.length > 0);

  return {
    groups: kept,
    groupOf,
    // Only an organization that actually became a boundary stops being a node.
    // One with no members has nothing to enclose, so it stays a normal node.
    absorbedEntityIds: new Set(
      kept.map((group) => group.entityId).filter((id): id is string => !!id),
    ),
  };
}

/**
 * Every distinct relationship type that currently joins a CHARACTER to an
 * ORGANIZATION — the candidates for "which of these actually mean affiliation".
 * Read off the campaign's own data, so a custom vocabulary shows up on its own.
 */
export function affiliationTypeOptions(
  entities: GroupableEntity[],
  links: GroupLink[],
): string[] {
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const types = new Set<string>();

  for (const link of links) {
    const source = byId.get(link.source);
    const target = byId.get(link.target);
    if (!source || !target) {
      continue;
    }
    const pair = [source.category, target.category];
    if (pair.includes(ORGANIZATION) && pair.includes(CHARACTER)) {
      types.add(link.type);
    }
  }

  return [...types].sort((a, b) => a.localeCompare(b));
}

/**
 * Which of `options` to tick on first use. Prefers the app's own suggestion for
 * the CHARACTER|ORGANIZATION pair (the value the relationship form offers, so a
 * Storyteller who took the suggestion gets clusters for free) and falls back to
 * everything when a campaign uses none of them — better to over-group and let
 * them untick LOCATED_AT than to show an empty graph and look broken.
 */
export function defaultAffiliationTypes(
  options: string[],
  suggested: string[],
): string[] {
  const wanted = new Set(suggested.map((type) => type.toLowerCase()));
  const matched = options.filter((option) => wanted.has(option.toLowerCase()));
  return matched.length > 0 ? matched : options;
}

export function deriveGroups(
  mode: GroupMode,
  entities: GroupableEntity[],
  links: GroupLink[],
  affiliationTypes?: ReadonlySet<string>,
): DerivedGroups {
  if (mode === "none" || entities.length === 0) {
    return EMPTY;
  }

  if (mode === "faction") {
    return factionGroups(entities, links, affiliationTypes);
  }

  const buckets = new Map<string, { label: string; memberIds: string[] }>();

  function put(key: string, label: string, entityId: string) {
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.memberIds.push(entityId);
    } else {
      buckets.set(key, { label, memberIds: [entityId] });
    }
  }

  for (const entity of entities) {
    if (mode === "type") {
      put(entity.type, entity.type, entity.id);
    } else if (mode === "category") {
      put(entity.category, entity.category, entity.id);
    } else {
      // An entity can carry several tags. First by name, so the choice doesn't
      // shift when a tag is added elsewhere.
      const tag = [...entity.tags].sort((a, b) =>
        a.name.localeCompare(b.name),
      )[0];
      if (tag) {
        put(tag.id, tag.name, entity.id);
      }
    }
  }

  return fromBuckets(mode, buckets);
}
