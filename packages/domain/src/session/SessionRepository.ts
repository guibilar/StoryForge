import { Session } from "./Session";
import { SessionId } from "./SessionId";

export interface SessionRepository {
  findById(id: SessionId): Promise<Session | null>;

  findByCampaign(campaignId: string): Promise<Session[]>;

  findMaxSessionNumber(campaignId: string): Promise<number>;

  create(session: Session): Promise<void>;

  update(session: Session): Promise<void>;

  delete(id: SessionId): Promise<void>;
}
