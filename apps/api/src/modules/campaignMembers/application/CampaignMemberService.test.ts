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

    it.each(["STORYTELLER", "CO_STORYTELLER", "PLAYER", "OBSERVER"] as const)(
      "creates the member with role %s",
      async (role) => {
        const user = User.create({ email: dto.email, password: "hashed" });
        vi.mocked(userRepository.findByEmail).mockResolvedValue(user);
        vi.mocked(
          campaignMemberRepository.findByCampaignAndUser,
        ).mockResolvedValue(null);

        const member = await service.addMember({ ...dto, role });

        expect(member.Role).toBe(role);
      },
    );

    it("rejects adding an OWNER when the campaign already has one", async () => {
      const user = User.create({ email: dto.email, password: "hashed" });
      vi.mocked(userRepository.findByEmail).mockResolvedValue(user);
      vi.mocked(
        campaignMemberRepository.findByCampaignAndUser,
      ).mockResolvedValue(null);
      vi.mocked(campaignMemberRepository.listByCampaign).mockResolvedValue([
        CampaignMember.create({
          campaignId,
          userId: UserId.create(),
          role: "OWNER",
        }),
      ]);

      await expect(
        service.addMember({ ...dto, role: "OWNER" }),
      ).rejects.toThrow(ValidationError);
      expect(campaignMemberRepository.create).not.toHaveBeenCalled();
    });

    it("allows adding an OWNER when the campaign has no owner yet", async () => {
      const user = User.create({ email: dto.email, password: "hashed" });
      vi.mocked(userRepository.findByEmail).mockResolvedValue(user);
      vi.mocked(
        campaignMemberRepository.findByCampaignAndUser,
      ).mockResolvedValue(null);
      vi.mocked(campaignMemberRepository.listByCampaign).mockResolvedValue([]);

      const member = await service.addMember({ ...dto, role: "OWNER" });

      expect(member.Role).toBe("OWNER");
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

    it.each(["CO_STORYTELLER", "OBSERVER"] as const)(
      "changes the role to %s",
      async (role) => {
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
          role,
        });

        expect(updated.Role).toBe(role);
      },
    );

    it("rejects promoting a member to OWNER when the campaign already has one", async () => {
      const userId = UserId.create();
      const member = CampaignMember.create({
        campaignId,
        userId,
        role: "PLAYER",
      });
      vi.mocked(
        campaignMemberRepository.findByCampaignAndUser,
      ).mockResolvedValue(member);
      vi.mocked(campaignMemberRepository.listByCampaign).mockResolvedValue([
        CampaignMember.create({
          campaignId,
          userId: UserId.create(),
          role: "OWNER",
        }),
        member,
      ]);

      await expect(
        service.updateMemberRole({
          campaignId,
          userId: userId.toString(),
          role: "OWNER",
        }),
      ).rejects.toThrow(ValidationError);
      expect(campaignMemberRepository.update).not.toHaveBeenCalled();
    });

    it("allows re-affirming the role of the existing OWNER", async () => {
      const userId = UserId.create();
      const member = CampaignMember.create({
        campaignId,
        userId,
        role: "OWNER",
      });
      vi.mocked(
        campaignMemberRepository.findByCampaignAndUser,
      ).mockResolvedValue(member);

      const updated = await service.updateMemberRole({
        campaignId,
        userId: userId.toString(),
        role: "OWNER",
      });

      expect(updated.Role).toBe("OWNER");
      expect(campaignMemberRepository.listByCampaign).not.toHaveBeenCalled();
      expect(campaignMemberRepository.update).toHaveBeenCalledWith(member);
    });
  });
});
