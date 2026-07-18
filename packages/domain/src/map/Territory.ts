import { ValidationError } from "../shared";
import { TerritoryId } from "./TerritoryId";

export type TerritoryGeometry = Record<string, unknown>;

export interface CreateTerritoryProps {
  campaignId: string;
  name: string;
  type: string;
  geometry: TerritoryGeometry;
  description?: string | null;
  entityId?: string | null;
}

export interface RehydrateTerritoryProps {
  id: TerritoryId;
  campaignId: string;
  name: string;
  type: string;
  geometry: TerritoryGeometry;
  description: string | null;
  entityId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const MAX_GEOMETRY_JSON_LENGTH = 50_000;

// A shaped area on a campaign's map (KAN-51) — territories, regions, and
// districts are all this one entity, distinguished only by a free-string
// `type` (e.g. "territory", "region", "district", or any campaign-specific
// label), matching the Entity/Relationship pattern used elsewhere in the
// domain rather than a bespoke Region/District class hierarchy.
//
// The link to an Entity is optional (KAN-116); TerritoryService checks that
// the entity belongs to the same campaign.
export class Territory {
  private constructor(
    private readonly idValue: TerritoryId,
    private readonly campaignIdValue: string,
    private nameValue: string,
    private typeValue: string,
    private geometryValue: TerritoryGeometry,
    private descriptionValue: string | null,
    private entityIdValue: string | null,
    private readonly createdAtValue: Date,
    private updatedAtValue: Date,
  ) {
    this.validateName(nameValue);
    this.validateType(typeValue);
    this.validateGeometry(geometryValue);
    this.validateDescription(descriptionValue);
  }

  static create(props: CreateTerritoryProps): Territory {
    return new Territory(
      TerritoryId.create(),
      props.campaignId,
      props.name,
      props.type,
      props.geometry,
      props.description ?? null,
      props.entityId ?? null,
      new Date(),
      new Date(),
    );
  }

  static rehydrate(props: RehydrateTerritoryProps): Territory {
    return new Territory(
      props.id,
      props.campaignId,
      props.name,
      props.type,
      props.geometry,
      props.description,
      props.entityId,
      props.createdAt,
      props.updatedAt,
    );
  }

  get Id(): TerritoryId {
    return this.idValue;
  }

  get CampaignId(): string {
    return this.campaignIdValue;
  }

  get Name(): string {
    return this.nameValue;
  }

  get Type(): string {
    return this.typeValue;
  }

  get Geometry(): TerritoryGeometry {
    return this.geometryValue;
  }

  get Description(): string | null {
    return this.descriptionValue;
  }

  get EntityId(): string | null {
    return this.entityIdValue;
  }

  get CreatedAt(): Date {
    return this.createdAtValue;
  }

  get UpdatedAt(): Date {
    return this.updatedAtValue;
  }

  rename(name: string): void {
    this.validateName(name);

    this.nameValue = name.trim();
    this.updatedAtValue = new Date();
  }

  changeType(type: string): void {
    this.validateType(type);

    this.typeValue = type;
    this.updatedAtValue = new Date();
  }

  changeGeometry(geometry: TerritoryGeometry): void {
    this.validateGeometry(geometry);

    this.geometryValue = geometry;
    this.updatedAtValue = new Date();
  }

  changeDescription(description: string | null): void {
    this.validateDescription(description);

    this.descriptionValue = description;
    this.updatedAtValue = new Date();
  }

  // Cross-aggregate validation lives in TerritoryService — see Marker.linkEntity.
  linkEntity(entityId: string | null): void {
    this.entityIdValue = entityId;
    this.updatedAtValue = new Date();
  }

  private validateName(name: string): void {
    const trimmed = name.trim();

    if (!trimmed) {
      throw new ValidationError("Territory name cannot be empty.");
    }

    if (trimmed.length > 255) {
      throw new ValidationError("Territory name cannot exceed 255 characters.");
    }
  }

  private validateType(type: string): void {
    const trimmed = type.trim();

    if (!trimmed) {
      throw new ValidationError("Territory type is required.");
    }

    if (trimmed.length > 100) {
      throw new ValidationError("Territory type is too long.");
    }
  }

  // Lightweight structural check only — the domain has no GeoJSON parser
  // dependency (packages/domain has no external dependencies by design).
  // A real "is this valid GeoJSON" validation belongs at the GraphQL/API
  // boundary if it's ever needed; this just stops obviously-wrong input
  // (missing/empty, not an object, no coordinates) and an unbounded blob.
  private validateGeometry(geometry: TerritoryGeometry): void {
    if (
      typeof geometry !== "object" ||
      geometry === null ||
      Array.isArray(geometry)
    ) {
      throw new ValidationError("Territory geometry must be a JSON object.");
    }

    if (typeof geometry.type !== "string" || !geometry.type.trim()) {
      throw new ValidationError(
        'Territory geometry must have a GeoJSON "type" field.',
      );
    }

    if (!("coordinates" in geometry)) {
      throw new ValidationError(
        'Territory geometry must have a "coordinates" field.',
      );
    }

    if (JSON.stringify(geometry).length > MAX_GEOMETRY_JSON_LENGTH) {
      throw new ValidationError("Territory geometry is too large to save.");
    }
  }

  private validateDescription(description: string | null): void {
    if (description === null) {
      return;
    }

    if (description.length > 1000) {
      throw new ValidationError(
        "Territory description cannot exceed 1000 characters.",
      );
    }
  }
}
