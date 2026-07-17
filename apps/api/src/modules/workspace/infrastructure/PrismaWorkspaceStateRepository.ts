import { WorkspaceState, WorkspaceStateRepository } from "@storyforge/domain";

import { prisma } from "@storyforge/database";
import { WorkspaceStateMapper } from "./WorkspaceStateMapper";

export class PrismaWorkspaceStateRepository implements WorkspaceStateRepository {
  async findByUserAndCampaign(
    userId: string,
    campaignId: string,
  ): Promise<WorkspaceState | null> {
    const record = await prisma.workspaceState.findUnique({
      where: { userId_campaignId: { userId, campaignId } },
    });

    if (!record) {
      return null;
    }

    return WorkspaceStateMapper.toDomain(record);
  }

  async upsert(workspaceState: WorkspaceState): Promise<void> {
    const data = WorkspaceStateMapper.toPersistence(workspaceState);

    await prisma.workspaceState.upsert({
      where: {
        userId_campaignId: {
          userId: data.userId,
          campaignId: data.campaignId,
        },
      },
      create: data,
      update: {
        layout: data.layout,
        recentEntityIds: data.recentEntityIds,
        updatedAt: data.updatedAt,
      },
    });
  }
}
