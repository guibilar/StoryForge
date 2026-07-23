import {
  canViewRelationshipVisibility,
  canViewVisibility,
  EntityVisibility,
  ForbiddenError,
  Relationship,
  RelationshipEndpoint,
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
//
// A concealed endpoint (KAN-134) is the one deliberate exception: its real
// id never reaches a non-Storyteller viewer (redacted in resolvers/
// Relationship.ts), so that side's own entity visibility no longer needs to
// gate the whole relationship — nothing leaks either way. This is what lets
// a relationship point at a still-secret, STORYTELLER-only NPC while staying
// visible (with that one side blanked out) instead of vanishing entirely.
function passesEndpointRule(
  relationship: Relationship,
  visibleEntities: Set<string>,
): boolean {
  const sourceOk =
    relationship.ConcealedEndpoint === RelationshipEndpoint.SOURCE ||
    visibleEntities.has(relationship.SourceEntityId);
  const targetOk =
    relationship.ConcealedEndpoint === RelationshipEndpoint.TARGET ||
    visibleEntities.has(relationship.TargetEntityId);

  return sourceOk && targetOk;
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
