import { describe, expect, it } from "vitest";
import { CampaignMember, UserId } from "@storyforge/domain";
import { resolveViewportSyncTargets } from "./ViewportSyncTargetResolver";

function member(userId: string, role: CampaignMember["Role"]): CampaignMember {
  return CampaignMember.create({
    campaignId: "campaign-1",
    userId: UserId.fromString(userId),
    role,
  });
}

describe("resolveViewportSyncTargets", () => {
  const owner = member("owner-1", "OWNER");
  const storyteller = member("storyteller-1", "STORYTELLER");
  const coStoryteller = member("co-storyteller-1", "CO_STORYTELLER");
  const player1 = member("player-1", "PLAYER");
  const player2 = member("player-2", "PLAYER");
  const observer1 = member("observer-1", "OBSERVER");
  const roster = [
    owner,
    storyteller,
    coStoryteller,
    player1,
    player2,
    observer1,
  ];

  it("resolves 'all players' to every PLAYER/OBSERVER, excluding storytelling roles", () => {
    const result = resolveViewportSyncTargets(roster, {
      allPlayers: true,
      userIds: [],
    });

    expect(result.sort()).toEqual(
      ["player-1", "player-2", "observer-1"].sort(),
    );
  });

  it("resolves a single explicit userId to that one player", () => {
    const result = resolveViewportSyncTargets(roster, {
      allPlayers: false,
      userIds: ["player-1"],
    });

    expect(result).toEqual(["player-1"]);
  });

  it("resolves multiple explicit userIds, deduplicated", () => {
    const result = resolveViewportSyncTargets(roster, {
      allPlayers: false,
      userIds: ["player-1", "player-2", "player-1"],
    });

    expect(result.sort()).toEqual(["player-1", "player-2"].sort());
  });

  it("drops explicit userIds that are not members of the campaign", () => {
    const result = resolveViewportSyncTargets(roster, {
      allPlayers: false,
      userIds: ["player-1", "not-a-member"],
    });

    expect(result).toEqual(["player-1"]);
  });

  it("ignores the userIds list entirely when allPlayers is true", () => {
    const result = resolveViewportSyncTargets(roster, {
      allPlayers: true,
      userIds: ["storyteller-1"],
    });

    expect(result.sort()).toEqual(
      ["player-1", "player-2", "observer-1"].sort(),
    );
  });

  it("returns an empty list when allPlayers is false and no valid userIds are given", () => {
    const result = resolveViewportSyncTargets(roster, {
      allPlayers: false,
      userIds: [],
    });

    expect(result).toEqual([]);
  });
});
