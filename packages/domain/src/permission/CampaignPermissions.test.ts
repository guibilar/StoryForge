import { describe, expect, it } from "vitest";
import { hasPermission } from "./CampaignPermissions";
import type { CampaignRole } from "../campaignMember";
import type { PermissionAction } from "./PermissionAction";

describe("hasPermission", () => {
  it.each([
    ["OWNER", "VIEW_ENTITY", true],
    ["OWNER", "EDIT_ENTITY", true],
    ["OWNER", "MANAGE_MEMBERS", true],
    ["OWNER", "MANAGE_CAMPAIGN_SETTINGS", true],
    ["STORYTELLER", "VIEW_ENTITY", true],
    ["STORYTELLER", "EDIT_ENTITY", true],
    ["STORYTELLER", "MANAGE_MEMBERS", false],
    ["STORYTELLER", "MANAGE_CAMPAIGN_SETTINGS", false],
    ["CO_STORYTELLER", "VIEW_ENTITY", true],
    ["CO_STORYTELLER", "EDIT_ENTITY", true],
    ["CO_STORYTELLER", "MANAGE_MEMBERS", false],
    ["CO_STORYTELLER", "MANAGE_CAMPAIGN_SETTINGS", false],
    ["PLAYER", "VIEW_ENTITY", true],
    ["PLAYER", "EDIT_ENTITY", false],
    ["PLAYER", "MANAGE_MEMBERS", false],
    ["PLAYER", "MANAGE_CAMPAIGN_SETTINGS", false],
    ["OBSERVER", "VIEW_ENTITY", true],
    ["OBSERVER", "EDIT_ENTITY", false],
    ["OBSERVER", "MANAGE_MEMBERS", false],
    ["OBSERVER", "MANAGE_CAMPAIGN_SETTINGS", false],
  ] satisfies Array<[CampaignRole, PermissionAction, boolean]>)(
    "hasPermission(%s, %s) === %s",
    (role, action, expected) => {
      expect(hasPermission(role, action)).toBe(expected);
    },
  );
});
