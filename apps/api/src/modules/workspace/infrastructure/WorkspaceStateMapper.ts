import { WorkspaceState, WorkspaceStateId } from "@storyforge/domain";
import type {
  Prisma,
  WorkspaceState as PrismaWorkspaceState,
} from "@storyforge/database";

export class WorkspaceStateMapper {
  static toDomain(record: PrismaWorkspaceState): WorkspaceState {
    return WorkspaceState.rehydrate({
      id: WorkspaceStateId.fromString(record.id),
      userId: record.userId,
      campaignId: record.campaignId,
      layout: record.layout as Record<string, unknown>,
      recentEntityIds: record.recentEntityIds as string[],
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  static toPersistence(workspaceState: WorkspaceState) {
    return {
      id: workspaceState.Id.toString(),
      userId: workspaceState.UserId,
      campaignId: workspaceState.CampaignId,
      layout: workspaceState.Layout as Prisma.InputJsonValue,
      recentEntityIds: workspaceState.RecentEntityIds as Prisma.InputJsonValue,
      createdAt: workspaceState.CreatedAt,
      updatedAt: workspaceState.UpdatedAt,
    };
  }
}
