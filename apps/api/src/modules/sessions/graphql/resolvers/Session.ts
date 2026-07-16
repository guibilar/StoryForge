import type { Session as DomainSession } from "@storyforge/domain";

export const Session = {
  id: (session: DomainSession) => session.Id.toString(),
  campaignId: (session: DomainSession) => session.CampaignId,
  sessionNumber: (session: DomainSession) => session.SessionNumber,
  date: (session: DomainSession) => session.Date.toISOString(),
  summary: (session: DomainSession) => session.Summary,
  createdAt: (session: DomainSession) => session.CreatedAt.toISOString(),
  updatedAt: (session: DomainSession) => session.UpdatedAt.toISOString(),
};
