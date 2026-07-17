import type { WorkspaceState as DomainWorkspaceState } from "@storyforge/domain";

export const WorkspaceState = {
  id: (workspaceState: DomainWorkspaceState) => workspaceState.Id.toString(),
  campaignId: (workspaceState: DomainWorkspaceState) =>
    workspaceState.CampaignId,
  layout: (workspaceState: DomainWorkspaceState) =>
    JSON.stringify(workspaceState.Layout),
  recentEntityIds: (workspaceState: DomainWorkspaceState) =>
    JSON.stringify(workspaceState.RecentEntityIds),
  createdAt: (workspaceState: DomainWorkspaceState) =>
    workspaceState.CreatedAt.toISOString(),
  updatedAt: (workspaceState: DomainWorkspaceState) =>
    workspaceState.UpdatedAt.toISOString(),
};
