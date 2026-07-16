import { describe, expect, it } from "vitest";
import { Session } from "@storyforge/domain";
import type { Session as PrismaSession } from "@storyforge/database";
import { SessionMapper } from "./SessionMapper";

describe("SessionMapper", () => {
  it("maps a persistence record to a domain session", () => {
    const record: PrismaSession = {
      id: "11111111-1111-1111-1111-111111111111",
      campaignId: "22222222-2222-2222-2222-222222222222",
      sessionNumber: 3,
      date: new Date("2024-01-01T00:00:00Z"),
      summary: "The party arrived in town.",
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-02-01T00:00:00Z"),
    };

    const session = SessionMapper.toDomain(record);

    expect(session.Id.toString()).toBe(record.id);
    expect(session.CampaignId).toBe(record.campaignId);
    expect(session.SessionNumber).toBe(record.sessionNumber);
    expect(session.Date).toEqual(record.date);
    expect(session.Summary).toBe(record.summary);
    expect(session.CreatedAt).toEqual(record.createdAt);
    expect(session.UpdatedAt).toEqual(record.updatedAt);
  });

  it("maps a domain session to a persistence shape", () => {
    const session = Session.create({
      campaignId: "22222222-2222-2222-2222-222222222222",
      sessionNumber: 1,
      date: new Date("2024-01-01T00:00:00Z"),
      summary: "The party arrived in town.",
    });

    const record = SessionMapper.toPersistence(session);

    expect(record).toEqual({
      id: session.Id.toString(),
      campaignId: session.CampaignId,
      sessionNumber: session.SessionNumber,
      date: session.Date,
      summary: session.Summary,
      createdAt: session.CreatedAt,
      updatedAt: session.UpdatedAt,
    });
  });
});
