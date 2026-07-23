import {
  canViewRelationshipVisibility,
  canViewVisibility,
  EntityVisibility,
  ForbiddenError,
  Relationship,
} from "@storyforge/domain";
import type { CampaignMember, CampaignRole } from "@storyforge/domain";
import type { GraphQLContext } from "../../../graphql/context";
import { requireCampaignMember } from "../../campaignMembers/graphql/guards";

/**
 * A Relationship has no visibility of its own — it inherits it from the two
 * entities it connects. Seeing the edge means seeing both endpoints, so a
 * player can't read the type or (spoiler-carrying) description of a link
 * into a STORYTELLER/PRIVATE entity they were never shown.
 */
function seesEveryEntity(role: CampaignRole): boolean {
  return canViewVisibility(EntityVisibility.PRIVATE, role);
}

async function visibleEntityIds(
  context: GraphQLContext,
  campaignId: string,
  role: CampaignRole,
): Promise<Set<string>> {
  const entities = await context.entityService.listEntities(campaignId);

  return new Set(
    entities
      .filter((entity) => canViewVisibility(entity.Visibility, role))
      .map((entity) => entity.Id.toString()),
  );
}

// Both halves of the rule. The relationship's own level (domain) and the
// endpoint rule (here) are ANDed: marking a relationship PUBLIC never
// reveals a link into an entity the viewer can't see, and two public
// endpoints never expose a STORYTELLER/TARGETED relationship between them.
function passesEndpointRule(
  relationship: Relationship,
  visibleEntities: Set<string>,
): boolean {
  return (
    visibleEntities.has(relationship.SourceEntityId) &&
    visibleEntities.has(relationship.TargetEntityId)
  );
}

function passesOwnVisibility(
  relationship: Relationship,
  membership: CampaignMember,
): boolean {
  return canViewRelationshipVisibility(
    relationship,
    membership.UserId,
    membership.Role,
  );
}

export async function filterViewableRelationships(
  context: GraphQLContext,
  campaignId: string,
  relationships: Relationship[],
): Promise<Relationship[]> {
  const membership = await requireCampaignMember(context, campaignId);

  // Storyteller-tier roles see every entity and every level, so neither
  // half can exclude anything — skip the roster lookup entirely.
  if (seesEveryEntity(membership.Role)) {
    return relationships;
  }

  const visible = await visibleEntityIds(context, campaignId, membership.Role);

  return relationships.filter(
    (relationship) =>
      passesEndpointRule(relationship, visible) &&
      passesOwnVisibility(relationship, membership),
  );
}

/**
 * Single-relationship counterpart of the filter above. Mirrors how
 * Query.entity rejects a hidden entity — a ForbiddenError rather than a
 * NotFoundError, keeping this module consistent with the entity module it
 * derives its rules from.
 */
export async function requireRelationshipViewer(
  context: GraphQLContext,
  relationship: Relationship,
): Promise<void> {
  const membership = await requireCampaignMember(
    context,
    relationship.CampaignId,
  );

  if (seesEveryEntity(membership.Role)) {
    return;
  }

  const visible = await visibleEntityIds(
    context,
    relationship.CampaignId,
    membership.Role,
  );

  if (
    !passesEndpointRule(relationship, visible) ||
    !passesOwnVisibility(relationship, membership)
  ) {
    throw new ForbiddenError("You cannot view this relationship.");
  }
}
