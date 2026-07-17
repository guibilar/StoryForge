import {
  CampaignMember,
  CampaignMemberRepository,
  CampaignRole,
  NotFoundError,
  UserId,
  UserRepository,
  ValidationError,
} from "@storyforge/domain";

export interface AddCampaignMemberDto {
  campaignId: string;
  email: string;
  role: CampaignRole;
}

export interface UpdateCampaignMemberRoleDto {
  campaignId: string;
  userId: string;
  role: CampaignRole;
}

export class CampaignMemberService {
  constructor(
    private readonly campaignMemberRepository: CampaignMemberRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async listMembers(campaignId: string): Promise<CampaignMember[]> {
    return this.campaignMemberRepository.listByCampaign(campaignId);
  }

  async getMembership(
    campaignId: string,
    userId: string,
  ): Promise<CampaignMember | null> {
    return this.campaignMemberRepository.findByCampaignAndUser(
      campaignId,
      UserId.fromString(userId),
    );
  }

  async addMember(dto: AddCampaignMemberDto): Promise<CampaignMember> {
    const user = await this.userRepository.findByEmail(dto.email);
    if (!user) {
      throw new NotFoundError(`No user found with email "${dto.email}".`);
    }

    const existing = await this.campaignMemberRepository.findByCampaignAndUser(
      dto.campaignId,
      user.Id,
    );
    if (existing) {
      throw new ValidationError(
        `User with email "${dto.email}" is already a member of this campaign.`,
      );
    }

    if (dto.role === "OWNER") {
      await this.assertNoOtherOwner(dto.campaignId);
    }

    const member = CampaignMember.create({
      campaignId: dto.campaignId,
      userId: user.Id,
      role: dto.role,
    });
    await this.campaignMemberRepository.create(member);

    return member;
  }

  async removeMember(campaignId: string, userId: string): Promise<void> {
    const target = UserId.fromString(userId);
    const existing = await this.campaignMemberRepository.findByCampaignAndUser(
      campaignId,
      target,
    );
    if (!existing) {
      throw new NotFoundError(
        `User with ID "${userId}" is not a member of this campaign.`,
      );
    }

    await this.campaignMemberRepository.delete(campaignId, target);
  }

  async updateMemberRole(
    dto: UpdateCampaignMemberRoleDto,
  ): Promise<CampaignMember> {
    const member = await this.campaignMemberRepository.findByCampaignAndUser(
      dto.campaignId,
      UserId.fromString(dto.userId),
    );
    if (!member) {
      throw new NotFoundError(
        `User with ID "${dto.userId}" is not a member of this campaign.`,
      );
    }

    if (dto.role === "OWNER" && member.Role !== "OWNER") {
      await this.assertNoOtherOwner(dto.campaignId);
    }

    member.changeRole(dto.role);
    await this.campaignMemberRepository.update(member);

    return member;
  }

  private async assertNoOtherOwner(campaignId: string): Promise<void> {
    const members =
      await this.campaignMemberRepository.listByCampaign(campaignId);
    if (members.some((m) => m.Role === "OWNER")) {
      throw new ValidationError(
        "This campaign already has an owner. Only one owner is allowed per campaign.",
      );
    }
  }
}
