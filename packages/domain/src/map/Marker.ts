import { ValidationError } from "../shared";
import { MarkerId } from "./MarkerId";

export interface CreateMarkerProps {
  campaignId: string;
  name: string;
  lat: number;
  lng: number;
  description?: string | null;
  entityId?: string | null;
}

export interface RehydrateMarkerProps {
  id: MarkerId;
  campaignId: string;
  name: string;
  lat: number;
  lng: number;
  description: string | null;
  entityId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// A single point on a campaign's map (KAN-51). The link to an Entity is
// optional (KAN-116) and stays that way: a marker can label a place ("Old
// Mill", "Ambush site") without there being a corresponding world-data Entity
// for it. Whether the linked entity belongs to the same campaign is checked by
// MarkerService, which has the campaign in hand — same split as Event/Session.
//
// lat/lng are coordinates in whatever CRS the campaign's map is currently
// using, not necessarily real-world geographic degrees: under the default
// tile layer (KAN-50) they are geographic lat/lng, but under a campaign's
// custom map image (KAN-52, Leaflet CRS.Simple) they are pixel coordinates,
// which routinely exceed ±90/±180 for any reasonably-sized image. Only
// finiteness is validated here — a real range would make markers unusable
// on custom map images.
export class Marker {
  private constructor(
    private readonly idValue: MarkerId,
    private readonly campaignIdValue: string,
    private nameValue: string,
    private latValue: number,
    private lngValue: number,
    private descriptionValue: string | null,
    private entityIdValue: string | null,
    private readonly createdAtValue: Date,
    private updatedAtValue: Date,
  ) {
    this.validateName(nameValue);
    this.validatePosition(latValue, lngValue);
    this.validateDescription(descriptionValue);
  }

  static create(props: CreateMarkerProps): Marker {
    return new Marker(
      MarkerId.create(),
      props.campaignId,
      props.name,
      props.lat,
      props.lng,
      props.description ?? null,
      props.entityId ?? null,
      new Date(),
      new Date(),
    );
  }

  static rehydrate(props: RehydrateMarkerProps): Marker {
    return new Marker(
      props.id,
      props.campaignId,
      props.name,
      props.lat,
      props.lng,
      props.description,
      props.entityId,
      props.createdAt,
      props.updatedAt,
    );
  }

  get Id(): MarkerId {
    return this.idValue;
  }

  get CampaignId(): string {
    return this.campaignIdValue;
  }

  get Name(): string {
    return this.nameValue;
  }

  get Lat(): number {
    return this.latValue;
  }

  get Lng(): number {
    return this.lngValue;
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

  moveTo(lat: number, lng: number): void {
    this.validatePosition(lat, lng);

    this.latValue = lat;
    this.lngValue = lng;
    this.updatedAtValue = new Date();
  }

  changeDescription(description: string | null): void {
    this.validateDescription(description);

    this.descriptionValue = description;
    this.updatedAtValue = new Date();
  }

  // No validation here — that the entity exists and belongs to this marker's
  // campaign is a cross-aggregate question, answered in MarkerService. Mirrors
  // Event.changeSession.
  linkEntity(entityId: string | null): void {
    this.entityIdValue = entityId;
    this.updatedAtValue = new Date();
  }

  private validateName(name: string): void {
    const trimmed = name.trim();

    if (!trimmed) {
      throw new ValidationError("Marker name cannot be empty.");
    }

    if (trimmed.length > 255) {
      throw new ValidationError("Marker name cannot exceed 255 characters.");
    }
  }

  private validatePosition(lat: number, lng: number): void {
    if (!Number.isFinite(lat)) {
      throw new ValidationError("Marker latitude must be a finite number.");
    }

    if (!Number.isFinite(lng)) {
      throw new ValidationError("Marker longitude must be a finite number.");
    }
  }

  private validateDescription(description: string | null): void {
    if (description === null) {
      return;
    }

    if (description.length > 1000) {
      throw new ValidationError(
        "Marker description cannot exceed 1000 characters.",
      );
    }
  }
}
