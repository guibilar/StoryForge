import { ValidationError } from "../shared";
import { EventId } from "./EventId";

export interface CreateEventProps {
  campaignId: string;
  sessionId?: string | null;
  title: string;
  description?: string | null;
  occurredAt: Date;
}

export interface RehydrateEventProps {
  id: EventId;
  campaignId: string;
  sessionId: string | null;
  title: string;
  description: string | null;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class Event {
  private constructor(
    private readonly idValue: EventId,
    private readonly campaignIdValue: string,
    private sessionIdValue: string | null,
    private titleValue: string,
    private descriptionValue: string | null,
    private occurredAtValue: Date,
    private readonly createdAtValue: Date,
    private updatedAtValue: Date,
  ) {
    this.validateTitle(titleValue);
    this.validateDescription(descriptionValue);
  }

  static create(props: CreateEventProps): Event {
    return new Event(
      EventId.create(),
      props.campaignId,
      props.sessionId ?? null,
      props.title,
      props.description ?? null,
      props.occurredAt,
      new Date(),
      new Date(),
    );
  }

  static rehydrate(props: RehydrateEventProps): Event {
    return new Event(
      props.id,
      props.campaignId,
      props.sessionId,
      props.title,
      props.description,
      props.occurredAt,
      props.createdAt,
      props.updatedAt,
    );
  }

  get Id(): EventId {
    return this.idValue;
  }

  get CampaignId(): string {
    return this.campaignIdValue;
  }

  get SessionId(): string | null {
    return this.sessionIdValue;
  }

  get Title(): string {
    return this.titleValue;
  }

  get Description(): string | null {
    return this.descriptionValue;
  }

  get OccurredAt(): Date {
    return this.occurredAtValue;
  }

  get CreatedAt(): Date {
    return this.createdAtValue;
  }

  get UpdatedAt(): Date {
    return this.updatedAtValue;
  }

  changeTitle(title: string): void {
    this.validateTitle(title);

    this.titleValue = title;
    this.updatedAtValue = new Date();
  }

  changeDescription(description: string | null): void {
    this.validateDescription(description);

    this.descriptionValue = description;
    this.updatedAtValue = new Date();
  }

  changeOccurredAt(occurredAt: Date): void {
    this.occurredAtValue = occurredAt;
    this.updatedAtValue = new Date();
  }

  changeSession(sessionId: string | null): void {
    this.sessionIdValue = sessionId;
    this.updatedAtValue = new Date();
  }

  private validateTitle(title: string): void {
    const trimmed = title.trim();

    if (!trimmed) {
      throw new ValidationError("Event title cannot be empty.");
    }

    if (trimmed.length > 255) {
      throw new ValidationError("Event title cannot exceed 255 characters.");
    }
  }

  private validateDescription(description: string | null): void {
    if (description === null) {
      return;
    }

    if (description.length > 1000) {
      throw new ValidationError(
        "Event description cannot exceed 1000 characters.",
      );
    }
  }
}
