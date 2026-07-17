import { describe, expect, it } from "vitest";
import { WorkspaceState } from "@storyforge/domain";
import type { WorkspaceState as PrismaWorkspaceState } from "@storyforge/database";
import { WorkspaceStateMapper } from "./WorkspaceStateMapper";

describe("WorkspaceStateMapper", () => {
  it("maps a persistence record to a domain workspace state", () => {
    const record: PrismaWorkspaceState = {
      id: "11111111-1111-1111-1111-111111111111",
      userId: "22222222-2222-2222-2222-222222222222",
      campaignId: "33333333-3333-3333-3333-333333333333",
      layout: { npcs: { x: 1, y: 2, width: 3, height: 4 } },
      recentEntityIds: ["entity-1", "entity-2"],
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-02-01T00:00:00Z"),
    };

    const workspaceState = WorkspaceStateMapper.toDomain(record);

    expect(workspaceState.Id.toString()).toBe(record.id);
    expect(workspaceState.UserId).toBe(record.userId);
    expect(workspaceState.CampaignId).toBe(record.campaignId);
    expect(workspaceState.Layout).toEqual(record.layout);
    expect(workspaceState.RecentEntityIds).toEqual(record.recentEntityIds);
    expect(workspaceState.CreatedAt).toEqual(record.createdAt);
    expect(workspaceState.UpdatedAt).toEqual(record.updatedAt);
  });

  it("maps a domain workspace state to a persistence shape", () => {
    const workspaceState = WorkspaceState.create({
      userId: "22222222-2222-2222-2222-222222222222",
      campaignId: "33333333-3333-3333-3333-333333333333",
      layout: { notes: { x: 5, y: 6, width: 7, height: 8 } },
      recentEntityIds: ["entity-3"],
    });

    const record = WorkspaceStateMapper.toPersistence(workspaceState);

    expect(record).toEqual({
      id: workspaceState.Id.toString(),
      userId: workspaceState.UserId,
      campaignId: workspaceState.CampaignId,
      layout: workspaceState.Layout,
      recentEntityIds: workspaceState.RecentEntityIds,
      createdAt: workspaceState.CreatedAt,
      updatedAt: workspaceState.UpdatedAt,
    });
  });
});
