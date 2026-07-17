import { describe, expect, it } from "vitest";
import { WorkspaceState } from "./WorkspaceState";
import { WorkspaceStateId } from "./WorkspaceStateId";

const validProps = {
  userId: "user-1",
  campaignId: "campaign-1",
  layout: {
    npcs: { x: 28, y: 24, width: 310, height: 280, hidden: false, z: 2 },
  },
  recentEntityIds: ["entity-1", "entity-2"],
};

describe("WorkspaceState", () => {
  it("creates a workspace state with the given layout and recents", () => {
    const state = WorkspaceState.create(validProps);

    expect(state.UserId).toBe(validProps.userId);
    expect(state.CampaignId).toBe(validProps.campaignId);
    expect(state.Layout).toEqual(validProps.layout);
    expect(state.RecentEntityIds).toEqual(validProps.recentEntityIds);
  });

  it("rehydrates preserving id and timestamps", () => {
    const id = WorkspaceStateId.create();
    const createdAt = new Date("2024-01-01T00:00:00Z");
    const updatedAt = new Date("2024-02-01T00:00:00Z");

    const state = WorkspaceState.rehydrate({
      id,
      ...validProps,
      createdAt,
      updatedAt,
    });

    expect(state.Id.equals(id)).toBe(true);
    expect(state.CreatedAt).toBe(createdAt);
    expect(state.UpdatedAt).toBe(updatedAt);
  });

  it("rejects an oversized layout", () => {
    const hugeLayout: Record<string, unknown> = {};
    for (let i = 0; i < 5000; i += 1) {
      hugeLayout[`window-${i}`] = { x: i, y: i, width: 100, height: 100 };
    }

    expect(() =>
      WorkspaceState.create({ ...validProps, layout: hugeLayout }),
    ).toThrow("Layout is too large to save.");
  });

  it("rejects too many recent entity ids", () => {
    const tooMany = Array.from({ length: 51 }, (_, i) => `entity-${i}`);

    expect(() =>
      WorkspaceState.create({ ...validProps, recentEntityIds: tooMany }),
    ).toThrow("Too many recent entities to save.");
  });

  it("replaceState overwrites layout and recents and bumps updatedAt", () => {
    const state = WorkspaceState.create(validProps);
    const originalUpdatedAt = state.UpdatedAt;

    const newLayout = { notes: { x: 1, y: 2, width: 3, height: 4 } };
    state.replaceState(newLayout, ["entity-3"]);

    expect(state.Layout).toEqual(newLayout);
    expect(state.RecentEntityIds).toEqual(["entity-3"]);
    expect(state.UpdatedAt.getTime()).toBeGreaterThanOrEqual(
      originalUpdatedAt.getTime(),
    );
  });

  it("replaceState validates the new state the same way create does", () => {
    const state = WorkspaceState.create(validProps);
    const tooMany = Array.from({ length: 51 }, (_, i) => `entity-${i}`);

    expect(() => state.replaceState({}, tooMany)).toThrow(
      "Too many recent entities to save.",
    );
  });
});
