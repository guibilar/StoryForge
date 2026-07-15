import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CampaignMember,
  CampaignMemberRepository,
  NotFoundError,
  User,
  UserId,
  UserRepository,
  ValidationError,
} from "@storyforge/domain";
import { CampaignMemberService } from "./CampaignMemberService";

function makeCampaignMemberRepository(): CampaignMemberRepository {
  return {
    listByCampaign: vi.fn(),
    findByCampaignAndUser: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

function makeUserRepository(): UserRepository {
  return {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    existsByEmail: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
}

const campaignId = "campaign-1";

describe("CampaignMemberService", () => {
  let campaignMemberRepository: CampaignMemberRepository;
  let userRepository: UserRepository;
  let service: CampaignMemberService;

  beforeEach(() => {
    campaignMemberRepository = makeCampaignMemberRepository();
    userRepository = makeUserRepository();
    service = new CampaignMemberService(
      campaignMemberRepository,
      userRepository,
    );
  });

  describe("listMembers", () => {
    it("delegates to the repository", async () => {
      const members = [
        CampaignMember.create({
          campaignId,
          userId: UserId.create(),
          role: "PLAYER",
        }),
      ];
      vi.mocked(campaignMemberRepository.listByCampaign).mockResolvedValue(
        members,
      );

      await expect(service.listMembers(campaignId)).resolves.toBe(members);
      expect(campaignMemberRepository.listByCampaign).toHaveBeenCalledWith(
        campaignId,
      );
    });
  });

  describe("addMember", () => {
    const dto = {
      campaignId,
      email: "player@example.com",
      role: "PLAYER" as const,
    };

    it("throws NotFoundError when no user has that email", async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue(null);

      await expect(service.addMember(dto)).rejects.toThrow(NotFoundError);
      expect(campaignMemberRepository.create).not.toHaveBeenCalled();
    });

    it("rejects when the user is already a member", async () => {
      const user = User.create({ email: dto.email, password: "hashed" });
      vi.mocked(userRepository.findByEmail).mockResolvedValue(user);
      vi.mocked(
        campaignMemberRepository.findByCampaignAndUser,
      ).mockResolvedValue(
        CampaignMember.create({ campaignId, userId: user.Id, role: "PLAYER" }),
      );

      await expect(service.addMember(dto)).rejects.toThrow(ValidationError);
      expect(campaignMemberRepository.create).not.toHaveBeenCalled();
    });

    it("creates the member when the user exists and is not already a member", async () => {
      const user = User.create({ email: dto.email, password: "hashed" });
      vi.mocked(userRepository.findByEmail).mockResolvedValue(user);
      vi.mocked(
        campaignMemberRepository.findByCampaignAndUser,
      ).mockResolvedValue(null);

      const member = await service.addMember(dto);

      expect(member.UserId.equals(user.Id)).toBe(true);
      expect(member.Role).toBe("PLAYER");
      expect(campaignMemberRepository.create).toHaveBeenCalledWith(member);
    });
  });

  describe("removeMember", () => {
    it("throws NotFoundError when the user is not a member", async () => {
      vi.mocked(
        campaignMemberRepository.findByCampaignAndUser,
      ).mockResolvedValue(null);

      await expect(
        service.removeMember(campaignId, "missing-user"),
      ).rejects.toThrow(NotFoundError);
      expect(campaignMemberRepository.delete).not.toHaveBeenCalled();
    });

    it("deletes the member when found", async () => {
      const userId = UserId.create();
      vi.mocked(
        campaignMemberRepository.findByCampaignAndUser,
      ).mockResolvedValue(
        CampaignMember.create({ campaignId, userId, role: "PLAYER" }),
      );

      await service.removeMember(campaignId, userId.toString());

      expect(campaignMemberRepository.delete).toHaveBeenCalledWith(
        campaignId,
        userId,
      );
    });
  });

  describe("updateMemberRole", () => {
    it("throws NotFoundError when the user is not a member", async () => {
      vi.mocked(
        campaignMemberRepository.findByCampaignAndUser,
      ).mockResolvedValue(null);

      await expect(
        service.updateMemberRole({
          campaignId,
          userId: "missing-user",
          role: "STORYTELLER",
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it("changes the role and persists it", async () => {
      const userId = UserId.create();
      const member = CampaignMember.create({
        campaignId,
        userId,
        role: "PLAYER",
      });
      vi.mocked(
        campaignMemberRepository.findByCampaignAndUser,
      ).mockResolvedValue(member);

      const updated = await service.updateMemberRole({
        campaignId,
        userId: userId.toString(),
        role: "STORYTELLER",
      });

      expect(updated.Role).toBe("STORYTELLER");
      expect(campaignMemberRepository.update).toHaveBeenCalledWith(member);
    });
  });
});
