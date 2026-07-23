import type { CampaignRole } from "../campaignMember";
import type { Relationship } from "../relationship";
import { RelationshipEndpoint, RelationshipVisibility } from "../relationship";
import type { UserId } from "../user";

const STORYTELLER_ROLES = new Set<CampaignRole>([
  "OWNER",
  "STORYTELLER",
  "CO_STORYTELLER",
]);

/**
 * A relationship's own visibility level. This is only half the rule — the
 * other half is the endpoint check (you must be able to see both entities
 * it connects), which lives in the API layer because it needs the entity
 * roster. Both must pass; neither widens the other. A PUBLIC relationship
 * into a Storyteller-only entity stays hidden, and a TARGETED one between
 * two public entities is still limited to its recipients.
 */
export function canViewRelationshipVisibility(
  relationship: Relationship,
  userId: UserId,
  role: CampaignRole,
): boolean {
  if (STORYTELLER_ROLES.has(role)) {
    return true;
  }

  switch (relationship.Visibility) {
    case RelationshipVisibility.PUBLIC:
      return true;
    case RelationshipVisibility.STORYTELLER:
      return false;
    case RelationshipVisibility.TARGETED:
      return relationship.RecipientIds.some((recipient) =>
        recipient.equals(userId),
      );
  }
}

/**
 * Whether a viewer sees the real entity id on one side of a relationship, or
 * a redacted (null) one (KAN-134). Storyteller-tier roles always see both —
 * same tier `canViewRelationshipVisibility` treats as seeing everything.
 */
export function canSeeRelationshipEndpoint(
  relationship: Relationship,
  endpoint: RelationshipEndpoint,
  role: CampaignRole,
): boolean {
  if (STORYTELLER_ROLES.has(role)) {
    return true;
  }

  return relationship.ConcealedEndpoint !== endpoint;
}

/**
 * Only the Storyteller side authors relationships at all (CREATE via
 * requireCampaignWriter), so every level is authorable by anyone who gets
 * that far. Present as the seam to gate on if players ever gain the right
 * to record relationships of their own.
 */
export function canAuthorRelationshipVisibility(role: CampaignRole): boolean {
  return STORYTELLER_ROLES.has(role);
}
