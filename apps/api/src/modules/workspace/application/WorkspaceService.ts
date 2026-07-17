import { WorkspaceState, WorkspaceStateRepository } from "@storyforge/domain";

export interface SaveWorkspaceStateDto {
  campaignId: string;
  layout: Record<string, unknown>;
  recentEntityIds: string[];
}

export class WorkspaceService {
  constructor(private readonly repository: WorkspaceStateRepository) {}

  async getWorkspaceState(
    userId: string,
    campaignId: string,
  ): Promise<WorkspaceState | null> {
    return this.repository.findByUserAndCampaign(userId, campaignId);
  }

  async saveWorkspaceState(
    userId: string,
    dto: SaveWorkspaceStateDto,
  ): Promise<WorkspaceState> {
    const existing = await this.repository.findByUserAndCampaign(
      userId,
      dto.campaignId,
    );

    const workspaceState =
      existing ??
      WorkspaceState.create({
        userId,
        campaignId: dto.campaignId,
        layout: dto.layout,
        recentEntityIds: dto.recentEntityIds,
      });

    if (existing) {
      existing.replaceState(dto.layout, dto.recentEntityIds);
    }

    await this.repository.upsert(workspaceState);

    return workspaceState;
  }
}
