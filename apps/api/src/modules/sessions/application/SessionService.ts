import {
  CampaignMemberRepository,
  NotFoundError,
  Session,
  SessionId,
  SessionRepository,
  UserId,
  ValidationError,
} from "@storyforge/domain";

export interface CreateSessionDto {
  campaignId: string;
  date: Date;
  summary?: string | null;
}

export interface UpdateSessionDto {
  id: string;
  date?: Date;
  summary?: string | null;
}

export class SessionService {
  constructor(
    private readonly repository: SessionRepository,
    private readonly campaignMemberRepository: CampaignMemberRepository,
  ) {}

  async createSession(dto: CreateSessionDto): Promise<Session> {
    const maxSessionNumber = await this.repository.findMaxSessionNumber(
      dto.campaignId,
    );

    const session = Session.create({
      ...dto,
      sessionNumber: maxSessionNumber + 1,
    });

    await this.repository.create(session);

    return session;
  }

  async updateSession(dto: UpdateSessionDto): Promise<Session> {
    const session = await this.repository.findById(
      SessionId.fromString(dto.id),
    );

    if (!session) {
      throw new NotFoundError("Session not found.");
    }

    if (dto.date !== undefined) {
      session.changeDate(dto.date);
    }

    if (dto.summary !== undefined) {
      session.changeSummary(dto.summary);
    }

    await this.repository.update(session);

    return session;
  }

  async deleteSession(id: string): Promise<void> {
    const sessionId = SessionId.fromString(id);
    const session = await this.repository.findById(sessionId);

    if (!session) {
      throw new NotFoundError("Session not found.");
    }

    await this.repository.delete(sessionId);
  }

  async getSession(id: string): Promise<Session> {
    const session = await this.repository.findById(SessionId.fromString(id));

    if (!session) {
      throw new NotFoundError("Session not found.");
    }

    return session;
  }

  async findSession(id: string): Promise<Session | null> {
    return this.repository.findById(SessionId.fromString(id));
  }

  async listSessions(campaignId: string): Promise<Session[]> {
    return this.repository.findByCampaign(campaignId);
  }

  async attachAttendee(sessionId: string, userId: string): Promise<Session> {
    const session = await this.getSession(sessionId);

    const membership =
      await this.campaignMemberRepository.findByCampaignAndUser(
        session.CampaignId,
        UserId.fromString(userId),
      );

    if (!membership) {
      throw new ValidationError(
        "User is not a member of this session's campaign.",
      );
    }

    await this.repository.attachAttendee(session.Id, userId);

    return session;
  }

  async detachAttendee(sessionId: string, userId: string): Promise<Session> {
    const session = await this.getSession(sessionId);

    await this.repository.detachAttendee(session.Id, userId);

    return session;
  }

  async listAttendeeUserIds(sessionId: string): Promise<string[]> {
    return this.repository.listAttendeeUserIds(SessionId.fromString(sessionId));
  }
}
