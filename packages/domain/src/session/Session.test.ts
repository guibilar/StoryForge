import { describe, expect, it } from "vitest";
import { Session } from "./Session";
import { SessionId } from "./SessionId";

const validProps = {
  campaignId: "campaign-1",
  sessionNumber: 1,
  date: new Date("2024-01-01T00:00:00Z"),
  summary: "The party arrived in town.",
};

describe("Session", () => {
  it("creates a session with defaults", () => {
    const session = Session.create(validProps);

    expect(session.CampaignId).toBe(validProps.campaignId);
    expect(session.SessionNumber).toBe(validProps.sessionNumber);
    expect(session.Date).toBe(validProps.date);
    expect(session.Summary).toBe(validProps.summary);
  });

  it("defaults summary to null when omitted", () => {
    const session = Session.create({
      campaignId: "campaign-1",
      sessionNumber: 1,
      date: new Date("2024-01-01T00:00:00Z"),
    });

    expect(session.Summary).toBeNull();
  });

  it("rehydrates preserving id and timestamps", () => {
    const id = SessionId.create();
    const createdAt = new Date("2024-01-01T00:00:00Z");
    const updatedAt = new Date("2024-02-01T00:00:00Z");

    const session = Session.rehydrate({
      id,
      campaignId: validProps.campaignId,
      sessionNumber: validProps.sessionNumber,
      date: validProps.date,
      summary: null,
      createdAt,
      updatedAt,
    });

    expect(session.Id.equals(id)).toBe(true);
    expect(session.CreatedAt).toBe(createdAt);
    expect(session.UpdatedAt).toBe(updatedAt);
  });

  it.each([0, -1, 1.5])(
    "rejects a non-positive-integer session number %j",
    (sessionNumber) => {
      expect(() => Session.create({ ...validProps, sessionNumber })).toThrow(
        "Session number must be a positive integer.",
      );
    },
  );

  it("rejects a summary longer than 1000 characters", () => {
    expect(() =>
      Session.create({ ...validProps, summary: "a".repeat(1001) }),
    ).toThrow("Session summary cannot exceed 1000 characters.");
  });

  it("changes date and summary", () => {
    const session = Session.create(validProps);
    const newDate = new Date("2024-03-01T00:00:00Z");

    session.changeDate(newDate);
    session.changeSummary("Updated summary");

    expect(session.Date).toBe(newDate);
    expect(session.Summary).toBe("Updated summary");
  });

  it("rejects changing summary to one longer than 1000 characters", () => {
    const session = Session.create(validProps);

    expect(() => session.changeSummary("a".repeat(1001))).toThrow(
      "Session summary cannot exceed 1000 characters.",
    );
  });
});
