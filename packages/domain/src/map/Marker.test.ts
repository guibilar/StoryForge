import { describe, expect, it } from "vitest";
import { Marker } from "./Marker";
import { MarkerId } from "./MarkerId";

const validProps = {
  campaignId: "campaign-1",
  name: "Old Mill",
  lat: 51.505,
  lng: -0.09,
  description: "Abandoned mill on the river.",
};

describe("Marker", () => {
  it("creates a marker with defaults", () => {
    const marker = Marker.create(validProps);

    expect(marker.CampaignId).toBe(validProps.campaignId);
    expect(marker.Name).toBe(validProps.name);
    expect(marker.Lat).toBe(validProps.lat);
    expect(marker.Lng).toBe(validProps.lng);
    expect(marker.Description).toBe(validProps.description);
  });

  it("defaults description to null when omitted", () => {
    const marker = Marker.create({
      campaignId: "campaign-1",
      name: "Old Mill",
      lat: 51.505,
      lng: -0.09,
    });

    expect(marker.Description).toBeNull();
  });

  it("rehydrates preserving id and timestamps", () => {
    const id = MarkerId.create();
    const createdAt = new Date("2024-01-01T00:00:00Z");
    const updatedAt = new Date("2024-02-01T00:00:00Z");

    const marker = Marker.rehydrate({
      id,
      campaignId: validProps.campaignId,
      name: validProps.name,
      lat: validProps.lat,
      lng: validProps.lng,
      description: null,
      createdAt,
      updatedAt,
    });

    expect(marker.Id.equals(id)).toBe(true);
    expect(marker.CreatedAt).toBe(createdAt);
    expect(marker.UpdatedAt).toBe(updatedAt);
  });

  it("rejects an empty name", () => {
    expect(() => Marker.create({ ...validProps, name: "  " })).toThrow(
      "Marker name cannot be empty.",
    );
  });

  it("rejects a name longer than 255 characters", () => {
    expect(() =>
      Marker.create({ ...validProps, name: "a".repeat(256) }),
    ).toThrow("Marker name cannot exceed 255 characters.");
  });

  it.each([-91, 91, NaN, Infinity])(
    "rejects an out-of-range latitude %j",
    (lat) => {
      expect(() => Marker.create({ ...validProps, lat })).toThrow(
        "Marker latitude must be between -90 and 90.",
      );
    },
  );

  it.each([-181, 181, NaN, Infinity])(
    "rejects an out-of-range longitude %j",
    (lng) => {
      expect(() => Marker.create({ ...validProps, lng })).toThrow(
        "Marker longitude must be between -180 and 180.",
      );
    },
  );

  it("rejects a description longer than 1000 characters", () => {
    expect(() =>
      Marker.create({ ...validProps, description: "a".repeat(1001) }),
    ).toThrow("Marker description cannot exceed 1000 characters.");
  });

  it("renames, moves, and changes description", () => {
    const marker = Marker.create(validProps);

    marker.rename("New Mill");
    marker.moveTo(10, 20);
    marker.changeDescription("Rebuilt.");

    expect(marker.Name).toBe("New Mill");
    expect(marker.Lat).toBe(10);
    expect(marker.Lng).toBe(20);
    expect(marker.Description).toBe("Rebuilt.");
  });

  it("rejects moving to an out-of-range position", () => {
    const marker = Marker.create(validProps);

    expect(() => marker.moveTo(91, 0)).toThrow(
      "Marker latitude must be between -90 and 90.",
    );
  });
});
