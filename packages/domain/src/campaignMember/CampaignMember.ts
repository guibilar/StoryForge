import { UserId } from "../user";

export type CampaignRole = "OWNER" | "STORYTELLER" | "PLAYER";

export interface CreateCampaignMemberProps {
  userId: UserId;
  role: CampaignRole;
}

export interface RehydrateCampaignMemberProps {
  userId: UserId;
  role: CampaignRole;
  createdAt: Date;
  updatedAt: Date;
}

export class CampaignMember {
  private constructor(
    private readonly userIdValue: UserId,
    private roleValue: CampaignRole,
    private readonly createdAtValue: Date,
    private updatedAtValue: Date,
  ) {}

  static create(props: CreateCampaignMemberProps): CampaignMember {
    return new CampaignMember(props.userId, props.role, new Date(), new Date());
  }

  static rehydrate(props: RehydrateCampaignMemberProps): CampaignMember {
    return new CampaignMember(
      props.userId,
      props.role,
      props.createdAt,
      props.updatedAt,
    );
  }

  get UserId(): UserId {
    return this.userIdValue;
  }

  get Role(): CampaignRole {
    return this.roleValue;
  }

  get CreatedAt(): Date {
    return this.createdAtValue;
  }

  get UpdatedAt(): Date {
    return this.updatedAtValue;
  }

  changeRole(newRole: CampaignRole): void {
    this.roleValue = newRole;
    this.updatedAtValue = new Date();
  }
}
