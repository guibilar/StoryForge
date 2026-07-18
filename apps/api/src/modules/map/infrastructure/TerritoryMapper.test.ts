import { describe, expect, it } from "vitest";
import { Territory } from "@storyforge/domain";
import type { Territory as PrismaTerritory } from "@storyforge/database";
import { TerritoryMapper } from "./TerritoryMapper";

const geometry = {
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

describe("TerritoryMapper", () => {
  it("maps a persistence record to a domain territory", () => {
    const record: PrismaTerritory = {
      id: "11111111-1111-1111-1111-111111111111",
      campaignId: "22222222-2222-2222-2222-222222222222",
      name: "Thornwood",
      type: "region",
      geometry,
      description: "The forest north of the river.",
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-02-01T00:00:00Z"),
    };

    const territory = TerritoryMapper.toDomain(record);

    expect(territory.Id.toString()).toBe(record.id);
    expect(territory.CampaignId).toBe(record.campaignId);
    expect(territory.Name).toBe(record.name);
    expect(territory.Type).toBe(record.type);
    expect(territory.Geometry).toEqual(geometry);
    expect(territory.Description).toBe(record.description);
    expect(territory.CreatedAt).toEqual(record.createdAt);
    expect(territory.UpdatedAt).toEqual(record.updatedAt);
  });

  it("maps a domain territory to a persistence shape", () => {
    const territory = Territory.create({
      campaignId: "22222222-2222-2222-2222-222222222222",
      name: "Thornwood",
      type: "region",
      geometry,
      description: "The forest north of the river.",
    });

    const record = TerritoryMapper.toPersistence(territory);

    expect(record).toEqual({
      id: territory.Id.toString(),
      campaignId: territory.CampaignId,
      name: territory.Name,
      type: territory.Type,
      geometry: territory.Geometry,
      description: territory.Description,
      createdAt: territory.CreatedAt,
      updatedAt: territory.UpdatedAt,
    });
  });
});
