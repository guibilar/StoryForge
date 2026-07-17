import type { CampaignRole } from "../campaignMember";
import { EntityVisibility } from "../entity";

const VISIBILITY_RESTRICTED_ROLES = new Set<CampaignRole>([
  "PLAYER",
  "OBSERVER",
]);

export function canViewVisibility(
  visibility: EntityVisibility,
  role: CampaignRole,
): boolean {
  if (!VISIBILITY_RESTRICTED_ROLES.has(role)) {
    return true;
  }

  return visibility === EntityVisibility.PUBLIC;
}

export function filterByVisibility<T extends { Visibility: EntityVisibility }>(
  items: T[],
  role: CampaignRole,
): T[] {
  if (!VISIBILITY_RESTRICTED_ROLES.has(role)) {
    return items;
  }

  return items.filter((item) => canViewVisibility(item.Visibility, role));
}
