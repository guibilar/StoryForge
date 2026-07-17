import { WorkspaceState } from "./WorkspaceState";

export interface WorkspaceStateRepository {
  findByUserAndCampaign(
    userId: string,
    campaignId: string,
  ): Promise<WorkspaceState | null>;

  /** Insert-or-update on the [userId, campaignId] unique constraint. */
  upsert(workspaceState: WorkspaceState): Promise<void>;
}
