import type { Event as DomainEvent } from "@storyforge/domain";
import type { GraphQLContext } from "../../../../graphql/context";

export const Event = {
  id: (event: DomainEvent) => event.Id.toString(),
  campaignId: (event: DomainEvent) => event.CampaignId,
  sessionId: (event: DomainEvent) => event.SessionId,
  session: (event: DomainEvent, _args: unknown, context: GraphQLContext) =>
    event.SessionId
      ? context.sessionService.findSession(event.SessionId)
      : null,
  title: (event: DomainEvent) => event.Title,
  description: (event: DomainEvent) => event.Description,
  occurredAt: (event: DomainEvent) => event.OccurredAt.toISOString(),
  participants: (event: DomainEvent, _args: unknown, context: GraphQLContext) =>
    context.eventService.listParticipants(event.Id.toString()),
  createdAt: (event: DomainEvent) => event.CreatedAt.toISOString(),
  updatedAt: (event: DomainEvent) => event.UpdatedAt.toISOString(),
};
