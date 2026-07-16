import { Session, SessionId } from "@storyforge/domain";
import type { Session as PrismaSession } from "@storyforge/database";

export class SessionMapper {
  static toDomain(record: PrismaSession): Session {
    return Session.rehydrate({
      id: SessionId.fromString(record.id),
      campaignId: record.campaignId,
      sessionNumber: record.sessionNumber,
      date: record.date,
      summary: record.summary,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  static toPersistence(session: Session) {
    return {
      id: session.Id.toString(),
      campaignId: session.CampaignId,
      sessionNumber: session.SessionNumber,
      date: session.Date,
      summary: session.Summary,
      createdAt: session.CreatedAt,
      updatedAt: session.UpdatedAt,
    };
  }
}
