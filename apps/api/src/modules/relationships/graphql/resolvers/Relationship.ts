import {
  canSeeRelationshipEndpoint,
  RelationshipEndpoint,
  type Relationship as DomainRelationship,
} from "@storyforge/domain";
import type { GraphQLContext } from "../../../../graphql/context";
import { requireCampaignMember } from "../../../campaignMembers/graphql/guards";

// sourceEntityId/targetEntityId are the one place a concealed relationship
// (KAN-134) actually gets redacted: the domain object always carries the
// real ids, and this is where a non-Storyteller viewer's copy has the
// concealed side blanked to null before it ever reaches the wire. Mirrors
// the per-row requireCampaignMember lookup Note.parent already does
// (apps/api/src/modules/notes/graphql/resolvers/Note.ts).
async function visibleEndpointId(
  relationship: DomainRelationship,
  endpoint: RelationshipEndpoint,
  realId: string,
  context: GraphQLContext,
): Promise<string | null> {
  const membership = await requireCampaignMember(
    context,
    relationship.CampaignId,
  );

  return canSeeRelationshipEndpoint(relationship, endpoint, membership.Role)
    ? realId
    : null;
}

export const Relationship = {
  id: (relationship: DomainRelationship) => relationship.Id.toString(),
  campaignId: (relationship: DomainRelationship) => relationship.CampaignId,
  sourceEntityId: (
    relationship: DomainRelationship,
    _args: unknown,
    context: GraphQLContext,
  ) =>
    visibleEndpointId(
      relationship,
      RelationshipEndpoint.SOURCE,
      relationship.SourceEntityId,
      context,
    ),
  targetEntityId: (
    relationship: DomainRelationship,
    _args: unknown,
    context: GraphQLContext,
  ) =>
    visibleEndpointId(
      relationship,
      RelationshipEndpoint.TARGET,
      relationship.TargetEntityId,
      context,
    ),
  concealedEndpoint: (relationship: DomainRelationship) =>
    relationship.ConcealedEndpoint,
  type: (relationship: DomainRelationship) => relationship.Type,
  description: (relationship: DomainRelationship) => relationship.Description,
  visibility: (relationship: DomainRelationship) => relationship.Visibility,
  recipientIds: (relationship: DomainRelationship) =>
    relationship.RecipientIds.map((userId) => userId.toString()),
  createdAt: (relationship: DomainRelationship) =>
    relationship.CreatedAt.toISOString(),
  updatedAt: (relationship: DomainRelationship) =>
    relationship.UpdatedAt.toISOString(),
  deletedAt: (relationship: DomainRelationship) =>
    relationship.DeletedAt?.toISOString() ?? null,
};
