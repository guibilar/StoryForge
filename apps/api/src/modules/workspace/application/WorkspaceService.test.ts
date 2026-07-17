import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceState, WorkspaceStateRepository } from "@storyforge/domain";
import { WorkspaceService } from "./WorkspaceService";

function makeRepository(): WorkspaceStateRepository {
  return {
    findByUserAndCampaign: vi.fn(),
    upsert: vi.fn(),
  };
}

const saveDto = {
  campaignId: "campaign-1",
  layout: {
    npcs: { x: 28, y: 24, width: 310, height: 280, hidden: false, z: 2 },
  },
  recentEntityIds: ["entity-1"],
};

describe("WorkspaceService", () => {
  let repository: WorkspaceStateRepository;
  let service: WorkspaceService;

  beforeEach(() => {
    repository = makeRepository();
    service = new WorkspaceService(repository);
  });

  describe("getWorkspaceState", () => {
    it("delegates to the repository", async () => {
      const state = WorkspaceState.create({
        userId: "user-1",
        ...saveDto,
      });
      vi.mocked(repository.findByUserAndCampaign).mockResolvedValue(state);

      await expect(
        service.getWorkspaceState("user-1", "campaign-1"),
      ).resolves.toBe(state);
      expect(repository.findByUserAndCampaign).toHaveBeenCalledWith(
        "user-1",
        "campaign-1",
      );
    });

    it("returns null when nothing has been saved yet", async () => {
      vi.mocked(repository.findByUserAndCampaign).mockResolvedValue(null);

      await expect(
        service.getWorkspaceState("user-1", "campaign-1"),
      ).resolves.toBeNull();
    });
  });

  describe("saveWorkspaceState", () => {
    it("creates a new workspace state when none exists yet", async () => {
      vi.mocked(repository.findByUserAndCampaign).mockResolvedValue(null);

      const state = await service.saveWorkspaceState("user-1", saveDto);

      expect(state.UserId).toBe("user-1");
      expect(state.Layout).toEqual(saveDto.layout);
      expect(state.RecentEntityIds).toEqual(saveDto.recentEntityIds);
      expect(repository.upsert).toHaveBeenCalledWith(state);
    });

    it("overwrites the existing workspace state (same row, not a new one)", async () => {
      const existing = WorkspaceState.create({
        userId: "user-1",
        campaignId: "campaign-1",
        layout: { old: { x: 0, y: 0, width: 1, height: 1 } },
        recentEntityIds: ["stale-entity"],
      });
      vi.mocked(repository.findByUserAndCampaign).mockResolvedValue(existing);

      const state = await service.saveWorkspaceState("user-1", saveDto);

      expect(state).toBe(existing);
      expect(state.Layout).toEqual(saveDto.layout);
      expect(state.RecentEntityIds).toEqual(saveDto.recentEntityIds);
      expect(repository.upsert).toHaveBeenCalledWith(existing);
    });

    it("propagates validation errors from the domain (e.g. too many recents)", async () => {
      vi.mocked(repository.findByUserAndCampaign).mockResolvedValue(null);
      const tooMany = Array.from({ length: 51 }, (_, i) => `entity-${i}`);

      await expect(
        service.saveWorkspaceState("user-1", {
          ...saveDto,
          recentEntityIds: tooMany,
        }),
      ).rejects.toThrow("Too many recent entities to save.");
      expect(repository.upsert).not.toHaveBeenCalled();
    });
  });
});
