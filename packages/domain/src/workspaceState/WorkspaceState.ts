import { ValidationError } from "../shared";
import { WorkspaceStateId } from "./WorkspaceStateId";

// Bounds are defensive, not functional — the frontend already caps
// recentIds at 10 (KAN-100) and a saved layout at a handful of windows.
// These just stop a malformed/abusive client from writing an unbounded
// blob, since this is server-persisted state now (unlike its
// localStorage-only precedent).
const MAX_RECENT_ENTITY_IDS = 50;
const MAX_LAYOUT_JSON_LENGTH = 50_000;

export interface CreateWorkspaceStateProps {
  userId: string;
  campaignId: string;
  layout: Record<string, unknown>;
  recentEntityIds: string[];
}

export interface RehydrateWorkspaceStateProps {
  id: WorkspaceStateId;
  userId: string;
  campaignId: string;
  layout: Record<string, unknown>;
  recentEntityIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

// No soft-delete: unlike a Relationship or Note, this is a per-user UI-state
// cache the client fully overwrites on every save, not a record a user
// would ever want to "restore" after deleting — see KAN-103.
export class WorkspaceState {
  private constructor(
    private readonly idValue: WorkspaceStateId,
    private readonly userIdValue: string,
    private readonly campaignIdValue: string,
    private layoutValue: Record<string, unknown>,
    private recentEntityIdsValue: string[],
    private readonly createdAtValue: Date,
    private updatedAtValue: Date,
  ) {
    this.validateLayout(layoutValue);
    this.validateRecentEntityIds(recentEntityIdsValue);
  }

  static create(props: CreateWorkspaceStateProps): WorkspaceState {
    return new WorkspaceState(
      WorkspaceStateId.create(),
      props.userId,
      props.campaignId,
      props.layout,
      props.recentEntityIds,
      new Date(),
      new Date(),
    );
  }

  static rehydrate(props: RehydrateWorkspaceStateProps): WorkspaceState {
    return new WorkspaceState(
      props.id,
      props.userId,
      props.campaignId,
      props.layout,
      props.recentEntityIds,
      props.createdAt,
      props.updatedAt,
    );
  }

  get Id(): WorkspaceStateId {
    return this.idValue;
  }

  get UserId(): string {
    return this.userIdValue;
  }

  get CampaignId(): string {
    return this.campaignIdValue;
  }

  get Layout(): Record<string, unknown> {
    return this.layoutValue;
  }

  get RecentEntityIds(): string[] {
    return this.recentEntityIdsValue;
  }

  get CreatedAt(): Date {
    return this.createdAtValue;
  }

  get UpdatedAt(): Date {
    return this.updatedAtValue;
  }

  // The client always sends its full current state, not a partial patch —
  // this replaces both fields together rather than merging.
  replaceState(
    layout: Record<string, unknown>,
    recentEntityIds: string[],
  ): void {
    this.validateLayout(layout);
    this.validateRecentEntityIds(recentEntityIds);

    this.layoutValue = layout;
    this.recentEntityIdsValue = recentEntityIds;
    this.updatedAtValue = new Date();
  }

  private validateLayout(layout: Record<string, unknown>): void {
    if (JSON.stringify(layout).length > MAX_LAYOUT_JSON_LENGTH) {
      throw new ValidationError("Layout is too large to save.");
    }
  }

  private validateRecentEntityIds(recentEntityIds: string[]): void {
    if (recentEntityIds.length > MAX_RECENT_ENTITY_IDS) {
      throw new ValidationError("Too many recent entities to save.");
    }
  }
}
