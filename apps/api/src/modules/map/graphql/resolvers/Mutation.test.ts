import { describe, expect, it, vi } from "vitest";
import { CampaignMember, Marker, Territory, User } from "@storyforge/domain";
import { Mutation } from "./Mutation";
import type { GraphQLContext } from "../../../../graphql/context";
import type { MarkerService } from "../../application/MarkerService";
import type { TerritoryService } from "../../application/TerritoryService";
import type { CampaignMemberService } from "../../../campaignMembers/application/CampaignMemberService";

function makeMarkerService(): MarkerService {
  return {
    createMarker: vi.fn(),
    updateMarker: vi.fn(),
    deleteMarker: vi.fn(),
    getMarker: vi.fn(),
    listMarkers: vi.fn(),
  } as unknown as MarkerService;
}

function makeTerritoryService(): TerritoryService {
  return {
    createTerritory: vi.fn(),
    updateTerritory: vi.fn(),
    deleteTerritory: vi.fn(),
    getTerritory: vi.fn(),
    listTerritories: vi.fn(),
  } as unknown as TerritoryService;
}

function makeCampaignMemberService(): CampaignMemberService {
  return { getMembership: vi.fn() } as unknown as CampaignMemberService;
}

function makeContext(
  markerService: MarkerService,
  territoryService: TerritoryService,
  campaignMemberService: CampaignMemberService,
  currentUser: User | null,
): GraphQLContext {
  return {
    markerService,
    territoryService,
    campaignMemberService,
    currentUser,
  } as GraphQLContext;
}

const loggedOutUser = null;
const authenticatedUser = User.create({
  email: "user@example.com",
  password: "hashed",
});

const writerMembership = CampaignMember.create({
  campaignId: "campaign-1",
  userId: authenticatedUser.Id,
  role: "STORYTELLER",
});

const playerMembership = CampaignMember.create({
  campaignId: "campaign-1",
  userId: authenticatedUser.Id,
  role: "PLAYER",
});

const territoryGeometry = {
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
  ],
};

describe("map Mutation.createMarker", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const markerService = makeMarkerService();
    const territoryService = makeTerritoryService();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      markerService,
      territoryService,
      campaignMemberService,
      loggedOutUser,
    );
    const input = {
      campaignId: "campaign-1",
      name: "Old Mill",
      lat: 1,
      lng: 1,
    };

    await expect(
      Mutation.createMarker(undefined, { input }, context),
    ).rejects.toMatchObject({ extensions: { code: "UNAUTHENTICATED" } });
    expect(markerService.createMarker).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when the member's role cannot write", async () => {
    const markerService = makeMarkerService();
    const territoryService = makeTerritoryService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      playerMembership,
    );
    const context = makeContext(
      markerService,
      territoryService,
      campaignMemberService,
      authenticatedUser,
    );
    const input = {
      campaignId: "campaign-1",
      name: "Old Mill",
      lat: 1,
      lng: 1,
    };

    await expect(
      Mutation.createMarker(undefined, { input }, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(markerService.createMarker).not.toHaveBeenCalled();
  });

  it("delegates to markerService for a campaign writer", async () => {
    const markerService = makeMarkerService();
    const territoryService = makeTerritoryService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      writerMembership,
    );
    const marker = Marker.create({
      campaignId: "campaign-1",
      name: "Old Mill",
      lat: 1,
      lng: 1,
    });
    vi.mocked(markerService.createMarker).mockResolvedValue(marker);
    const context = makeContext(
      markerService,
      territoryService,
      campaignMemberService,
      authenticatedUser,
    );
    const input = {
      campaignId: "campaign-1",
      name: "Old Mill",
      lat: 1,
      lng: 1,
    };

    const result = await Mutation.createMarker(undefined, { input }, context);

    expect(markerService.createMarker).toHaveBeenCalledWith(input);
    expect(result).toBe(marker);
  });
});

describe("map Mutation.updateMarker", () => {
  it("rejects with FORBIDDEN when not a member of the marker's campaign", async () => {
    const markerService = makeMarkerService();
    const territoryService = makeTerritoryService();
    const campaignMemberService = makeCampaignMemberService();
    const marker = Marker.create({
      campaignId: "campaign-1",
      name: "Old Mill",
      lat: 1,
      lng: 1,
    });
    vi.mocked(markerService.getMarker).mockResolvedValue(marker);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(null);
    const context = makeContext(
      markerService,
      territoryService,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Mutation.updateMarker(
        undefined,
        { input: { id: "marker-1", name: "New Mill" } },
        context,
      ),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(markerService.updateMarker).not.toHaveBeenCalled();
  });

  it("delegates to markerService for a campaign writer", async () => {
    const markerService = makeMarkerService();
    const territoryService = makeTerritoryService();
    const campaignMemberService = makeCampaignMemberService();
    const existing = Marker.create({
      campaignId: "campaign-1",
      name: "Old Mill",
      lat: 1,
      lng: 1,
    });
    vi.mocked(markerService.getMarker).mockResolvedValue(existing);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      writerMembership,
    );
    const updated = Marker.create({
      campaignId: "campaign-1",
      name: "New Mill",
      lat: 1,
      lng: 1,
    });
    vi.mocked(markerService.updateMarker).mockResolvedValue(updated);
    const context = makeContext(
      markerService,
      territoryService,
      campaignMemberService,
      authenticatedUser,
    );
    const input = { id: "marker-1", name: "New Mill" };

    const result = await Mutation.updateMarker(undefined, { input }, context);

    expect(markerService.updateMarker).toHaveBeenCalledWith(input);
    expect(result).toBe(updated);
  });
});

