import { afterEach, describe, expect, it, vi } from "vitest";
import { Territory } from "./Territory";
import { TerritoryId } from "./TerritoryId";

const validProps = {
  campaignId: "campaign-1",
  name: "Thornwood",
  type: "region",
  geometry: {
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
  },
  description: "The forest north of the river.",
};

describe("Territory", () => {
  it("creates a territory with defaults", () => {
    const territory = Territory.create(validProps);

    expect(territory.CampaignId).toBe(validProps.campaignId);
    expect(territory.Name).toBe(validProps.name);
    expect(territory.Type).toBe(validProps.type);
    expect(territory.Geometry).toEqual(validProps.geometry);
    expect(territory.Description).toBe(validProps.description);
  });

  it("defaults description to null when omitted", () => {
    const territory = Territory.create({
      campaignId: "campaign-1",
      name: "Thornwood",
      type: "region",
      geometry: validProps.geometry,
    });

    expect(territory.Description).toBeNull();
  });

  it("rehydrates preserving id and timestamps", () => {
    const id = TerritoryId.create();
    const createdAt = new Date("2024-01-01T00:00:00Z");
    const updatedAt = new Date("2024-02-01T00:00:00Z");

    const territory = Territory.rehydrate({
      id,
      campaignId: validProps.campaignId,
      name: validProps.name,
      type: validProps.type,
      geometry: validProps.geometry,
      description: null,
      createdAt,
      updatedAt,
    });

    expect(territory.Id.equals(id)).toBe(true);
    expect(territory.CreatedAt).toBe(createdAt);
    expect(territory.UpdatedAt).toBe(updatedAt);
  });

  it("rejects an empty name", () => {
    expect(() => Territory.create({ ...validProps, name: " " })).toThrow(
      "Territory name cannot be empty.",
    );
  });

  it("rejects an empty type", () => {
    expect(() => Territory.create({ ...validProps, type: " " })).toThrow(
      "Territory type is required.",
    );
  });

  it("accepts any free-string type (district, region, territory, or custom)", () => {
    for (const type of ["district", "region", "territory", "kingdom"]) {
      expect(Territory.create({ ...validProps, type }).Type).toBe(type);
    }
  });

  it("rejects geometry that isn't an object", () => {
    expect(() =>
      Territory.create({
        ...validProps,
        geometry: "not-an-object" as unknown as Record<string, unknown>,
      }),
    ).toThrow("Territory geometry must be a JSON object.");
  });

  it("rejects geometry missing a GeoJSON type field", () => {
    expect(() =>
      Territory.create({ ...validProps, geometry: { coordinates: [] } }),
    ).toThrow('Territory geometry must have a GeoJSON "type" field.');
  });

  it("rejects geometry missing coordinates", () => {
    expect(() =>
      Territory.create({ ...validProps, geometry: { type: "Polygon" } }),
    ).toThrow('Territory geometry must have a "coordinates" field.');
  });

  it("rejects a description longer than 1000 characters", () => {
    expect(() =>
      Territory.create({ ...validProps, description: "a".repeat(1001) }),
    ).toThrow("Territory description cannot exceed 1000 characters.");
  });

  it("renames, changes type, geometry, and description", () => {
    const territory = Territory.create(validProps);
    const newGeometry = { type: "Point", coordinates: [1, 2] };

    territory.rename("Blackwood");
    territory.changeType("district");
    territory.changeGeometry(newGeometry);
    territory.changeDescription("Updated.");

    expect(territory.Name).toBe("Blackwood");
    expect(territory.Type).toBe("district");
    expect(territory.Geometry).toEqual(newGeometry);
    expect(territory.Description).toBe("Updated.");
  });

  describe("entity link", () => {
    it("defaults to unlinked", () => {
      const territory = Territory.create({
        campaignId: "22222222-2222-2222-2222-222222222222",
        name: "Thornwood",
        type: "region",
        geometry: { type: "Polygon", coordinates: [] },
      });

      expect(territory.EntityId).toBeNull();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("links and unlinks, bumping updatedAt", () => {
      const territory = Territory.create({
        campaignId: "22222222-2222-2222-2222-222222222222",
        name: "Thornwood",
        type: "region",
        geometry: { type: "Polygon", coordinates: [] },
      });
      const before = territory.UpdatedAt;
      // Real timers can tie in the same millisecond on a fast run — advance
      // the clock deterministically instead of racing a real setTimeout.
      vi.useFakeTimers();
      vi.setSystemTime(new Date(before.getTime() + 1));

      territory.linkEntity("entity-1");
      expect(territory.EntityId).toBe("entity-1");
      expect(territory.UpdatedAt.getTime()).toBeGreaterThan(before.getTime());

      territory.linkEntity(null);
      expect(territory.EntityId).toBeNull();
    });

    it("accepts any id — belonging to the campaign is the service's question", () => {
      const territory = Territory.create({
        campaignId: "22222222-2222-2222-2222-222222222222",
        name: "Thornwood",
        type: "region",
        geometry: { type: "Polygon", coordinates: [] },
      });

      expect(() => territory.linkEntity("entity-from-anywhere")).not.toThrow();
    });
  });
});
