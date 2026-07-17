import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { Session, SessionId } from "@storyforge/domain";
import { prisma } from "@storyforge/database";
import { PrismaSessionRepository } from "./PrismaSessionRepository";

const repository = new PrismaSessionRepository();
const createdCampaignIds: string[] = [];
const createdUserIds: string[] = [];

async function createCampaign(): Promise<string> {
  const campaign = await prisma.campaign.create({
    data: { id: randomUUID(), name: `test-campaign-${randomUUID()}` },
  });
  createdCampaignIds.push(campaign.id);
  return campaign.id;
}

async function createUser(): Promise<string> {
  const user = await prisma.user.create({
    data: {
      id: randomUUID(),
      email: `test-user-${randomUUID()}@example.com`,
      password: "hashed",
    },
  });
  createdUserIds.push(user.id);
  return user.id;
}

afterEach(async () => {
  if (createdCampaignIds.length > 0) {
    await prisma.campaign.deleteMany({
      where: { id: { in: createdCampaignIds } },
    });
    createdCampaignIds.length = 0;
  }
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
  }
});

describe("PrismaSessionRepository", () => {
  it("creates a session and finds it by id", async () => {
    const campaignId = await createCampaign();
    const session = Session.create({
      campaignId,
      sessionNumber: 1,
      date: new Date("2024-01-01T00:00:00Z"),
      summary: "The party arrived in town.",
    });

    await repository.create(session);
    const found = await repository.findById(session.Id);

    expect(found).not.toBeNull();
    expect(found?.Id.equals(session.Id)).toBe(true);
    expect(found?.CampaignId).toBe(campaignId);
    expect(found?.SessionNumber).toBe(1);
  });

  it("returns null when the session does not exist", async () => {
    const found = await repository.findById(SessionId.create());

    expect(found).toBeNull();
  });

  it("lists sessions for a campaign ordered by sessionNumber", async () => {
    const campaignId = await createCampaign();
    const second = Session.create({
      campaignId,
      sessionNumber: 2,
      date: new Date("2024-01-08T00:00:00Z"),
    });
    const first = Session.create({
      campaignId,
      sessionNumber: 1,
      date: new Date("2024-01-01T00:00:00Z"),
    });
    await repository.create(second);
    await repository.create(first);

    const sessions = await repository.findByCampaign(campaignId);

    expect(sessions.map((s) => s.Id.toString())).toEqual([
      first.Id.toString(),
      second.Id.toString(),
    ]);
  });

  it("reports 0 as the max session number when no sessions exist", async () => {
    const campaignId = await createCampaign();

    await expect(repository.findMaxSessionNumber(campaignId)).resolves.toBe(0);
  });

  it("reports the highest session number for a campaign", async () => {
    const campaignId = await createCampaign();
    await repository.create(
      Session.create({
        campaignId,
        sessionNumber: 1,
        date: new Date("2024-01-01T00:00:00Z"),
      }),
    );
    await repository.create(
      Session.create({
        campaignId,
        sessionNumber: 3,
        date: new Date("2024-01-15T00:00:00Z"),
      }),
    );

    await expect(repository.findMaxSessionNumber(campaignId)).resolves.toBe(3);
  });

  it("updates a session", async () => {
    const campaignId = await createCampaign();
    const session = Session.create({
      campaignId,
      sessionNumber: 1,
      date: new Date("2024-01-01T00:00:00Z"),
    });
    await repository.create(session);

    session.changeSummary("Updated summary");
    await repository.update(session);

    const found = await repository.findById(session.Id);
    expect(found?.Summary).toBe("Updated summary");
  });

  it("deletes a session", async () => {
    const campaignId = await createCampaign();
    const session = Session.create({
      campaignId,
      sessionNumber: 1,
      date: new Date("2024-01-01T00:00:00Z"),
    });
    await repository.create(session);

    await repository.delete(session.Id);

    const found = await repository.findById(session.Id);
    expect(found).toBeNull();
  });

  it("attaches and detaches an attendee idempotently", async () => {
    const campaignId = await createCampaign();
    const userId = await createUser();
    const session = Session.create({
      campaignId,
      sessionNumber: 1,
      date: new Date("2024-01-01T00:00:00Z"),
    });
    await repository.create(session);

    await repository.attachAttendee(session.Id, userId);
    await repository.attachAttendee(session.Id, userId); // idempotent

    const attendees = await repository.listAttendeeUserIds(session.Id);
    expect(attendees).toEqual([userId]);

    await repository.detachAttendee(session.Id, userId);
    await repository.detachAttendee(session.Id, userId); // idempotent, no error

    await expect(repository.listAttendeeUserIds(session.Id)).resolves.toEqual(
      [],
    );
  });
});