describe("map Mutation.deleteMarker", () => {
  it("delegates to markerService and returns true for a campaign writer", async () => {
    const markerService = makeMarkerService();
    const territoryService = makeTerritoryService();
    const campaignMemberService = makeCampaignMemberService();
    const marker = Marker.create({
      campaignId: "campaign-1",
      name: "Old Mill",
      lat: 1,
      lng: 1,
    });
    vi.mocked(markerService.getMarker).mockResolvedValue(marker);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      writerMembership,
    );
    vi.mocked(markerService.deleteMarker).mockResolvedValue(undefined);
    const context = makeContext(
      markerService,
      territoryService,
      campaignMemberService,
      authenticatedUser,
    );

    const result = await Mutation.deleteMarker(
      undefined,
      { id: "marker-1" },
      context,
    );

    expect(markerService.deleteMarker).toHaveBeenCalledWith("marker-1");
    expect(result).toBe(true);
  });
});

describe("map Mutation.createTerritory", () => {
  it("rejects with FORBIDDEN when the member's role cannot write", async () => {
    const markerService = makeMarkerService();
    const territoryService = makeTerritoryService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      playerMembership,
    );
    const context = makeContext(
      markerService,
      territoryService,
      campaignMemberService,
      authenticatedUser,
    );
    const input = {
      campaignId: "campaign-1",
      name: "Thornwood",
      type: "region",
      geometry: JSON.stringify(territoryGeometry),
    };

    await expect(
      Mutation.createTerritory(undefined, { input }, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(territoryService.createTerritory).not.toHaveBeenCalled();
  });

  it("rejects malformed geometry JSON with BAD_USER_INPUT", async () => {
    const markerService = makeMarkerService();
    const territoryService = makeTerritoryService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      writerMembership,
    );
    const context = makeContext(
      markerService,
      territoryService,
      campaignMemberService,
      authenticatedUser,
    );
    const input = {
      campaignId: "campaign-1",
      name: "Thornwood",
      type: "region",
      geometry: "{not-json",
    };

    await expect(
      Mutation.createTerritory(undefined, { input }, context),
    ).rejects.toMatchObject({ extensions: { code: "BAD_USER_INPUT" } });
    expect(territoryService.createTerritory).not.toHaveBeenCalled();
  });

  it("parses geometry JSON and delegates to territoryService", async () => {
    const markerService = makeMarkerService();
    const territoryService = makeTerritoryService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      writerMembership,
    );
    const territory = Territory.create({
      campaignId: "campaign-1",
      name: "Thornwood",
      type: "region",
      geometry: territoryGeometry,
    });
    vi.mocked(territoryService.createTerritory).mockResolvedValue(territory);
    const context = makeContext(
      markerService,
      territoryService,
      campaignMemberService,
      authenticatedUser,
    );
    const input = {
      campaignId: "campaign-1",
      name: "Thornwood",
      type: "region",
      geometry: JSON.stringify(territoryGeometry),
    };

    const result = await Mutation.createTerritory(
      undefined,
      { input },
      context,
    );

    expect(territoryService.createTerritory).toHaveBeenCalledWith({
      ...input,
      geometry: territoryGeometry,
    });
    expect(result).toBe(territory);
  });
});

describe("map Mutation.updateTerritory", () => {
  it("delegates to territoryService for a campaign writer, parsing geometry when provided", async () => {
    const markerService = makeMarkerService();
    const territoryService = makeTerritoryService();
    const campaignMemberService = makeCampaignMemberService();
    const existing = Territory.create({
      campaignId: "campaign-1",
      name: "Thornwood",
      type: "region",
      geometry: territoryGeometry,
    });
    vi.mocked(territoryService.getTerritory).mockResolvedValue(existing);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      writerMembership,
    );
    const updated = Territory.create({
      campaignId: "campaign-1",
      name: "Blackwood",
      type: "district",
      geometry: territoryGeometry,
    });
    vi.mocked(territoryService.updateTerritory).mockResolvedValue(updated);
    const context = makeContext(
      markerService,
      territoryService,
      campaignMemberService,
      authenticatedUser,
    );
    const input = { id: "territory-1", name: "Blackwood", type: "district" };

    const result = await Mutation.updateTerritory(
      undefined,
      { input },
      context,
    );

    expect(territoryService.updateTerritory).toHaveBeenCalledWith({
      ...input,
      geometry: undefined,
    });
    expect(result).toBe(updated);
  });
});

describe("map Mutation.deleteTerritory", () => {
  it("delegates to territoryService and returns true for a campaign writer", async () => {
    const markerService = makeMarkerService();
    const territoryService = makeTerritoryService();
    const campaignMemberService = makeCampaignMemberService();
    const territory = Territory.create({
      campaignId: "campaign-1",
      name: "Thornwood",
      type: "region",
      geometry: territoryGeometry,
    });
    vi.mocked(territoryService.getTerritory).mockResolvedValue(territory);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      writerMembership,
    );
    vi.mocked(territoryService.deleteTerritory).mockResolvedValue(undefined);
    const context = makeContext(
      markerService,
      territoryService,
      campaignMemberService,
      authenticatedUser,
    );

    const result = await Mutation.deleteTerritory(
      undefined,
      { id: "territory-1" },
      context,
    );

    expect(territoryService.deleteTerritory).toHaveBeenCalledWith(
      "territory-1",
    );
    expect(result).toBe(true);
  });
});
