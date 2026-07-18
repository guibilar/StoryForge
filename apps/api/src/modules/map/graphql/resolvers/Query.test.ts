import { describe, expect, it, vi } from "vitest";
import {
  CampaignMember,
  Marker,
  NotFoundError,
  Territory,
  User,
} from "@storyforge/domain";
import { Query } from "./Query";
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

const membership = CampaignMember.create({
  campaignId: "campaign-1",
  userId: authenticatedUser.Id,
  role: "PLAYER",
});

describe("map Query.marker", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
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
    const context = makeContext(
      markerService,
      territoryService,
      campaignMemberService,
      loggedOutUser,
    );

    await expect(
      Query.marker(undefined, { id: "marker-1" }, context),
    ).rejects.toMatchObject({ extensions: { code: "UNAUTHENTICATED" } });
  });

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
      Query.marker(undefined, { id: "marker-1" }, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
  });

  it("returns the marker when the user is a campaign member", async () => {
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
      membership,
    );
    const context = makeContext(
      markerService,
      territoryService,
      campaignMemberService,
      authenticatedUser,
    );

    const result = await Query.marker(undefined, { id: "marker-1" }, context);

    expect(markerService.getMarker).toHaveBeenCalledWith("marker-1");
    expect(result).toBe(marker);
  });

  it("translates domain errors into GraphQL errors", async () => {
    const markerService = makeMarkerService();
    const territoryService = makeTerritoryService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(markerService.getMarker).mockRejectedValue(
      new NotFoundError("Marker not found"),
    );
    const context = makeContext(
      markerService,
      territoryService,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Query.marker(undefined, { id: "missing" }, context),
    ).rejects.toMatchObject({ extensions: { code: "NOT_FOUND" } });
  });
});

describe("map Query.markers", () => {
  it("rejects with FORBIDDEN when not a campaign member", async () => {
    const markerService = makeMarkerService();
    const territoryService = makeTerritoryService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(null);
    const context = makeContext(
      markerService,
      territoryService,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Query.markers(undefined, { campaignId: "campaign-1" }, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(markerService.listMarkers).not.toHaveBeenCalled();
  });

  it("delegates to the service", async () => {
    const markerService = makeMarkerService();
    const territoryService = makeTerritoryService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    const markers = [
      Marker.create({
        campaignId: "campaign-1",
        name: "Old Mill",
        lat: 1,
        lng: 1,
      }),
    ];
    vi.mocked(markerService.listMarkers).mockResolvedValue(markers);
    const context = makeContext(
      markerService,
      territoryService,
      campaignMemberService,
      authenticatedUser,
    );

    const result = await Query.markers(
      undefined,
      { campaignId: "campaign-1" },
      context,
    );

    expect(markerService.listMarkers).toHaveBeenCalledWith("campaign-1");
    expect(result).toBe(markers);
  });
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

describe("map Query.territory", () => {
  it("rejects with FORBIDDEN when not a member of the territory's campaign", async () => {
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
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(null);
    const context = makeContext(
      markerService,
      territoryService,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Query.territory(undefined, { id: "territory-1" }, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
  });

  it("returns the territory when the user is a campaign member", async () => {
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
      membership,
    );
    const context = makeContext(
      markerService,
      territoryService,
      campaignMemberService,
      authenticatedUser,
    );

    const result = await Query.territory(
      undefined,
      { id: "territory-1" },
      context,
    );

    expect(territoryService.getTerritory).toHaveBeenCalledWith("territory-1");
    expect(result).toBe(territory);
  });
});

describe("map Query.territories", () => {
  it("delegates to the service", async () => {
    const markerService = makeMarkerService();
    const territoryService = makeTerritoryService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    const territories = [
      Territory.create({
        campaignId: "campaign-1",
        name: "Thornwood",
        type: "region",
        geometry: territoryGeometry,
      }),
    ];
    vi.mocked(territoryService.listTerritories).mockResolvedValue(territories);
    const context = makeContext(
      markerService,
      territoryService,
      campaignMemberService,
      authenticatedUser,
    );

    const result = await Query.territories(
      undefined,
      { campaignId: "campaign-1" },
      context,
    );

    expect(territoryService.listTerritories).toHaveBeenCalledWith("campaign-1");
    expect(result).toBe(territories);
  });
});
