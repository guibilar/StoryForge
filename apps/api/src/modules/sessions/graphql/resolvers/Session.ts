import type { Session as DomainSession } from "@storyforge/domain";
import type { GraphQLContext } from "../../../../graphql/context";

export const Session = {
  id: (session: DomainSession) => session.Id.toString(),
  campaignId: (session: DomainSession) => session.CampaignId,
  sessionNumber: (session: DomainSession) => session.SessionNumber,
  date: (session: DomainSession) => session.Date.toISOString(),
  summary: (session: DomainSession) => session.Summary,
  attendees: async (
    session: DomainSession,
    _args: unknown,
    context: GraphQLContext,
  ) => {
    const userIds = await context.sessionService.listAttendeeUserIds(
      session.Id.toString(),
    );
    const members = await Promise.all(
      userIds.map((userId) =>
        context.campaignMemberService.getMembership(session.CampaignId, userId),
      ),
    );

    return members.filter((member) => member !== null);
  },
  createdAt: (session: DomainSession) => session.CreatedAt.toISOString(),
  updatedAt: (session: DomainSession) => session.UpdatedAt.toISOString(),
};
