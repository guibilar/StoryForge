import { describe, expect, it } from "vitest";
import { MapImage } from "./MapImage";
import { MapImageId } from "./MapImageId";

const validProps = {
  campaignId: "campaign-1",
  url: "/uploads/campaign-1/abc.png",
  fileName: "fantasy-map.png",
  mimeType: "image/png",
  sizeBytes: 12345,
  width: 2000,
  height: 1500,
};

describe("MapImage", () => {
  it("creates a map image with the given fields", () => {
    const mapImage = MapImage.create(validProps);

    expect(mapImage.CampaignId).toBe(validProps.campaignId);
    expect(mapImage.Url).toBe(validProps.url);
    expect(mapImage.FileName).toBe(validProps.fileName);
    expect(mapImage.MimeType).toBe(validProps.mimeType);
    expect(mapImage.SizeBytes).toBe(validProps.sizeBytes);
    expect(mapImage.Width).toBe(validProps.width);
    expect(mapImage.Height).toBe(validProps.height);
  });

  it("rehydrates preserving id and timestamps", () => {
    const id = MapImageId.create();
    const createdAt = new Date("2024-01-01T00:00:00Z");
    const updatedAt = new Date("2024-02-01T00:00:00Z");

    const mapImage = MapImage.rehydrate({
      id,
      ...validProps,
      createdAt,
      updatedAt,
    });

    expect(mapImage.Id.equals(id)).toBe(true);
    expect(mapImage.CreatedAt).toBe(createdAt);
    expect(mapImage.UpdatedAt).toBe(updatedAt);
  });

  it("rejects an empty file name", () => {
    expect(() => MapImage.create({ ...validProps, fileName: "  " })).toThrow(
      "Map image file name cannot be empty.",
    );
  });

  it("rejects a file name longer than 255 characters", () => {
    expect(() =>
      MapImage.create({ ...validProps, fileName: "a".repeat(256) }),
    ).toThrow("Map image file name cannot exceed 255 characters.");
  });

  it.each(["image/svg+xml", "application/pdf", "text/plain"])(
    "rejects an invalid mime type %s",
    (mimeType) => {
      expect(() => MapImage.create({ ...validProps, mimeType })).toThrow(
        "Invalid file type. Only JPEG, PNG, GIF, and WEBP are allowed.",
      );
    },
  );

  it.each(["image/jpeg", "image/png", "image/gif", "image/webp"])(
    "accepts a valid mime type %s",
    (mimeType) => {
      expect(MapImage.create({ ...validProps, mimeType }).MimeType).toBe(
        mimeType,
      );
    },
  );

  it.each([0, -1, 1.5])("rejects a non-positive-integer width %j", (width) => {
    expect(() => MapImage.create({ ...validProps, width })).toThrow(
      "Map image width must be a positive integer.",
    );
  });

  it.each([0, -1, 1.5])(
    "rejects a non-positive-integer height %j",
    (height) => {
      expect(() => MapImage.create({ ...validProps, height })).toThrow(
        "Map image height must be a positive integer.",
      );
    },
  );

  it("replaces the image in place, preserving id", () => {
    const mapImage = MapImage.create(validProps);
    const id = mapImage.Id;
    const replacement = {
      url: "/uploads/campaign-1/def.png",
      fileName: "new-map.png",
      mimeType: "image/webp",
      sizeBytes: 999,
      width: 800,
      height: 600,
    };

    mapImage.replaceImage(replacement);

    expect(mapImage.Id.equals(id)).toBe(true);
    expect(mapImage.Url).toBe(replacement.url);
    expect(mapImage.FileName).toBe(replacement.fileName);
    expect(mapImage.MimeType).toBe(replacement.mimeType);
    expect(mapImage.SizeBytes).toBe(replacement.sizeBytes);
    expect(mapImage.Width).toBe(replacement.width);
    expect(mapImage.Height).toBe(replacement.height);
  });

  it("rejects replacing with an invalid mime type", () => {
    const mapImage = MapImage.create(validProps);

    expect(() =>
      mapImage.replaceImage({
        ...validProps,
        mimeType: "application/pdf",
      }),
    ).toThrow("Invalid file type. Only JPEG, PNG, GIF, and WEBP are allowed.");
  });
});
