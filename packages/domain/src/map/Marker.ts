import { ValidationError } from "../shared";
import { MarkerId } from "./MarkerId";

export interface CreateMarkerProps {
  campaignId: string;
  name: string;
  lat: number;
  lng: number;
  description?: string | null;
}

export interface RehydrateMarkerProps {
  id: MarkerId;
  campaignId: string;
  name: string;
  lat: number;
  lng: number;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// A single point on a campaign's map (KAN-51). Deliberately not tied to an
// Entity — a marker can label a place ("Old Mill", "Ambush site") without
// there being a corresponding world-data Entity for it. Linking a marker to
// an Entity is a decision for a future ticket, not implied by this one.
export class Marker {
  private constructor(
    private readonly idValue: MarkerId,
    private readonly campaignIdValue: string,
    private nameValue: string,
    private latValue: number,
    private lngValue: number,
    private descriptionValue: string | null,
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
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      throw new ValidationError("Marker latitude must be between -90 and 90.");
    }

    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      throw new ValidationError(
        "Marker longitude must be between -180 and 180.",
      );
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
