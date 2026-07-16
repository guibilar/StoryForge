import { ValidationError } from "../shared";
import { SessionId } from "./SessionId";

export interface CreateSessionProps {
  campaignId: string;
  sessionNumber: number;
  date: Date;
  summary?: string | null;
}

export interface RehydrateSessionProps {
  id: SessionId;
  campaignId: string;
  sessionNumber: number;
  date: Date;
  summary: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Session {
  private constructor(
    private readonly idValue: SessionId,
    private readonly campaignIdValue: string,
    private readonly sessionNumberValue: number,
    private dateValue: Date,
    private summaryValue: string | null,
    private readonly createdAtValue: Date,
    private updatedAtValue: Date,
  ) {
    this.validateSessionNumber(sessionNumberValue);
    this.validateSummary(summaryValue);
  }

  static create(props: CreateSessionProps): Session {
    return new Session(
      SessionId.create(),
      props.campaignId,
      props.sessionNumber,
      props.date,
      props.summary ?? null,
      new Date(),
      new Date(),
    );
  }

  static rehydrate(props: RehydrateSessionProps): Session {
    return new Session(
      props.id,
      props.campaignId,
      props.sessionNumber,
      props.date,
      props.summary,
      props.createdAt,
      props.updatedAt,
    );
  }

  get Id(): SessionId {
    return this.idValue;
  }

  get CampaignId(): string {
    return this.campaignIdValue;
  }

  get SessionNumber(): number {
    return this.sessionNumberValue;
  }

  get Date(): Date {
    return this.dateValue;
  }

  get Summary(): string | null {
    return this.summaryValue;
  }

  get CreatedAt(): Date {
    return this.createdAtValue;
  }

  get UpdatedAt(): Date {
    return this.updatedAtValue;
  }

  changeDate(date: Date): void {
    this.dateValue = date;
    this.updatedAtValue = new Date();
  }

  changeSummary(summary: string | null): void {
    this.validateSummary(summary);

    this.summaryValue = summary;
    this.updatedAtValue = new Date();
  }

  private validateSessionNumber(sessionNumber: number): void {
    if (!Number.isInteger(sessionNumber) || sessionNumber < 1) {
      throw new ValidationError("Session number must be a positive integer.");
    }
  }

  private validateSummary(summary: string | null): void {
    if (summary === null) {
      return;
    }

    if (summary.length > 1000) {
      throw new ValidationError(
        "Session summary cannot exceed 1000 characters.",
      );
    }
  }
}
