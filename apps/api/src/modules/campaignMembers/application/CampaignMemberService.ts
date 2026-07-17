import {
  CampaignMember,
  CampaignMemberRepository,
  CampaignRole,
  NotFoundError,
  User,
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

/** Role the outgoing OWNER is left with after a transfer. */
const DEMOTED_OWNER_ROLE: CampaignRole = "STORYTELLER";

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
    const user = await this.userRepository.findByEmail(
      User.normalizeEmail(dto.email),
    );
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

    // Only one OWNER can exist per campaign (see assertNoOtherOwner), so
    // removing an OWNER always leaves the campaign with no one able to
    // manage members or settings, or to archive it.
    if (existing.Role === "OWNER") {
      throw new ValidationError(
        "The campaign owner cannot be removed. A campaign must always have an owner.",
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

    // Same invariant as removeMember: demoting the sole OWNER would orphan
    // the campaign (nobody left with MANAGE_MEMBERS/MANAGE_CAMPAIGN_SETTINGS).
    if (member.Role === "OWNER" && dto.role !== "OWNER") {
      throw new ValidationError(
        "The campaign owner cannot be demoted. A campaign must always have an owner.",
      );
    }

    member.changeRole(dto.role);
    await this.campaignMemberRepository.update(member);

    return member;
  }

  /**
   * Hands OWNER over to another existing member, atomically demoting the
   * current OWNER. Unlike updateMemberRole (which rejects a second OWNER
   * outright), this is the only sanctioned way to change who owns a
   * campaign — without it, an OWNER could never be replaced.
   */
  async transferOwnership(
    campaignId: string,
    newOwnerUserId: string,
  ): Promise<CampaignMember> {
    const newOwner = await this.campaignMemberRepository.findByCampaignAndUser(
      campaignId,
      UserId.fromString(newOwnerUserId),
    );
    if (!newOwner) {
      throw new NotFoundError(
        `User with ID "${newOwnerUserId}" is not a member of this campaign.`,
      );
    }

    if (newOwner.Role === "OWNER") {
      return newOwner;
    }

    const members =
      await this.campaignMemberRepository.listByCampaign(campaignId);
    const currentOwner = members.find((m) => m.Role === "OWNER") ?? null;

    await this.campaignMemberRepository.transferOwnership(
      campaignId,
      currentOwner?.UserId ?? null,
      newOwner.UserId,
      DEMOTED_OWNER_ROLE,
    );

    newOwner.changeRole("OWNER");

    return newOwner;
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
