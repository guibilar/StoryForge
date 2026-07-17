import type { CampaignRole } from "../campaignMember";
import type { PermissionAction } from "./PermissionAction";

const ROLE_PERMISSIONS: Record<CampaignRole, ReadonlySet<PermissionAction>> = {
  OWNER: new Set<PermissionAction>([
    "VIEW_ENTITY",
    "EDIT_ENTITY",
    "MANAGE_MEMBERS",
    "MANAGE_CAMPAIGN_SETTINGS",
  ]),
  STORYTELLER: new Set<PermissionAction>(["VIEW_ENTITY", "EDIT_ENTITY"]),
  CO_STORYTELLER: new Set<PermissionAction>(["VIEW_ENTITY", "EDIT_ENTITY"]),
  PLAYER: new Set<PermissionAction>(["VIEW_ENTITY"]),
  OBSERVER: new Set<PermissionAction>(["VIEW_ENTITY"]),
};

export function hasPermission(
  role: CampaignRole,
  action: PermissionAction,
): boolean {
  return ROLE_PERMISSIONS[role].has(action);
}
